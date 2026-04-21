import React, { useState, useEffect } from 'react';
import { X, MessageSquare, Clock, Check } from 'lucide-react';
import { cn } from '../lib/utils';
import { collection, query, where, getDocs, addDoc, serverTimestamp, orderBy, limit, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';

interface ReasonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
}

interface SavedReason {
  id: string;
  text: string;
  count: number;
  lastUsed: Timestamp;
}

export const ReasonModal: React.FC<ReasonModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const { user } = useAuth();
  const [reason, setReason] = useState('');
  const [commonReasons, setCommonReasons] = useState<SavedReason[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && user) {
      fetchCommonReasons();
    }
  }, [isOpen, user]);

  const fetchCommonReasons = async () => {
    if (!user) return;
    try {
      const q = query(
        collection(db, 'reasons'),
        where('uid', '==', user.uid),
        orderBy('count', 'desc'),
        limit(5)
      );
      const snapshot = await getDocs(q);
      const reasons = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as SavedReason));
      setCommonReasons(reasons);
    } catch (error) {
      console.error('Error fetching reasons:', error);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!reason.trim() || !user) return;

    setLoading(true);
    try {
      // Save or update reason frequency
      const q = query(
        collection(db, 'reasons'),
        where('uid', '==', user.uid),
        where('text', '==', reason.trim())
      );
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        await addDoc(collection(db, 'reasons'), {
          uid: user.uid,
          text: reason.trim(),
          count: 1,
          lastUsed: serverTimestamp()
        });
      } else {
        const docRef = snapshot.docs[0].ref;
        const currentCount = snapshot.docs[0].data().count || 0;
        // We don't use batch here for simplicity, but we could
        const { updateDoc } = await import('firebase/firestore');
        await updateDoc(docRef, {
          count: currentCount + 1,
          lastUsed: serverTimestamp()
        });
      }

      onSubmit(reason.trim());
      setReason('');
      onClose();
    } catch (error) {
      console.error('Error saving reason:', error);
      // Still submit even if saving reason fails
      onSubmit(reason.trim());
      onClose();
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200" dir="rtl">
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <div className="flex items-center gap-2 text-slate-800">
            <MessageSquare className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold">سبب التغيير</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 block">
              لماذا تم تغيير موعد هذه المهمة المعتمدة؟
            </label>
            <textarea
              autoFocus
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="اكتب السبب هنا..."
              className="w-full h-24 p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none text-sm"
              required
            />
          </div>

          {commonReasons.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                <Clock className="w-3.5 h-3.5" />
                <span>أسباب متكررة (وصول سريع)</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {commonReasons.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setReason(r.text)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-medium transition-all border",
                      reason === r.text 
                        ? "bg-blue-600 border-blue-600 text-white shadow-sm" 
                        : "bg-white border-slate-200 text-slate-600 hover:border-blue-400 hover:text-blue-600"
                    )}
                  >
                    {r.text}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={loading || !reason.trim()}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl transition-all shadow-lg shadow-blue-200 flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Check className="w-5 h-5" />
                  حفظ التغيير
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl transition-all"
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
