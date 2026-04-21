import React, { useState, useEffect } from 'react';
import { Category } from '../types';
import { X, Check, Trash2 } from 'lucide-react';
import { PASTEL_COLORS, VIBRANT_COLORS, MEDIUM_COLORS, BUSINESS_ICONS, DAILY_LIFE_ICONS, getIconComponent } from '../constants';
import { cn } from '../lib/utils';

interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (category: Omit<Category, 'id' | 'uid'>) => void;
  onDelete?: (id: string) => void;
  initialData?: Category;
}

export const CategoryModal: React.FC<CategoryModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onDelete,
  initialData
}) => {
  const [name, setName] = useState('');
  const [color, setColor] = useState(PASTEL_COLORS[0]);
  const [icon, setIcon] = useState(BUSINESS_ICONS[0]);
  const [isChained, setIsChained] = useState(false);
  const [activeTab, setActiveTab] = useState<'business' | 'daily'>('business');

  const [colorTab, setColorTab] = useState<'pastel' | 'medium' | 'vibrant'>('pastel');

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setName(initialData.name);
        setColor(initialData.color);
        setIcon(initialData.icon);
        setIsChained(initialData.isChained || false);
        setActiveTab(BUSINESS_ICONS.includes(initialData.icon) ? 'business' : 'daily');
        
        if (PASTEL_COLORS.includes(initialData.color)) {
          setColorTab('pastel');
        } else if (MEDIUM_COLORS.includes(initialData.color)) {
          setColorTab('medium');
        } else {
          setColorTab('vibrant');
        }
      } else {
        setName('');
        setColor(PASTEL_COLORS[Math.floor(Math.random() * PASTEL_COLORS.length)]);
        setIcon(BUSINESS_ICONS[0]);
        setIsChained(false);
        setColorTab('pastel');
      }
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    onSave({ name, color, icon, isChained });
    onClose();
  };

  const iconsToDisplay = activeTab === 'business' ? BUSINESS_ICONS : DAILY_LIFE_ICONS;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <h3 className="text-lg font-bold text-slate-800">
            {initialData ? 'تعديل التصنيف' : 'تصنيف جديد'}
          </h3>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">اسم التصنيف</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              placeholder="مثال: تصميم الشعارات"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">اللون</label>
            <div className="flex bg-slate-100 p-1 rounded-lg mb-3">
              <button
                type="button"
                onClick={() => setColorTab('pastel')}
                className={cn(
                  "flex-1 py-1.5 text-sm font-medium rounded-md transition-colors",
                  colorTab === 'pastel' ? "bg-white shadow-sm text-slate-800" : "text-slate-500 hover:text-slate-700"
                )}
              >
                هادئة
              </button>
              <button
                type="button"
                onClick={() => setColorTab('medium')}
                className={cn(
                  "flex-1 py-1.5 text-sm font-medium rounded-md transition-colors",
                  colorTab === 'medium' ? "bg-white shadow-sm text-slate-800" : "text-slate-500 hover:text-slate-700"
                )}
              >
                متوسطة
              </button>
              <button
                type="button"
                onClick={() => setColorTab('vibrant')}
                className={cn(
                  "flex-1 py-1.5 text-sm font-medium rounded-md transition-colors",
                  colorTab === 'vibrant' ? "bg-white shadow-sm text-slate-800" : "text-slate-500 hover:text-slate-700"
                )}
              >
                حيوية
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {(() => {
                if (colorTab === 'pastel') return PASTEL_COLORS;
                if (colorTab === 'medium') return MEDIUM_COLORS;
                return VIBRANT_COLORS;
              })().map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center transition-transform hover:scale-110",
                    color === c ? "ring-2 ring-offset-2 ring-slate-400" : "border border-black/5"
                  )}
                  style={{ backgroundColor: c }}
                >
                  {color === c && <Check className={cn("w-4 h-4", colorTab === 'pastel' ? "text-slate-800" : "text-white")} />}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">الأيقونة</label>
            <div className="flex bg-slate-100 p-1 rounded-lg mb-3">
              <button
                type="button"
                onClick={() => setActiveTab('business')}
                className={cn(
                  "flex-1 py-1.5 text-sm font-medium rounded-md transition-colors",
                  activeTab === 'business' ? "bg-white shadow-sm text-slate-800" : "text-slate-500 hover:text-slate-700"
                )}
              >
                الأعمال
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('daily')}
                className={cn(
                  "flex-1 py-1.5 text-sm font-medium rounded-md transition-colors",
                  activeTab === 'daily' ? "bg-white shadow-sm text-slate-800" : "text-slate-500 hover:text-slate-700"
                )}
              >
                الحياة اليومية
              </button>
            </div>
            
            <div className="grid grid-cols-6 gap-2">
              {iconsToDisplay.map(iconName => {
                const Icon = getIconComponent(iconName);
                return (
                  <button
                    key={iconName}
                    type="button"
                    onClick={() => setIcon(iconName)}
                    className={cn(
                      "aspect-square flex items-center justify-center rounded-lg border transition-all hover:bg-slate-50",
                      icon === iconName 
                        ? "border-blue-500 bg-blue-50 text-blue-600" 
                        : "border-slate-200 text-slate-600"
                    )}
                  >
                    <Icon className="w-4 h-4" />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
            <input
              type="checkbox"
              id="isChained"
              checked={isChained}
              onChange={(e) => setIsChained(e.target.checked)}
              className="w-5 h-5 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
            />
            <label htmlFor="isChained" className="text-sm text-slate-700 cursor-pointer select-none">
              <span className="font-medium block">تفعيل التسلسل التلقائي</span>
              <span className="text-xs text-slate-500">المهام في هذا التصنيف ستتم إزاحتها تلقائياً عند تأخير إحداها.</span>
            </label>
          </div>

          <div className="pt-4 flex items-center justify-between border-t border-slate-100 mt-6">
            {initialData && onDelete ? (
              <button
                type="button"
                onClick={() => {
                  onDelete(initialData.id);
                  onClose();
                }}
                className="flex items-center text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg transition-colors text-sm font-medium"
                title="سيتم حذف جميع المهام المرتبطة بهذا التصنيف"
              >
                <Trash2 className="w-4 h-4 ml-1.5" />
                حذف
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
