import React, { useState, useEffect, useRef } from 'react';
import { Calendar } from './components/Calendar';
import { TimelineView } from './components/TimelineView';
import { TaskModal } from './components/TaskModal';
import { CategoryModal } from './components/CategoryModal';
import { ReasonModal } from './components/ReasonModal';
import { Login } from './components/Login';
import { Task, Category } from './types';
import { getIconComponent } from './constants';
import { Plus, LayoutGrid, Calendar as CalendarIcon, Edit2, LogOut, Copy, Download, X } from 'lucide-react';
import { addMonths, subMonths, format } from 'date-fns';
import { cn, ensureDate } from './lib/utils';
import { useAuth } from './AuthContext';
import { useTaskStore } from './store/useTaskStore';
import { doc, collection, setDoc, deleteDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import toast, { Toaster } from 'react-hot-toast';
import * as htmlToImage from 'html-to-image';
import { arSA } from 'date-fns/locale';

export default function App() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { 
    tasks, 
    categories, 
    loading: dataLoading, 
    subscribeToTasks, 
    subscribeToCategories,
    persistTaskUpdates,
    recalculateChainedTasks
  } = useTaskStore();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'timeline'>('month');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [hiddenCategoryIds, setHiddenCategoryIds] = useState<Set<string>>(new Set());
  const [isFullScreen, setIsFullScreen] = useState(false);
  
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  
  const [editingTask, setEditingTask] = useState<Task | undefined>();
  const [editingCategory, setEditingCategory] = useState<Category | undefined>();
  const [selectedDateForNewTask, setSelectedDateForNewTask] = useState<Date | undefined>();
  const [selectedEndDateForNewTask, setSelectedEndDateForNewTask] = useState<Date | undefined>();

  const [pendingUpdate, setPendingUpdate] = useState<{
    taskId: string;
    updates: Record<string, Partial<Task>>;
  } | null>(null);

  const calendarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) {
      const unsubTasks = subscribeToTasks(user.uid);
      const unsubCategories = subscribeToCategories(user.uid);
      return () => {
        unsubTasks();
        unsubCategories();
      };
    }
  }, [user, subscribeToTasks, subscribeToCategories]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50" dir="rtl">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  if (dataLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50" dir="rtl">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-slate-500 font-medium">جاري تحميل البيانات...</p>
        </div>
      </div>
    );
  }

  const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));

  const handleSaveTask = async (taskData: Omit<Task, 'id' | 'uid' | 'createdAt' | 'updatedAt'>) => {
    if (!user) return;
    const id = editingTask?.id || doc(collection(db, 'tasks')).id;
    const taskRef = doc(db, 'tasks', id);
    
    const isNew = !editingTask;
    const finalData = {
      ...taskData,
      uid: user.uid,
      updatedAt: serverTimestamp(),
      ...(isNew ? { createdAt: serverTimestamp(), order: tasks.length } : {})
    };

    const isDateChanged = editingTask && (
      ensureDate(editingTask.startDate).getTime() !== taskData.startDate.toDate().getTime() ||
      ensureDate(editingTask.endDate).getTime() !== taskData.endDate.toDate().getTime()
    );

    if (editingTask?.isApproved && isDateChanged) {
      setPendingUpdate({ taskId: id, updates: { [id]: finalData } });
      setIsTaskModalOpen(false);
      return;
    }
    
    try {
      await setDoc(taskRef, finalData, { merge: true });
      if (taskData.categoryId) {
        recalculateChainedTasks(taskData.categoryId);
      }
      toast.success(isNew ? 'تمت إضافة المهمة بنجاح' : 'تم تحديث المهمة بنجاح');
    } catch (error: any) {
      console.error("Error saving task:", error);
      if (error.code === 'permission-denied') {
        toast.error('ليس لديك صلاحية للقيام بهذا الإجراء. يرجى التأكد من تسجيل الدخول.');
      } else {
        toast.error('حدث خطأ أثناء حفظ المهمة. يرجى المحاولة مرة أخرى.');
      }
    }
  };

  const handleDeleteTask = async (id: string) => {
    const task = tasks.find(t => t.id === id);
    try {
      await deleteDoc(doc(db, 'tasks', id));
      if (task?.categoryId) {
        recalculateChainedTasks(task.categoryId);
      }
      toast.success('تم حذف المهمة بنجاح');
    } catch (error: any) {
      console.error("Error deleting task:", error);
      toast.error('حدث خطأ أثناء حذف المهمة.');
    }
  };

  const handleSaveCategory = async (categoryData: Omit<Category, 'id' | 'uid'>) => {
    if (!user) return;
    const id = editingCategory?.id || doc(collection(db, 'categories')).id;
    const categoryRef = doc(db, 'categories', id);
    try {
      await setDoc(categoryRef, { ...categoryData, uid: user.uid }, { merge: true });
      toast.success(editingCategory ? 'تم تحديث التصنيف بنجاح' : 'تمت إضافة التصنيف بنجاح');
    } catch (error: any) {
      console.error("Error saving category:", error);
      toast.error('حدث خطأ أثناء حفظ التصنيف.');
    }
  };

  const handleDeleteCategory = async (id: string) => {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'categories', id));
    tasks.filter(t => t.categoryId === id).forEach(t => {
      batch.delete(doc(db, 'tasks', t.id));
    });
    try {
      await batch.commit();
      if (selectedCategoryId === id) setSelectedCategoryId(null);
      toast.success('تم حذف التصنيف وجميع مهامه بنجاح');
    } catch (error: any) {
      console.error("Error deleting category:", error);
      toast.error('حدث خطأ أثناء حذف التصنيف.');
    }
  };

  const openNewTaskModal = (date?: Date, endDate?: Date) => {
    if (categories.length === 0) {
      alert('الرجاء إضافة تصنيف واحد على الأقل قبل إضافة مهمة.');
      return;
    }
    setEditingTask(undefined);
    setSelectedDateForNewTask(date);
    setSelectedEndDateForNewTask(endDate);
    setIsTaskModalOpen(true);
  };

  const handleRangeSelect = (start: Date, end: Date) => {
    openNewTaskModal(start, end);
  };

  const openEditTaskModal = (task: Task) => {
    setEditingTask(task);
    setIsTaskModalOpen(true);
  };

  const openNewCategoryModal = () => {
    setEditingCategory(undefined);
    setIsCategoryModalOpen(true);
  };

  const filteredTasks = tasks.filter(t => {
    if (hiddenCategoryIds.has(t.categoryId)) return false;
    if (selectedCategoryId && t.categoryId !== selectedCategoryId) return false;
    return true;
  });

  const toggleCategoryVisibility = (categoryId: string) => {
    setHiddenCategoryIds(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  const handleCopyAllLogs = () => {
    const approvedTasks = tasks.filter(t => t.isApproved && t.changeLogs && t.changeLogs.length > 0);
    if (approvedTasks.length === 0) {
      toast.error('لا توجد سجلات تغيير للمهام المعتمدة');
      return;
    }

    let fullLog = '--- سجل التغييرات للمهام المعتمدة ---\n\n';
    approvedTasks.forEach(task => {
      fullLog += `المهمة: ${task.title}\n`;
      task.changeLogs?.forEach(log => {
        fullLog += `- ${format(ensureDate(log.timestamp), 'yyyy/MM/dd HH:mm')}: `;
        fullLog += `${log.type === 'move' ? 'نقل' : 'تغيير حجم'} `;
        fullLog += `من (${format(ensureDate(log.oldStart), 'dd MMMM', { locale: arSA })} - ${format(ensureDate(log.oldEnd), 'dd MMMM', { locale: arSA })}) `;
        fullLog += `إلى (${format(ensureDate(log.newStart), 'dd MMMM', { locale: arSA })} - ${format(ensureDate(log.newEnd), 'dd MMMM', { locale: arSA })})\n`;
        if (log.reason) fullLog += `  السبب: ${log.reason}\n`;
        if (log.notes) fullLog += `  ملاحظات: ${log.notes}\n`;
      });
      fullLog += '\n';
    });

    navigator.clipboard.writeText(fullLog).then(() => {
      toast.success('تم نسخ السجل الكامل');
    });
  };

  const handleExportImage = async () => {
    if (!calendarRef.current) return;
    
    const toastId = toast.loading('جاري تجهيز الصورة...');
    
    try {
      // Find the scrollable container inside the calendar
      const scrollContainer = calendarRef.current.querySelector('.overflow-y-auto') as HTMLElement;
      
      // Store original styles to restore them later
      const originalCalendarStyle = calendarRef.current.style.cssText;
      const originalScrollStyle = scrollContainer ? scrollContainer.style.cssText : '';

      // Temporarily make everything visible and full height for capture
      if (scrollContainer) {
        scrollContainer.style.height = 'auto';
        scrollContainer.style.overflow = 'visible';
      }
      calendarRef.current.style.height = 'auto';
      calendarRef.current.style.overflow = 'visible';

      const dataUrl = await htmlToImage.toPng(calendarRef.current, {
        backgroundColor: '#f8fafc',
        style: {
          padding: '20px',
          margin: '0',
        },
        cacheBust: true,
        pixelRatio: 2,
      });
      
      // Restore original styles
      calendarRef.current.style.cssText = originalCalendarStyle;
      if (scrollContainer) scrollContainer.style.cssText = originalScrollStyle;
      
      const link = document.createElement('a');
      link.download = `calendar-${format(new Date(), 'yyyy-MM-dd')}.png`;
      link.href = dataUrl;
      link.click();
      toast.success('تم تصدير التقويم بنجاح', { id: toastId });
    } catch (error: any) {
      console.error('Export failed', error);
      
      // Fallback: Try again with skipFonts if the error is related to CSS rules
      if (error.message?.includes('cssRules') || error.message?.includes('CSSStyleSheet')) {
        try {
          const dataUrl = await htmlToImage.toPng(calendarRef.current!, {
            backgroundColor: '#f8fafc',
            style: { padding: '20px' },
            cacheBust: true,
            skipFonts: true, // Skip fonts to avoid the CORS error
          });
          const link = document.createElement('a');
          link.download = `calendar-${format(new Date(), 'yyyy-MM-dd')}-no-fonts.png`;
          link.href = dataUrl;
          link.click();
          toast.success('تم التصدير بنجاح (بدون الخطوط المخصصة لتجنب خطأ المتصفح)', { id: toastId });
          return;
        } catch (retryError) {
          console.error('Retry failed', retryError);
        }
      }
      
      toast.error('فشل تصدير الصورة. يرجى المحاولة من متصفح آخر أو فتح التطبيق في نافذة جديدة.', { id: toastId });
    }
  };

  const handleReasonSubmit = async (reason: string) => {
    if (!pendingUpdate) return;
    
    const { taskId, updates } = pendingUpdate;
    const task = tasks.find(t => t.id === taskId);
    
    const finalUpdates = {
      [taskId]: {
        ...updates[taskId],
        delayReason: reason
      }
    };

    await persistTaskUpdates(finalUpdates);
    if (task) recalculateChainedTasks(task.categoryId);
    setPendingUpdate(null);
  };

  const handleTaskUpdate = async (taskId: string, updates: Record<string, Partial<Task>>) => {
    const task = tasks.find(t => t.id === taskId);
    if (task?.isApproved) {
      setPendingUpdate({ taskId, updates });
    } else {
      await persistTaskUpdates(updates);
      recalculateChainedTasks(task?.categoryId || '');
    }
  };

  return (
    <div className={cn("min-h-screen flex flex-col md:flex-row bg-slate-50", isFullScreen && "overflow-hidden")} dir="rtl">
      {/* Sidebar */}
      {!isFullScreen && (
        <aside className="w-full md:w-64 bg-white border-l border-slate-200 flex flex-col shrink-0">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-sm">
              <CalendarIcon className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">تقويم المهام</h1>
          </div>
          <button onClick={signOut} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="تسجيل الخروج">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-4 flex-1 overflow-y-auto">
          <button
            onClick={() => openNewTaskModal()}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-3 px-4 flex items-center justify-center gap-2 font-medium transition-all shadow-sm hover:shadow mb-8"
          >
            <Plus className="w-5 h-5" />
            مهمة جديدة
          </button>

          <div className="mb-2 flex items-center justify-between px-2">
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider">التصنيفات</h2>
            <button 
              onClick={openNewCategoryModal}
              className="text-blue-600 hover:bg-blue-50 p-1.5 rounded-md transition-colors"
              title="إضافة تصنيف"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-1">
            <button
              onClick={() => setSelectedCategoryId(null)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm font-medium",
                selectedCategoryId === null 
                  ? "bg-slate-100 text-slate-800" 
                  : "text-slate-600 hover:bg-slate-50"
              )}
            >
              <LayoutGrid className="w-4 h-4" />
              عرض الكل
            </button>
            
            {categories.length === 0 && (
              <div className="text-xs text-slate-400 text-center py-4">
                لا توجد تصنيفات بعد
              </div>
            )}

            {categories.map(category => {
              const Icon = getIconComponent(category.icon);
              const isHidden = hiddenCategoryIds.has(category.id);
              return (
                <div key={category.id} className="flex items-center gap-1 group">
                  <button
                    onClick={() => setSelectedCategoryId(category.id)}
                    className={cn(
                      "flex-1 flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm font-medium",
                      selectedCategoryId === category.id 
                        ? "bg-slate-100 text-slate-800" 
                        : "text-slate-600 hover:bg-slate-50",
                      isHidden && "opacity-40"
                    )}
                  >
                    <div 
                      className="w-3 h-3 rounded-full shrink-0" 
                      style={{ backgroundColor: category.color }} 
                    />
                    <span className="flex-1 text-right truncate">{category.name}</span>
                    <Icon className="w-4 h-4 opacity-50 shrink-0" />
                  </button>
                  <div className="flex items-center opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                    <button
                      onClick={() => toggleCategoryVisibility(category.id)}
                      className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                      title={isHidden ? "إظهار" : "إخفاء"}
                    >
                      {isHidden ? <Plus className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => {
                        setEditingCategory(category);
                        setIsCategoryModalOpen(true);
                      }}
                      className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                      title="تعديل التصنيف"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </aside>
      )}

      {/* Main Content */}
      <main className={cn("flex-1 p-4 md:p-8 h-screen overflow-hidden flex flex-col", isFullScreen && "p-0 md:p-0")}>
        <div className={cn("flex items-center justify-between mb-6", isFullScreen && "hidden")}>
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold text-slate-800">الجدول الزمني</h2>
            <div className="flex bg-slate-200 p-1 rounded-xl">
              <button
                onClick={() => setViewMode('month')}
                className={cn(
                  "px-4 py-1.5 text-sm font-bold rounded-lg transition-all",
                  viewMode === 'month' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
              >
                شهري
              </button>
              <button
                onClick={() => setViewMode('timeline')}
                className={cn(
                  "px-4 py-1.5 text-sm font-bold rounded-lg transition-all",
                  viewMode === 'timeline' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
              >
                أسبوعي
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsFullScreen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-bold transition-all shadow-sm"
              title="عرض كامل الشاشة"
            >
              <LayoutGrid className="w-4 h-4" />
              عرض كامل
            </button>
            <button 
              onClick={handleCopyAllLogs}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-bold transition-all shadow-sm"
            >
              <Copy className="w-4 h-4" />
              نسخ السجل
            </button>
            <button 
              onClick={handleExportImage}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-bold transition-all shadow-sm"
            >
              <Download className="w-4 h-4" />
              تصدير كصورة
            </button>
          </div>
        </div>
        <div ref={calendarRef} className="flex-1 overflow-hidden flex flex-col relative">
          {isFullScreen && (
            <button 
              onClick={() => setIsFullScreen(false)}
              className="absolute top-4 left-4 z-[60] p-2 bg-white/80 backdrop-blur shadow-lg rounded-full text-slate-600 hover:text-red-600 transition-all border border-slate-200"
              title="خروج من العرض الكامل"
            >
              <X className="w-6 h-6" />
            </button>
          )}
          {viewMode === 'month' ? (
            <Calendar
              currentDate={currentDate}
              tasks={filteredTasks}
              categories={categories}
              onPrevMonth={handlePrevMonth}
              onNextMonth={handleNextMonth}
              onTaskClick={openEditTaskModal}
              onDayClick={openNewTaskModal}
              onRangeSelect={handleRangeSelect}
              onTaskUpdate={handleTaskUpdate}
            />
          ) : (
            <TimelineView
              currentDate={currentDate}
              tasks={filteredTasks}
              categories={categories}
              onTaskClick={openEditTaskModal}
              onTaskUpdate={handleTaskUpdate}
            />
          )}
        </div>
      </main>

      {/* Modals */}
      <TaskModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        onSave={handleSaveTask}
        onDelete={handleDeleteTask}
        initialData={editingTask}
        categories={categories}
        selectedDate={selectedDateForNewTask}
        selectedEndDate={selectedEndDateForNewTask}
      />

      <CategoryModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        onSave={handleSaveCategory}
        onDelete={handleDeleteCategory}
        initialData={editingCategory}
      />

      <ReasonModal
        isOpen={!!pendingUpdate}
        onClose={() => setPendingUpdate(null)}
        onSubmit={handleReasonSubmit}
      />

      <Toaster position="top-center" />
    </div>
  );
}
