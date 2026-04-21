import React, { useState, useEffect, useMemo } from 'react';
import { cn, ensureDate } from '../lib/utils';
import { Task, Category } from '../types';
import { X, Trash2, Copy, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { format, isSameDay, areIntervalsOverlapping } from 'date-fns';
import { arSA } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { Timestamp } from 'firebase/firestore';
import { useTaskStore } from '../store/useTaskStore';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: Omit<Task, 'id' | 'uid' | 'createdAt' | 'updatedAt'>) => void;
  onDelete?: (id: string) => void;
  initialData?: Task;
  categories: Category[];
  selectedDate?: Date;
  selectedEndDate?: Date;
}

export const TaskModal: React.FC<TaskModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onDelete,
  initialData,
  categories,
  selectedDate,
  selectedEndDate
}) => {
  const { tasks } = useTaskStore();
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const [delayReason, setDelayReason] = useState('');
  const [isApproved, setIsApproved] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setTitle(initialData.title);
        setCategoryId(initialData.categoryId);
        setStartDate(format(ensureDate(initialData.startDate), "yyyy-MM-dd'T'HH:mm"));
        setEndDate(format(ensureDate(initialData.endDate), "yyyy-MM-dd'T'HH:mm"));
        setNotes(initialData.notes || '');
        setDelayReason(initialData.delayReason || '');
        setIsApproved(initialData.isApproved || false);
        setIsCompleted(initialData.isCompleted || false);
      } else {
        setTitle('');
        setCategoryId(categories[0]?.id || '');
        
        const start = selectedDate ? new Date(selectedDate) : new Date();
        start.setHours(9, 0, 0, 0);
        
        const end = selectedEndDate ? new Date(selectedEndDate) : new Date(start);
        end.setHours(17, 0, 0, 0);
        
        setStartDate(format(start, "yyyy-MM-dd'T'HH:mm"));
        setEndDate(format(end, "yyyy-MM-dd'T'HH:mm"));
        setNotes('');
        setDelayReason('');
        setIsApproved(false);
        setIsCompleted(false);
      }
    }
  }, [isOpen, initialData, selectedDate, selectedEndDate, categories]);

  const hasConflict = useMemo(() => {
    if (!categoryId || !startDate || !endDate) return false;
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (start >= end) return false;

    return tasks.some(task => {
      if (task.categoryId !== categoryId) return false;
      if (initialData && task.id === initialData.id) return false; // Ignore self
      
      const taskStart = ensureDate(task.startDate);
      const taskEnd = ensureDate(task.endDate);
      
      return areIntervalsOverlapping(
        { start, end },
        { start: taskStart, end: taskEnd }
      );
    });
  }, [categoryId, startDate, endDate, tasks, initialData]);

  if (!isOpen) return null;

  const isRescheduled = initialData && (
    startDate !== format(ensureDate(initialData.startDate), "yyyy-MM-dd'T'HH:mm") ||
    endDate !== format(ensureDate(initialData.endDate), "yyyy-MM-dd'T'HH:mm")
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !categoryId || !startDate || !endDate) return;
    
    const category = categories.find(c => c.id === categoryId);
    
    const taskData: Omit<Task, 'id' | 'uid' | 'createdAt' | 'updatedAt'> = {
      title,
      categoryId,
      startDate: Timestamp.fromDate(new Date(startDate)),
      endDate: Timestamp.fromDate(new Date(endDate)),
      notes,
      order: initialData?.order ?? tasks.length,
      isChained: category?.isChained ?? false,
      isApproved,
      isCompleted,
    };

    if (isRescheduled) {
      taskData.previousStartDate = initialData.startDate;
      taskData.previousEndDate = initialData.endDate;
      if (delayReason) {
        taskData.delayReason = delayReason;
      }
    } else if (initialData) {
      if (initialData.previousStartDate) taskData.previousStartDate = initialData.previousStartDate;
      if (initialData.previousEndDate) taskData.previousEndDate = initialData.previousEndDate;
      if (initialData.delayReason !== undefined) taskData.delayReason = initialData.delayReason;
    }

    onSave(taskData);
    onClose();
  };

  const handleCopySummary = () => {
    if (!initialData || !delayReason) return;
    
    const oldStart = format(ensureDate(initialData.startDate), 'dd MMMM yyyy', { locale: arSA });
    const newStart = format(new Date(startDate), 'dd MMMM yyyy', { locale: arSA });
    
    const summary = `تم تأجيل المهمة "${title}"\nالموعد السابق: ${oldStart}\nالموعد الجديد: ${newStart}\nالسبب: ${delayReason}`;
    
    navigator.clipboard.writeText(summary).then(() => {
      toast.success('تم نسخ ملخص التأجيل');
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <h3 className="text-lg font-bold text-slate-800">
            {initialData ? 'تعديل المهمة' : 'مهمة جديدة'}
          </h3>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">اسم المهمة</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              placeholder="مثال: تصميم واجهة المستخدم"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">التصنيف</label>
            <select
              required
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            >
              <option value="" disabled>اختر تصنيفاً</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">تاريخ البدء</label>
              <input
                type="datetime-local"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-left"
                dir="ltr"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">تاريخ الانتهاء</label>
              <input
                type="datetime-local"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-left"
                dir="ltr"
              />
            </div>
          </div>

          {hasConflict && (
            <div className="bg-red-50 p-3 rounded-lg border border-red-100 flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">
                يوجد تعارض في الوقت مع مهمة أخرى في نفس التصنيف. يمكنك الحفظ على أي حال، ولكن يرجى الانتباه.
              </p>
            </div>
          )}

          {isRescheduled && (
            <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 space-y-3">
              <div>
                <label className="block text-sm font-medium text-amber-900 mb-1">سبب التأجيل (اختياري)</label>
                <input
                  type="text"
                  value={delayReason}
                  onChange={(e) => setDelayReason(e.target.value)}
                  className="w-full px-4 py-2 border border-amber-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all bg-white"
                  placeholder="لماذا تم تغيير الموعد؟"
                />
              </div>
              {delayReason && (
                <button
                  type="button"
                  onClick={handleCopySummary}
                  className="flex items-center text-amber-700 hover:text-amber-900 text-sm font-medium transition-colors"
                >
                  <Copy className="w-4 h-4 ml-1.5" />
                  نسخ ملخص التأجيل
                </button>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">ملاحظات (اختياري)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-none h-24"
              placeholder="أضف أي تفاصيل إضافية هنا..."
            />
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-xl border border-blue-100">
              <input
                type="checkbox"
                id="isApproved"
                checked={isApproved}
                onChange={(e) => setIsApproved(e.target.checked)}
                className="w-5 h-5 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
              />
              <label htmlFor="isApproved" className="text-sm text-blue-900 cursor-pointer select-none">
                <span className="font-bold block">تعميد المهمة</span>
                <span className="text-xs text-blue-700">بعد التعميد، سيتم رصد أي تغييرات في المواعيد في سجل خاص.</span>
              </label>
            </div>

            <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-xl border border-emerald-100">
              <input
                type="checkbox"
                id="isCompleted"
                checked={isCompleted}
                onChange={(e) => setIsCompleted(e.target.checked)}
                className="w-5 h-5 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
              />
              <label htmlFor="isCompleted" className="text-sm text-emerald-900 cursor-pointer select-none">
                <span className="font-bold block flex items-center gap-1.5">
                  تم تنفيذ المهمة
                  {isCompleted && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                </span>
                <span className="text-xs text-emerald-700">سيتم تمييز المهمة كمنتهية في التقويم.</span>
              </label>
            </div>
          </div>

          {initialData?.changeLogs && initialData.changeLogs.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <Copy className="w-4 h-4" />
                سجل التغييرات بعد التعميد
              </h4>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {initialData.changeLogs.map((log) => (
                  <div key={log.id} className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-xs space-y-1">
                    <div className="flex justify-between text-slate-400">
                      <span>{format(ensureDate(log.timestamp), 'yyyy/MM/dd HH:mm')}</span>
                      <span className="font-bold text-blue-600">
                        {log.type === 'move' ? 'نقل' : 'تغيير حجم'}
                      </span>
                    </div>
                    <div className="text-slate-600">
                      من: {format(ensureDate(log.oldStart), 'dd MMMM')} - {format(ensureDate(log.oldEnd), 'dd MMMM')}
                    </div>
                    <div className="text-slate-800 font-medium">
                      إلى: {format(ensureDate(log.newStart), 'dd MMMM')} - {format(ensureDate(log.newEnd), 'dd MMMM')}
                    </div>
                    {log.reason && <div className="text-amber-700 font-medium">السبب: {log.reason}</div>}
                    {log.notes && <div className="text-slate-500 italic">ملاحظات: {log.notes}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="pt-4 flex items-center justify-between border-t border-slate-100 mt-6">
            {initialData && onDelete ? (
              <button
                type="button"
                onClick={() => {
                  onDelete(initialData.id);
                  onClose();
                }}
                className="flex items-center text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg transition-colors text-sm font-medium"
              >
                <Trash2 className="w-4 h-4 ml-1.5" />
                حذف المهمة
              </button>
            ) : (
              <div></div>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors font-medium"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium shadow-sm"
              >
                حفظ
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
