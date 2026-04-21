import React, { useState } from 'react';
import { useAuth } from '../AuthContext';
import { Calendar as CalendarIcon, Loader2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export const Login: React.FC = () => {
  const { signIn } = useAuth();
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async () => {
    setIsLoggingIn(true);
    setError(null);
    try {
      await signIn();
    } catch (err: any) {
      const message = err.message || 'حدث خطأ غير متوقع';
      setError(message);
      toast.error(message);
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4" dir="rtl">
      <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
        <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-md">
          <CalendarIcon className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-slate-800 mb-2">تقويم المهام</h1>
        <p className="text-slate-500 mb-8">خطط لمهامك ومشاريعك الطويلة بأسلوب بصري واضح.</p>
        
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-700 text-sm text-right">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <button
          onClick={handleSignIn}
          disabled={isLoggingIn}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl py-3 px-4 font-medium transition-all shadow-sm hover:shadow flex items-center justify-center gap-2"
        >
          {isLoggingIn ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              جاري تسجيل الدخول...
            </>
          ) : (
            'تسجيل الدخول باستخدام Google'
          )}
        </button>

        <p className="mt-6 text-xs text-slate-400 leading-relaxed">
          ملاحظة: إذا واجهت مشكلة في تسجيل الدخول أو كان التطبيق يطلب منك الدخول في كل مرة، يرجى التأكد من السماح بالنوافذ المنبثقة (Popups) أو جرب فتح التطبيق في نافذة جديدة.
        </p>

        <button
          onClick={() => window.open(window.location.href, '_blank')}
          className="mt-4 text-sm text-blue-600 hover:underline font-medium"
        >
          فتح التطبيق في نافذة جديدة
        </button>
      </div>
    </div>
  );
};
