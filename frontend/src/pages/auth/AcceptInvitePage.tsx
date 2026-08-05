
import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authApi } from '@/lib/api';
import { toast } from 'sonner';
import { Logo } from "@/components/Logo";
import { ShieldCheck, Lock, Loader2, CheckCircle2, Eye, EyeOff, Sparkles, Zap, Layers, Shield, AlertCircle, Mail, ArrowRight } from 'lucide-react';

export default function AcceptInvitePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [userInfo, setUserInfo] = React.useState<any>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [success, setSuccess] = useState(false);

  React.useEffect(() => {
    async function verify() {
      if (!token) {
        setVerifying(false);
        return;
      }
      try {
        const data = await authApi.verifyInvite(token);
        setUserInfo(data);
      } catch (err) {
        toast.error("Invalid or expired invitation link.");
      } finally {
        setVerifying(false);
      }
    }
    verify();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!token) {
      toast.error("Invalid invitation link. Token is missing.");
      return;
    }

    if (password.length < 8) {
      toast.error("Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await authApi.acceptInvite({ token, password });
      toast.success("Welcome! Your account is now active.");
      setSuccess(true);
      setTimeout(() => navigate('/auth'), 2000);
    } catch (error: any) {
      toast.error(error.message || "Failed to accept invitation. The link may be expired.");
    } finally {
      setLoading(false);
    }
  };

  if (verifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#090D1A]">
        <Loader2 className="h-8 w-8 animate-spin text-[#2DD4BF]" />
      </div>
    );
  }

  if (!token || !userInfo) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#090D1A] p-6 selection:bg-[#2DD4BF] selection:text-[#021B1D] font-sans antialiased relative overflow-hidden">
        {/* Decorative ambient background glows */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-[#2DD4BF]/15 blur-[120px] pointer-events-none" />

        <div className="w-full max-w-[440px] bg-[#021B1D]/60 border border-[#2DD4BF]/20 rounded-[28px] p-8 md:p-10 space-y-8 text-center backdrop-blur-xl z-10">
          <div className="flex flex-col items-center justify-center gap-3">
            <Logo className="h-12 w-12 text-[#2DD4BF] bg-transparent" />
            <h1 className="text-2xl font-bold tracking-tight text-white mt-2 font-serif uppercase">
              ELINA <span className="text-[#2DD4BF] font-sans font-semibold tracking-wider text-xl">SMART</span>
            </h1>
          </div>

          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-rose-500/10 border border-rose-500/20">
            <AlertCircle className="h-8 w-8 text-rose-500" />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-white">Invalid Invitation</h2>
          <p className="text-sm text-[#8AA1A3] leading-relaxed">This invitation link is invalid or has expired.</p>
          <button
            className="w-full h-[50px] bg-[#2DD4BF] hover:bg-[#20B2A0] text-[#021B1D] font-semibold rounded-xl transition-all duration-300 active:scale-[0.98]"
            onClick={() => navigate('/auth')}
          >
            Return to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#090D1A] p-6 selection:bg-[#2DD4BF] selection:text-[#021B1D] font-sans antialiased relative overflow-hidden">
      {/* Decorative ambient background glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-[#2DD4BF]/15 blur-[120px] pointer-events-none" />

      {/* Header section matching screenshot */}
      <div className="mb-2 flex items-center justify-center gap-4">
          <svg
            viewBox="22 18 56 64"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="h-16 w-16 text-white shrink-0"
          >
            <path
              d="M 32 32 C 32 24, 68 24, 68 32 C 68 40, 32 40, 32 50 C 32 60, 68 60, 68 70 C 68 80, 32 80, 32 70"
              stroke="currentColor"
              strokeWidth="8.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M 32 32 L 68 32"
              stroke="currentColor"
              strokeWidth="8.5"
              strokeLinecap="round"
            />
            <path
              d="M 32 50 L 58 50"
              stroke="currentColor"
              strokeWidth="8.5"
              strokeLinecap="round"
            />
            <path
              d="M 32 70 L 68 70"
              stroke="currentColor"
              strokeWidth="8.5"
              strokeLinecap="round"
            />
          </svg>

          <div className="text-left">
            <h1 className="text-4xl font-serif font-bold tracking-[0.2em] text-white">
              ELINA
            </h1>
            <p className="mt-1 text-lg uppercase tracking-[0.4em] text-[#2DD4BF]">
              Smart
            </p>
          </div>
        </div>
        <p className="text-sm text-[#8AA1A3] font-medium mb-2">
          {success ? "Verification complete" : `Welcome, ${userInfo.full_name || 'User'}! Set up your credentials to activate your workspace.`}
        </p>

      {/* Form Card matching screenshot */}
      <div className="w-full max-w-[480px] bg-[#021B1D]/60 border border-[#2DD4BF]/20 rounded-[28px] p-8 md:p-10 z-10 backdrop-blur-xl relative">
        {success ? (
          <div className="space-y-6 text-center py-4">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-500/15 border border-emerald-500/20 rounded-full mb-4 animate-bounce">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Account Activated!</h3>
            <p className="text-sm text-[#8AA1A3] leading-relaxed">Your password has been set successfully. Redirecting you to the workspace login shortly.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email field (Read Only) */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-[#C8DBDC] block">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#8AA1A3]">
                  <Mail className="h-5 w-5" />
                </div>
                <input
                  type="email"
                  value={userInfo.email}
                  disabled
                  className="h-[40px] w-full pl-11 pr-4 bg-[#021B1D] border border-[#2DD4BF]/20 text-[#8AA1A3] focus:outline-none rounded-[16px] text-sm font-semibold cursor-not-allowed"
                />
              </div>
            </div>

            {/* New Password field */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-[#C8DBDC] block">
                New Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#8AA1A3]">
                  <Lock className="h-5 w-5" />
                </div>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Min 8 characters"
                  className="h-[40px] w-full pl-11 pr-12 border border-[#2DD4BF]/20 bg-[#021B1D] text-white focus:outline-none focus:border-[#2DD4BF] focus:ring-2 focus:ring-[#2DD4BF]/25 rounded-[16px] text-sm font-semibold placeholder:text-[#8AA1A3]"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#8AA1A3] hover:text-[#C8DBDC] transition-colors"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* Confirm Password field */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-[#C8DBDC] block">
                Confirm Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#8AA1A3]">
                  <Lock className="h-5 w-5" />
                </div>
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Re-type password"
                  className="h-[40px] w-full pl-11 pr-12 border border-[#2DD4BF]/20 bg-[#021B1D] text-white focus:outline-none focus:border-[#2DD4BF] focus:ring-2 focus:ring-[#2DD4BF]/25 rounded-[16px] text-sm font-semibold placeholder:text-[#8AA1A3]"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#8AA1A3] hover:text-[#C8DBDC] transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="group flex w-full items-center justify-center gap-2 rounded-xl bg-[#2DD4BF] py-3 text-sm font-semibold text-[#021B1D] shadow-lg shadow-[#2DD4BF]/20 transition-all hover:opacity-95 active:scale-[0.98] disabled:opacity-50 h-[52px]"
              disabled={loading}
            >
              {loading ? (
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#021B1D] border-t-transparent" />
              ) : (
                <>
                  Activate Account & Sign In
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </>
              )}
            </button>
          </form>
        )}
      </div>

      {/* Footer block matching screenshot */}
      <div className="text-center mt-8 z-10 text-xs text-[#8AA1A3]">
        <p>
          ELINA OS Security & Encryption Active. Need help? Contact admin.
        </p>
      </div>
    </div>
  );
}
