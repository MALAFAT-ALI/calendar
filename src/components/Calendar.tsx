import React, { useState, useMemo, useCallback } from 'react';
import { 
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, 
  eachDayOfInterval, format, isSameMonth, isToday, 
  differenceInDays, differenceInHours, addDays,
  isSameDay
} from 'date-fns';
import { arSA } from 'date-fns/locale';
import { Task, Category } from '../types';
import { getIconComponent } from '../constants';
import { cn, ensureDate } from '../lib/utils';
import { ChevronRight, ChevronLeft, CheckCircle2 } from 'lucide-react';
import { 
  DndContext, 
  DragOverlay, 
  closestCenter, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
  rectIntersection,
  CollisionDetection,
  useDroppable
} from '@dnd-kit/core';
import { 
  arrayMove, 
  SortableContext, 
  sortableKeyboardCoordinates, 
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Timestamp } from 'firebase/firestore';
import { useTaskStore } from '../store/useTaskStore';

interface CalendarProps {
  currentDate: Date;
  tasks: Task[];
  categories: Category[];
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onTaskClick: (task: Task) => void;
  onDayClick: (date: Date) => void;
  onRangeSelect?: (start: Date, end: Date) => void;
  onTaskUpdate?: (taskId: string, updates: Record<string, Partial<Task>>) => void;
}

const DayCell: React.FC<{ 
  day: Date; 
  monthStart: Date; 
  isSelected: boolean; 
  onMouseDown: () => void; 
  onMouseEnter: () => void 
}> = ({ day, monthStart, isSelected, onMouseDown, onMouseEnter }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: `day-${day.toISOString()}`,
    data: { type: 'day', date: day }
  });

  return (
    <div 
      ref={setNodeRef}
      className={cn(
        "bg-white p-2 relative transition-colors cursor-pointer min-h-[100px]",
        !isSameMonth(day, monthStart) && "text-slate-400 bg-slate-50/50",
        isToday(day) && "bg-blue-50/30",
        isSelected && "bg-blue-100/50",
        isOver && "bg-blue-200/50"
      )}
      onMouseDown={onMouseDown}
      onMouseEnter={onMouseEnter}
    >
      <div className={cn(
        "text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full",
        isToday(day) && "bg-blue-600 text-white"
      )}>
        {format(day, 'd')}
      </div>
    </div>
  );
};

const TaskBar: React.FC<{
  task: Task;
  category?: Category;
  startIndex: number;
  span: number;
  rowIndex: number;
  isGhost?: boolean;
  onClick: () => void;
  onResize: (taskId: string, deltaDays: number, type: 'start' | 'end') => void;
  onResizeEnd: (taskId: string, deltaDays: number, type: 'start' | 'end') => void;
}> = ({ task, category, startIndex, span, rowIndex, isGhost, onClick, onResize, onResizeEnd }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: task.id, data: { task, categoryId: task.categoryId } });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    width: `calc(${span} / 7 * 100% - 4px)`,
    right: `calc(${startIndex} / 7 * 100% + 2px)`,
    top: `${rowIndex * 32}px`,
    zIndex: isDragging ? 50 : 10,
    opacity: isDragging ? 0.5 : 1,
  };

  const color = category?.color || '#cbd5e1';
  const Icon = getIconComponent(category?.icon || 'Circle');

  if (isGhost) {
    return (
      <div
        className="pointer-events-none absolute h-7"
        style={{
          width: `calc(${span} / 7 * 100% - 4px)`,
          right: `calc(${startIndex} / 7 * 100% + 2px)`,
          top: `${rowIndex * 32}px`,
        }}
      >
        <div 
          className="h-full rounded-md flex items-center px-2 text-xs font-medium border-2 border-dashed opacity-40"
          style={{ borderColor: color, color: '#64748b' }}
        >
          <Icon className="w-3.5 h-3.5 ml-1.5 shrink-0" />
          <span className="truncate flex-1">{task.title} (سابقاً)</span>
        </div>
      </div>
    );
  }

  const tEnd = ensureDate(task.endDate);
  const now = new Date();
  const isOngoing = tEnd > now;
  const endsToday = isToday(tEnd);
  
  let timeRemaining = '';
  if (isOngoing) {
    const daysLeft = differenceInDays(tEnd, now);
    if (daysLeft > 0) {
      timeRemaining = `${daysLeft} يوم`;
    } else {
      const hoursLeft = differenceInHours(tEnd, now);
      if (hoursLeft > 0) {
        timeRemaining = `${hoursLeft} ساعة`;
      } else {
        timeRemaining = 'ينتهي قريباً';
      }
    }
  }

  const handleResizeStart = (e: React.PointerEvent, type: 'start' | 'end') => {
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    const initialDelta = 0;
    
    // Capture the container width at the start of the resize
    const container = e.currentTarget.parentElement?.parentElement as HTMLElement;
    if (!container) return;
    const containerWidth = container.offsetWidth;

    let currentDelta = 0;
    
    const onPointerMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startX;
      // Approximate day width: container width / 7
      const dayWidth = containerWidth / 7;
      // In RTL, moving right (positive deltaX) means moving towards the past (negative deltaDays)
      const deltaDays = Math.round(deltaX / dayWidth) * -1;
      
      if (deltaDays !== currentDelta) {
        currentDelta = deltaDays;
        onResize(task.id, deltaDays, type);
      }
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      onResizeEnd(task.id, currentDelta, type);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="pointer-events-auto absolute h-7 group"
      {...attributes}
      {...listeners}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <div 
        className={cn(
          "h-full rounded-md flex items-center px-2 text-xs font-medium shadow-sm transition-transform hover:scale-[1.01] hover:shadow-md cursor-grab active:cursor-grabbing overflow-hidden border border-black/5 relative",
          endsToday && !task.isCompleted && "ring-2 ring-red-400 animate-pulse",
          task.isCompleted && "opacity-60 grayscale-[0.3]"
        )}
        style={{ backgroundColor: color, color: '#1e293b' }}
      >
        {/* Resize Handles */}
        {!task.isCompleted && (
          <>
            <div 
              className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize opacity-0 group-hover:opacity-100 bg-black/10 hover:bg-black/20 transition-opacity"
              onPointerDown={(e) => handleResizeStart(e, 'end')}
            />
            <div 
              className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize opacity-0 group-hover:opacity-100 bg-black/10 hover:bg-black/20 transition-opacity"
              onPointerDown={(e) => handleResizeStart(e, 'start')}
            />
          </>
        )}

        {task.isCompleted ? (
          <CheckCircle2 className="w-3.5 h-3.5 ml-1.5 shrink-0 text-emerald-700" />
        ) : (
          <Icon className="w-3.5 h-3.5 ml-1.5 shrink-0 opacity-70" />
        )}
        <span className={cn("truncate flex-1", task.isCompleted && "line-through decoration-slate-500/50")}>
          {task.title}
        </span>
        {timeRemaining && !task.isCompleted && (
          <span className="mr-2 text-[10px] bg-white/40 px-1.5 py-0.5 rounded-sm shrink-0">
            {timeRemaining}
          </span>
        )}
      </div>
    </div>
  );
};

export const Calendar: React.FC<CalendarProps> = ({
  currentDate,
  tasks,
  categories,
  onPrevMonth,
  onNextMonth,
  onTaskClick,
  onDayClick,
  onRangeSelect,
  onTaskUpdate
}) => {
  const { updateTaskOptimistically, persistTaskUpdates, recalculateChainedTasks, moveTaskToDate } = useTaskStore();
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 0 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const days = eachDayOfInterval({ start: startDate, end: endDate });
  
  const weeks = useMemo(() => {
    const w = [];
    for (let i = 0; i < days.length; i += 7) {
      w.push(days.slice(i, i + 7));
    }
    return w;
  }, [days]);

  const weekDays = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

  const [dragStart, setDragStart] = useState<Date | null>(null);
  const [dragCurrent, setDragCurrent] = useState<Date | null>(null);

  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const activeTask = tasks.find(t => t.id === active.id);
    if (!activeTask) return;

    // Case 1: Dropped on a day (Move to date)
    if (over.data.current?.type === 'day') {
      const newDate = over.data.current.date;
      
      const currentStart = ensureDate(activeTask.startDate);
      const currentEnd = ensureDate(activeTask.endDate);
      const duration = currentEnd.getTime() - currentStart.getTime();
      const newEndDate = new Date(newDate.getTime() + duration);

      const updates = {
        [activeTask.id]: {
          startDate: Timestamp.fromDate(newDate),
          endDate: Timestamp.fromDate(newEndDate),
          previousStartDate: activeTask.startDate,
          previousEndDate: activeTask.endDate,
        }
      };

      if (onTaskUpdate) {
        onTaskUpdate(activeTask.id, updates);
      } else {
        moveTaskToDate(activeTask.id, newDate);
      }
      return;
    }

    // Case 2: Dropped on another task (Reorder)
    if (active.id !== over.id) {
      const overTask = tasks.find(t => t.id === over.id);
      if (overTask && activeTask.categoryId === overTask.categoryId) {
        const oldOrder = activeTask.order;
        const newOrder = overTask.order;

        const updates: Record<string, Partial<Task>> = {
          [activeTask.id]: { order: newOrder },
          [overTask.id]: { order: oldOrder }
        };

        // Optimistic update
        updateTaskOptimistically(activeTask.id, { order: newOrder });
        updateTaskOptimistically(overTask.id, { order: oldOrder });

        // Persist
        persistTaskUpdates(updates).then(() => {
          recalculateChainedTasks(activeTask.categoryId);
        });
      }
    }
  };

  const handleResize = useCallback((taskId: string, deltaDays: number, type: 'start' | 'end') => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const currentStart = ensureDate(task.startDate);
    const currentEnd = ensureDate(task.endDate);

    let newStart = currentStart;
    let newEnd = currentEnd;

    if (type === 'start') {
      newStart = addDays(currentStart, deltaDays);
    } else {
      newEnd = addDays(currentEnd, deltaDays);
    }

    // Validation
    if (newEnd < newStart) return;

    const updates = {
      startDate: Timestamp.fromDate(newStart),
      endDate: Timestamp.fromDate(newEnd)
    };

    updateTaskOptimistically(taskId, updates);
  }, [tasks, updateTaskOptimistically]);

  const handleResizeEnd = useCallback((taskId: string, deltaDays: number, type: 'start' | 'end') => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const currentStart = ensureDate(task.startDate);
    const currentEnd = ensureDate(task.endDate);

    let newStart = currentStart;
    let newEnd = currentEnd;

    if (type === 'start') {
      newStart = addDays(currentStart, deltaDays);
    } else {
      newEnd = addDays(currentEnd, deltaDays);
    }

    // Validation
    if (newEnd < newStart) return;

    const updates = {
      startDate: Timestamp.fromDate(newStart),
      endDate: Timestamp.fromDate(newEnd)
    };
    
    const finalUpdates = { [taskId]: updates };
    
    if (onTaskUpdate) {
      onTaskUpdate(taskId, finalUpdates);
    } else {
      persistTaskUpdates(finalUpdates).then(() => {
        recalculateChainedTasks(task.categoryId);
      });
    }
  }, [tasks, persistTaskUpdates, recalculateChainedTasks, onTaskUpdate]);

  const handleMouseDown = (date: Date) => {
    setDragStart(date);
    setDragCurrent(date);
  };

  const handleMouseEnter = (date: Date) => {
    if (dragStart) {
      setDragCurrent(date);
    }
  };

  const handleMouseUp = () => {
    if (dragStart && dragCurrent && onRangeSelect) {
      const start = dragStart < dragCurrent ? dragStart : dragCurrent;
      const end = dragStart > dragCurrent ? dragStart : dragCurrent;
      
      if (start.getTime() !== end.getTime()) {
        onRangeSelect(start, end);
      } else {
        onDayClick(start);
      }
    }
    setDragStart(null);
    setDragCurrent(null);
  };

  const isDateInSelection = (date: Date) => {
    if (!dragStart || !dragCurrent) return false;
    const start = dragStart < dragCurrent ? dragStart : dragCurrent;
    const end = dragStart > dragCurrent ? dragStart : dragCurrent;
    return date >= start && date <= end;
  };

  return (
    <DndContext 
      sensors={sensors}
      collisionDetection={rectIntersection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div 
        className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full select-none"
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/50">
          <h2 className="text-2xl font-bold text-slate-800">
            {format(currentDate, 'MMMM yyyy', { locale: arSA })}
          </h2>
          <div className="flex items-center gap-2">
            <button onClick={onPrevMonth} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-600">
              <ChevronRight className="w-5 h-5" />
            </button>
            <button onClick={onNextMonth} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-600">
              <ChevronLeft className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Weekdays */}
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
          {weekDays.map(day => (
            <div key={day} className="py-3 text-center text-sm font-semibold text-slate-500">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          {weeks.map((week, weekIdx) => {
            const weekStart = week[0];
            const weekEnd = week[6];

            const weekTasks = tasks.filter(task => {
              const tStart = ensureDate(task.startDate);
              const tEnd = ensureDate(task.endDate);
              return tStart <= weekEnd && tEnd >= weekStart;
            });

            const ghostTasks = tasks.filter(task => {
              if (!task.previousStartDate || !task.previousEndDate) return false;
              const tStart = ensureDate(task.previousStartDate);
              const tEnd = ensureDate(task.previousEndDate);
              return tStart <= weekEnd && tEnd >= weekStart;
            });

            const rowOccupied: boolean[][] = Array(20).fill(null).map(() => Array(7).fill(false));

            const sortedWeekTasks = [...weekTasks].sort((a, b) => {
              if (a.order !== b.order) return a.order - b.order;
              return ensureDate(a.startDate).getTime() - ensureDate(b.startDate).getTime();
            });

            const taskLayouts = sortedWeekTasks.map(task => {
              const tStart = ensureDate(task.startDate);
              const tEnd = ensureDate(task.endDate);
              
              let startIndex = 0;
              if (tStart > weekStart) {
                startIndex = differenceInDays(tStart, weekStart);
              }
              
              let endIndex = 6;
              if (tEnd < weekEnd) {
                endIndex = Math.min(6, differenceInDays(tEnd, weekStart));
              }
              
              const span = endIndex - startIndex + 1;
              
              let rowIndex = 0;
              while (true) {
                let isFree = true;
                for (let i = startIndex; i <= endIndex; i++) {
                  if (rowOccupied[rowIndex][i]) {
                    isFree = false;
                    break;
                  }
                }
                if (isFree) break;
                rowIndex++;
              }
              
              for (let i = startIndex; i <= endIndex; i++) {
                rowOccupied[rowIndex][i] = true;
              }
              
              return { task, startIndex, span, rowIndex, isGhost: false };
            });

            const ghostLayouts = ghostTasks.map(task => {
              const tStart = ensureDate(task.previousStartDate);
              const tEnd = ensureDate(task.previousEndDate);
              
              let startIndex = 0;
              if (tStart > weekStart) {
                startIndex = differenceInDays(tStart, weekStart);
              }
              
              let endIndex = 6;
              if (tEnd < weekEnd) {
                endIndex = Math.min(6, differenceInDays(tEnd, weekStart));
              }
              
              const span = endIndex - startIndex + 1;
              
              let rowIndex = 0;
              while (true) {
                let isFree = true;
                for (let i = startIndex; i <= endIndex; i++) {
                  if (rowOccupied[rowIndex][i]) {
                    isFree = false;
                    break;
                  }
                }
                if (isFree) break;
                rowIndex++;
              }
              
              for (let i = startIndex; i <= endIndex; i++) {
                rowOccupied[rowIndex][i] = true;
              }
              
              return { task, startIndex, span, rowIndex, isGhost: true };
            });

            const allLayouts = [...taskLayouts, ...ghostLayouts];
            const maxRowIndex = Math.max(0, ...allLayouts.map(l => l.rowIndex));
            const minHeight = Math.max(120, (maxRowIndex + 1) * 32 + 40);

            return (
              <div 
                key={week[0].toISOString()} 
                className="grid grid-cols-7 gap-px bg-slate-200 border-b border-slate-200 last:border-b-0 relative"
                style={{ minHeight: `${minHeight}px` }}
              >
                {/* Days Background */}
                {week.map((day) => (
                  <DayCell
                    key={day.toISOString()}
                    day={day}
                    monthStart={monthStart}
                    isSelected={isDateInSelection(day)}
                    onMouseDown={() => handleMouseDown(day)}
                    onMouseEnter={() => handleMouseEnter(day)}
                  />
                ))}
                
                {/* Task Bars */}
                <div className="absolute top-10 left-0 right-0 bottom-0 pointer-events-none px-1">
                  <SortableContext items={sortedWeekTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                    {allLayouts.map(({ task, startIndex, span, rowIndex, isGhost }) => (
                      <TaskBar
                        key={isGhost ? `ghost-${task.id}` : task.id}
                        task={task}
                        category={categories.find(c => c.id === task.categoryId)}
                        startIndex={startIndex}
                        span={span}
                        rowIndex={rowIndex}
                        isGhost={isGhost}
                        onClick={() => onTaskClick(task)}
                        onResize={handleResize}
                        onResizeEnd={handleResizeEnd}
                      />
                    ))}
                  </SortableContext>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <DragOverlay>
        {activeId ? (
          <div className="opacity-80 scale-105 transition-transform pointer-events-none">
            <div 
              className="h-7 rounded-md px-2 flex items-center gap-1.5 shadow-lg"
              style={{ backgroundColor: categories.find(c => c.id === tasks.find(t => t.id === activeId)!.categoryId)?.color || '#e2e8f0' }}
            >
              {(() => {
                const task = tasks.find(t => t.id === activeId)!;
                const category = categories.find(c => c.id === task.categoryId);
                const Icon = category ? getIconComponent(category.icon) : null;
                return (
                  <>
                    {Icon && <Icon className="w-3.5 h-3.5 shrink-0" />}
                    <span className="text-xs font-bold truncate text-slate-800">
                      {task.title}
                    </span>
                  </>
                );
              })()}
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};
