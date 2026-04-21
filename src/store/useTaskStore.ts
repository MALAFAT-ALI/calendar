import { create } from 'zustand';
import { Task, Category, ChangeLog } from '../types';
import { 
  collection, 
  onSnapshot, 
  query, 
  where, 
  doc, 
  writeBatch, 
  serverTimestamp,
  Timestamp,
  orderBy
} from 'firebase/firestore';
import { db } from '../firebase';
import { removeUndefinedDeep, ensureDate } from '../lib/utils';

interface TaskState {
  tasks: Task[];
  categories: Category[];
  loading: boolean;
  
  // Normalized data
  tasksById: Record<string, Task>;
  tasksByCategory: Record<string, Task[]>;
  
  setTasks: (tasks: Task[]) => void;
  setCategories: (categories: Category[]) => void;
  setLoading: (loading: boolean) => void;
  
  // Firestore Sync
  subscribeToTasks: (uid: string) => () => void;
  subscribeToCategories: (uid: string) => () => void;
  
  // Actions
  updateTaskOptimistically: (taskId: string, updates: Partial<Task>) => void;
  persistTaskUpdates: (updates: Record<string, Partial<Task>>) => Promise<void>;
  moveTaskToDate: (taskId: string, newStartDate: Date) => Promise<void>;
  
  // Chaining Logic
  recalculateChainedTasks: (categoryId: string) => void;
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  categories: [],
  loading: true,
  tasksById: {},
  tasksByCategory: {},

  setTasks: (tasks) => {
    const tasksById: Record<string, Task> = {};
    const tasksByCategory: Record<string, Task[]> = {};
    
    tasks.forEach(task => {
      tasksById[task.id] = task;
      if (!tasksByCategory[task.categoryId]) {
        tasksByCategory[task.categoryId] = [];
      }
      tasksByCategory[task.categoryId].push(task);
    });
    
    // Sort each category by order
    Object.keys(tasksByCategory).forEach(catId => {
      tasksByCategory[catId].sort((a, b) => a.order - b.order);
    });
    
    set({ tasks, tasksById, tasksByCategory });
  },

  setCategories: (categories) => set({ categories }),
  setLoading: (loading) => set({ loading }),

  subscribeToTasks: (uid) => {
    const q = query(
      collection(db, 'tasks'), 
      where('uid', '==', uid),
      orderBy('order', 'asc')
    );
    
    return onSnapshot(q, (snapshot) => {
      const tasks = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Task));
      get().setTasks(tasks);
      get().setLoading(false);
    });
  },

  subscribeToCategories: (uid) => {
    const q = query(collection(db, 'categories'), where('uid', '==', uid));
    return onSnapshot(q, (snapshot) => {
      const categories = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Category));
      set({ categories });
    });
  },

  updateTaskOptimistically: (taskId, updates) => {
    const { tasksById } = get();
    const task = tasksById[taskId];
    if (!task) return;

    const updatedTask = { ...task, ...updates };
    const newTasksById = { ...tasksById, [taskId]: updatedTask };
    
    // Rebuild tasks array and tasksByCategory
    const newTasks = Object.values(newTasksById);
    get().setTasks(newTasks);
  },

  persistTaskUpdates: async (updates) => {
    const { tasksById } = get();
    const batch = writeBatch(db);
    
    Object.entries(updates).forEach(([taskId, taskUpdates]) => {
      const task = tasksById[taskId];
      const taskRef = doc(db, 'tasks', taskId);
      
      let finalUpdates = { ...taskUpdates };
      
      // If task is approved and dates are changing, add to log
      if (task && task.isApproved && (taskUpdates.startDate || taskUpdates.endDate)) {
        const oldStart = task.previousStartDate || task.startDate;
        const oldEnd = task.previousEndDate || task.endDate;
        
        const newLog: ChangeLog = {
          id: Math.random().toString(36).substr(2, 9),
          timestamp: Timestamp.now(),
          type: (taskUpdates.startDate && taskUpdates.endDate) ? 'move' : 'resize',
          oldStart: oldStart,
          oldEnd: oldEnd,
          newStart: (taskUpdates.startDate || task.startDate) as Timestamp,
          newEnd: (taskUpdates.endDate || task.endDate) as Timestamp,
          reason: taskUpdates.delayReason || task.delayReason || '',
          notes: taskUpdates.notes || task.notes || ''
        };
        
        finalUpdates.changeLogs = [...(task.changeLogs || []), newLog];
      }

      const cleanedData = removeUndefinedDeep({
        ...finalUpdates,
        updatedAt: serverTimestamp()
      });
      batch.update(taskRef, cleanedData);
    });
    
    await batch.commit();
  },

  moveTaskToDate: async (taskId, newStartDate) => {
    const { tasksById } = get();
    const task = tasksById[taskId];
    if (!task) return;

    const currentStart = ensureDate(task.startDate);
    const currentEnd = ensureDate(task.endDate);
    const duration = currentEnd.getTime() - currentStart.getTime();
    const newEndDate = new Date(newStartDate.getTime() + duration);

    const updates = {
      startDate: Timestamp.fromDate(newStartDate),
      endDate: Timestamp.fromDate(newEndDate),
      previousStartDate: task.startDate,
      previousEndDate: task.endDate,
    };

    get().updateTaskOptimistically(taskId, updates);
    await get().persistTaskUpdates({ [taskId]: updates });
    get().recalculateChainedTasks(task.categoryId);
  },

  recalculateChainedTasks: (categoryId) => {
    const { tasksByCategory, categories } = get();
    const category = categories.find(c => c.id === categoryId);
    if (!category || !category.isChained) return;

    const categoryTasks = [...(tasksByCategory[categoryId] || [])];
    if (categoryTasks.length === 0) return;

    const updates: Record<string, Partial<Task>> = {};
    let currentStartTime = ensureDate(categoryTasks[0].startDate).getTime();

    categoryTasks.forEach((task, index) => {
      const taskStart = ensureDate(task.startDate);
      const taskEnd = ensureDate(task.endDate);
      const duration = taskEnd.getTime() - taskStart.getTime();
      const newStartDate = new Date(currentStartTime);
      const newEndDate = new Date(currentStartTime + duration);

      if (
        newStartDate.getTime() !== taskStart.getTime() ||
        newEndDate.getTime() !== taskEnd.getTime()
      ) {
        updates[task.id] = {
          startDate: Timestamp.fromDate(newStartDate),
          endDate: Timestamp.fromDate(newEndDate),
          previousStartDate: task.startDate,
          previousEndDate: task.endDate,
        };
      }
      
      currentStartTime = newEndDate.getTime();
    });

    if (Object.keys(updates).length > 0) {
      get().persistTaskUpdates(updates);
    }
  }
}));
