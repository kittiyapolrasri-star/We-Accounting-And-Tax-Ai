import React, { useState } from 'react';
import { LogIn, Mail, Lock, Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react';
import { signIn, resetPassword } from '../services/auth';

interface Props {
  onLoginSuccess: (user: any) => void;
}

const Login: React.FC<Props> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Validate
    if (!email.trim()) {
      setError('กรุณากรอกอีเมล');
      setLoading(false);
      return;
    }

    if (!resetMode && !password) {
      setError('กรุณากรอกรหัสผ่าน');
      setLoading(false);
      return;
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('รูปแบบอีเมลไม่ถูกต้อง');
      setLoading(false);
      return;
    }

    try {
      if (resetMode) {
        const result = await resetPassword(email);
        if (result.success) {
          setResetSent(true);
        } else {
          setError(result.error || 'ไม่สามารถส่งอีเมลได้');
        }
      } else {
        const result = await signIn(email, password);
        if (result.success && result.user) {
          onLoginSuccess(result.user);
        } else {
          setError(result.error || 'เข้าสู่ระบบไม่สำเร็จ');
        }
      }
    } catch (err) {
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่');
    } finally {
      setLoading(false);
    }
  };

  if (resetSent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Mail className="text-green-600" size={32} />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">ส่งอีเมลเรียบร้อย</h2>
          <p className="text-slate-600 mb-6">
            กรุณาตรวจสอบอีเมล {email} เพื่อรีเซ็ตรหัสผ่าน
          </p>
          <button
            onClick={() => {
              setResetMode(false);
              setResetSent(false);
            }}
            className="text-blue-600 hover:text-blue-800 font-medium"
          >
            กลับไปหน้าเข้าสู่ระบบ
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        {/* Logo & Title */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <img
              src="/icon/S__111992841_0.jpg"
              alt="Company Logo"
              className="w-20 h-20 object-contain rounded-2xl shadow-md"
            />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">WE Accounting & Tax AI</h1>
          <p className="text-slate-500 mt-2">
            {resetMode ? 'รีเซ็ตรหัสผ่าน' : 'เข้าสู่ระบบสำนักงานบัญชี'}
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-start gap-3">
            <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={20} />
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              อีเมล
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                disabled={loading}
              />
            </div>
          </div>

          {/* Password */}
          {!resetMode && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                รหัสผ่าน
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-12 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>
          )}

          {/* Forgot Password Link */}
          {!resetMode && (
            <div className="text-right">
              <button
                type="button"
                onClick={() => {
                  setResetMode(true);
                  setError('');
                }}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                ลืมรหัสผ่าน?
              </button>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <LogIn size={20} />
            )}
            {loading ? 'กำลังดำเนินการ...' : resetMode ? 'ส่งลิงก์รีเซ็ต' : 'เข้าสู่ระบบ'}
          </button>
        </form>

        {/* Back to Login */}
        {resetMode && (
          <button
            onClick={() => {
              setResetMode(false);
              setError('');
            }}
            className="w-full text-center text-slate-600 hover:text-slate-800 mt-4"
          >
            กลับไปหน้าเข้าสู่ระบบ
          </button>
        )}

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-slate-200 text-center">
          <p className="text-xs text-slate-500">
            WE Accounting & Tax AI v1.0
            <br />
            ระบบสำนักงานบัญชีอัตโนมัติ
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
