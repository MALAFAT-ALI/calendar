import React, { useMemo } from 'react';
import { 
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, 
  eachWeekOfInterval, format, addDays, isSameMonth,
  differenceInDays, isWithinInterval, isToday
} from 'date-fns';
import { arSA } from 'date-fns/locale';
import { Task, Category } from '../types';
import { getIconComponent } from '../constants';
import { cn, ensureDate } from '../lib/utils';
import { Timestamp } from 'firebase/firestore';
import { CheckCircle2 } from 'lucide-react';

interface TimelineViewProps {
  currentDate: Date;
  tasks: Task[];
  categories: Category[];
  onTaskClick: (task: Task) => void;
  onTaskUpdate?: (taskId: string, updates: Record<string, Partial<Task>>) => void;
}

export const TimelineView: React.FC<TimelineViewProps> = ({
  currentDate,
  tasks,
  categories,
  onTaskClick,
  onTaskUpdate
}) => {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const now = new Date();
  
  // Show only one week based on the current date
  const week = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 0 });
    const end = endOfWeek(start, { weekStartsOn: 0 });
    return { start, end };
  }, [currentDate]);

  const timelineStart = week.start;
  const timelineEnd = week.end;
  const totalDays = 7;

  const todayOffset = useMemo(() => {
    if (now < timelineStart || now > timelineEnd) return null;
    return (differenceInDays(now, timelineStart) / totalDays) * 100;
  }, [now, timelineStart, timelineEnd, totalDays]);

  const categoriesWithTasks = useMemo(() => {
    return categories.filter(cat => tasks.some(t => t.categoryId === cat.id));
  }, [categories, tasks]);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full select-none" dir="rtl">
      <div className="flex-1 overflow-auto relative">
        {/* Today Line */}
        {todayOffset !== null && (
          <div 
            className="absolute top-0 bottom-0 w-px bg-red-500 z-50 pointer-events-none"
            style={{ right: `calc(${todayOffset}% * (100% - 192px) / 100% + 192px)` }}
          >
            <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500 shadow-sm" />
          </div>
        )}
        <table className="w-full border-collapse min-w-[800px]">
          <thead className="sticky top-0 z-30 bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="p-4 text-right text-sm font-bold text-slate-500 border-l border-slate-200 w-48 bg-slate-50 sticky right-0 z-40">
                اسم المشروع / التصنيف
              </th>
              {Array.from({ length: 7 }).map((_, i) => {
                const day = addDays(timelineStart, i);
                return (
                  <th key={i} className={cn(
                    "p-4 text-center text-sm font-bold border-l border-slate-200 min-w-[100px]",
                    isToday(day) ? "text-blue-600 bg-blue-50/30" : "text-slate-500"
                  )}>
                    {format(day, 'EEEE', { locale: arSA })}
                    <div className="text-[10px] font-normal mt-1 opacity-60">
                      {format(day, 'd MMM', { locale: arSA })}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {categoriesWithTasks.map(category => {
              const Icon = getIconComponent(category.icon);
              const categoryTasks = tasks.filter(t => t.categoryId === category.id)
                .filter(t => {
                  const tStart = ensureDate(t.startDate);
                  const tEnd = ensureDate(t.endDate);
                  return (tStart <= timelineEnd && tEnd >= timelineStart);
                })
                .sort((a, b) => ensureDate(a.startDate).getTime() - ensureDate(b.startDate).getTime());
              
              if (categoryTasks.length === 0) return null;
              
              // Calculate rows for overlapping tasks
              const rows: Task[][] = [];
              categoryTasks.forEach(task => {
                let placed = false;
                for (let i = 0; i < rows.length; i++) {
                  const lastTaskInRow = rows[i][rows[i].length - 1];
                  if (ensureDate(task.startDate) > ensureDate(lastTaskInRow.endDate)) {
                    rows[i].push(task);
                    placed = true;
                    break;
                  }
                }
                if (!placed) {
                  rows.push([task]);
                }
              });

              const rowHeight = 40;
              const totalHeight = Math.max(80, rows.length * rowHeight + 20);
              
              return (
                <tr key={category.id} className="group border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                  <td className="p-4 border-l border-slate-200 sticky right-0 z-20 bg-white group-hover:bg-slate-50 transition-colors align-top">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-slate-100 text-slate-600 shadow-sm">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-bold text-slate-800 truncate">{category.name}</span>
                        <span className="text-[10px] text-slate-400 font-medium">{categoryTasks.length} مهام</span>
                      </div>
                    </div>
                  </td>
                  <td colSpan={7} className="p-0 relative" style={{ height: `${totalHeight}px` }}>
                    {/* Grid Lines */}
                    <div className="absolute inset-0 flex pointer-events-none">
                      {Array.from({ length: 7 }).map((_, i) => (
                        <div key={i} className="flex-1 border-l border-slate-100 last:border-l-0" />
                      ))}
                    </div>
                    
                    {/* Task Bars */}
                    <div className="absolute inset-0 py-4 px-1">
                      {rows.map((row, rowIndex) => (
                        row.map(task => {
                          const tStart = ensureDate(task.startDate);
                          const tEnd = ensureDate(task.endDate);
                          
                          const startOffset = Math.max(0, differenceInDays(tStart, timelineStart));
                          const endOffset = Math.min(totalDays, differenceInDays(tEnd, timelineStart) + 1);
                          
                          if (endOffset < 0 || startOffset >= totalDays) return null;
                          
                          const right = (startOffset / totalDays) * 100;
                          const width = ((endOffset - startOffset) / totalDays) * 100;
                          
                          return (
                            <div
                              key={task.id}
                              onClick={() => onTaskClick(task)}
                              className={cn(
                                "h-8 rounded-lg flex items-center px-3 text-xs font-bold shadow-sm cursor-pointer hover:scale-[1.01] transition-all border border-black/5 group/task overflow-hidden absolute",
                                task.isCompleted && "opacity-60 grayscale-[0.3]"
                              )}
                              style={{
                                right: `${right}%`,
                                width: `${width}%`,
                                backgroundColor: category.color,
                                color: '#1e293b',
                                top: `${rowIndex * rowHeight + 10}px`
                              }}
                            >
                              {task.isCompleted && (
                                <CheckCircle2 className="w-3.5 h-3.5 ml-1.5 shrink-0 text-emerald-700" />
                              )}
                              <span className={cn("truncate flex-1", task.isCompleted && "line-through decoration-slate-500/50")}>
                                {task.title}
                              </span>
                              {task.isApproved && !task.isCompleted && (
                                <div className="w-2 h-2 rounded-full bg-green-500 shadow-sm ml-1 border border-white" title="معتمد" />
                              )}
                            </div>
                          );
                        })
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
