import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Logo } from "@/components/Logo";
import { Loader2, AlertCircle, CheckCircle2, Eye, EyeOff, Sparkles, Lock, Shield, Zap, Layers, Mail, ArrowLeft, ArrowRight, Link } from 'lucide-react';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    const password = formData.get('password') as string;
    const confirmPassword = formData.get('confirmPassword') as string;

    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }

    setIsLoading(true);
    try {
      await authApi.resetPassword({ token, password });
      setSuccess(true);
      setTimeout(() => navigate('/auth'), 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to reset password');
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#021B1D] px-4 py-12 font-sans antialiased">
        {/* Background decorative glows */}
        <div className="absolute top-1/4 left-1/4 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#2DD4BF]/15 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 h-96 w-96 translate-x-1/2 translate-y-1/2 rounded-full bg-[#2DD4BF]/10 blur-[100px] pointer-events-none" />

        <div className="relative w-full max-w-md z-10 text-center">
          <div className="mb-8">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#2DD4BF] text-[#021B1D] shadow-lg shadow-[#2DD4BF]/20">
              <div className="w-6 h-6 flex items-center justify-center border-2 border-[#2DD4BF] rounded text-[#2DD4BF] font-bold text-sm">3</div>
            </div>
            <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              ELINA <span className="text-[#2DD4BF]">SMART OS</span>
            </h2>
          </div>

          <div className="rounded-3xl border border-[#2DD4BF]/20 bg-[#021B1D]/60 p-8 shadow-2xl backdrop-blur-xl space-y-6">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-500/10 border border-rose-500/20">
              <AlertCircle className="h-8 w-8 text-rose-500" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-white">Invalid Request</h2>
            <p className="text-sm text-[#8AA1A3] leading-relaxed">System token has expired or is invalid.</p>
            <button
              className="w-full h-[52px] bg-[#2DD4BF] hover:bg-[#20B2A0] text-[#021B1D] font-semibold rounded-xl transition-all duration-300 active:scale-[0.98]"
              onClick={() => navigate('/auth')}
            >
              Return to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#021B1D] px-4 py-12 font-sans antialiased">
      {/* Background decorative glows */}
      <div className="absolute top-1/4 left-1/4 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#2DD4BF]/15 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 h-96 w-96 translate-x-1/2 translate-y-1/2 rounded-full bg-[#2DD4BF]/10 blur-[100px] pointer-events-none" />

      <div className="relative w-full max-w-md z-10">
        {/* Logo & Header */}
        <div className="mb-8 text-center animate-fade-in">
          <Logo className="mx-auto mb-3 h-12 w-12 text-[#2DD4BF] bg-transparent" />
          <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl font-serif uppercase">
            ELINA <span className="text-[#2DD4BF] font-sans font-semibold tracking-wider text-2xl">SMART</span>
          </h2>
          <p className="mt-2 text-sm text-[#8AA1A3]">
            {success ? "Password updated successfully" : "Set your new system credentials"}
          </p>
        </div>

        {/* Card with Glassmorphism */}
        <div className="rounded-3xl border border-[#2DD4BF]/20 bg-[#021B1D]/60 p-8 shadow-2xl backdrop-blur-xl">
          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3.5 text-center text-xs font-medium text-red-400 mb-6">
              {error}
            </div>
          )}

          {success ? (
            <div className="space-y-6 text-center">
              <div className="p-8 border border-emerald-500/20 bg-emerald-500/10 rounded-2xl">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-500/15 rounded-full mb-4">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Success</h3>
                <p className="text-sm text-[#C8DBDC]">Your password was updated successfully. Redirecting you to login...</p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* New Password Input */}
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#C8DBDC]">
                  New Password
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-[#8AA1A3]">
                    <Lock className="h-4 w-4" />
                  </span>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    required
                    disabled={isLoading}
                    className="w-full rounded-xl border border-[#2DD4BF]/20 bg-[#021B1D] py-3 pl-11 pr-12 text-sm text-white placeholder-[#8AA1A3] outline-none transition-all focus:border-[#2DD4BF] focus:ring-2 focus:ring-[#2DD4BF]/25 disabled:opacity-50 h-[52px]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#8AA1A3] hover:text-[#C8DBDC] transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password Input */}
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#C8DBDC]">
                  Verify Password
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-[#8AA1A3]">
                    <Lock className="h-4 w-4" />
                  </span>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirm ? 'text' : 'password'}
                    placeholder="••••••••"
                    required
                    disabled={isLoading}
                    className="w-full rounded-xl border border-[#2DD4BF]/20 bg-[#021B1D] py-3 pl-11 pr-12 text-sm text-white placeholder-[#8AA1A3] outline-none transition-all focus:border-[#2DD4BF] focus:ring-2 focus:ring-[#2DD4BF]/25 disabled:opacity-50 h-[52px]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(v => !v)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#8AA1A3] hover:text-[#C8DBDC] transition-colors"
                  >
                    {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="group flex w-full items-center justify-center gap-2 rounded-xl bg-[#2DD4BF] py-3 text-sm font-semibold text-[#021B1D] shadow-lg shadow-[#2DD4BF]/20 transition-all hover:opacity-95 active:scale-[0.98] disabled:opacity-50 h-[52px]"
              >
                {isLoading ? (
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#021B1D] border-t-transparent" />
                ) : (
                  'Update Password'
                )}
              </button>
            </form>
          )}
        </div>

        {/* Footer Link & Policies */}
        <div className="mt-8 text-center text-xs text-[#8AA1A3] space-y-3">
          <div>
            ELINA OS Security & Encryption Active. Need help? Contact admin.
          </div>
          <div className="flex items-center justify-center gap-2">
            <Link
              to="/privacy"
              className="hover:text-[#C8DBDC] transition-colors underline decoration-[#2DD4BF]/30 underline-offset-2"
            >
              Privacy Policy
            </Link>
            <span className="text-[#2DD4BF]/50">|</span>
            <Link
              to="/terms"
              className="hover:text-[#C8DBDC] transition-colors underline decoration-[#2DD4BF]/30 underline-offset-2"
            >
              Terms of Service
            </Link>
            <span className="text-[#2DD4BF]/50">|</span>
            <Link
              to="/contact"
              className="hover:text-[#C8DBDC] transition-colors underline decoration-[#2DD4BF]/30 underline-offset-2"
            >
              Contact
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
