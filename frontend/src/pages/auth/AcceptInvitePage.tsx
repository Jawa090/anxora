
import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authApi } from '@/lib/api';
import { toast } from 'sonner';
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
        <Loader2 className="h-8 w-8 animate-spin text-[#7D5CE4]" />
      </div>
    );
  }

  if (!token || !userInfo) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#090D1A] p-6 selection:bg-[#7D5CE4] selection:text-white font-sans antialiased relative overflow-hidden">
        {/* Decorative ambient background glows */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-[#7D5CE4]/10 blur-[120px] pointer-events-none" />

        <div className="w-full max-w-[440px] bg-white/[0.03] border border-white/10 rounded-[28px] p-8 md:p-10 space-y-8 text-center backdrop-blur-xl z-10">
          <div className="flex flex-col items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#7D5CE4]/20 border border-[#7D5CE4]/35 flex items-center justify-center shadow-lg shadow-purple-500/10">
              <Sparkles className="w-6 h-6 text-[#7D5CE4]" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white mt-2">
              Anxora<span className="text-[#7D5CE4]">OS</span>
            </h1>
          </div>

          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-rose-500/10 border border-rose-500/20">
            <AlertCircle className="h-8 w-8 text-rose-500" />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-white">Invalid Invitation</h2>
          <p className="text-sm text-slate-400 leading-relaxed">This invitation link is invalid or has expired.</p>
          <button
            className="w-full h-[50px] bg-gradient-to-r from-[#7D5CE4] to-[#633BB2] hover:from-[#8B6BEB] hover:to-[#7147C4] text-white font-semibold rounded-xl transition-all duration-300 active:scale-[0.98]"
            onClick={() => navigate('/auth')}
          >
            Return to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#090D1A] p-6 selection:bg-[#7D5CE4] selection:text-white font-sans antialiased relative overflow-hidden">
      {/* Decorative ambient background glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-[#7D5CE4]/10 blur-[120px] pointer-events-none" />

      {/* Header section matching screenshot */}
      <div className="flex flex-col items-center justify-center mb-8 z-10">
        <div className="w-12 h-12 rounded-2xl bg-[#7D5CE4]/20 border border-[#7D5CE4]/35 flex items-center justify-center shadow-lg shadow-[#7D5CE4]/20 mb-4 animate-bounce">
          <Sparkles className="w-6 h-6 text-[#7D5CE4]" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-white mb-2">
          Anxora<span className="text-[#8B5CF6]">OS</span>
        </h1>
        <p className="text-sm text-slate-400 font-medium">
          {success ? "Verification complete" : `Welcome, ${userInfo.full_name || 'User'}! Set up your credentials to activate your workspace.`}
        </p>
      </div>

      {/* Form Card matching screenshot */}
      <div className="w-full max-w-[480px] bg-white/[0.03] border border-white/10 rounded-[28px] p-8 md:p-10 z-10 backdrop-blur-xl relative">
        {success ? (
          <div className="space-y-6 text-center py-4">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-500/15 border border-emerald-500/20 rounded-full mb-4 animate-bounce">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Account Activated!</h3>
            <p className="text-sm text-slate-400 leading-relaxed">Your password has been set successfully. Redirecting you to the workspace login shortly.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email field (Read Only) */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 block">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500">
                  <Mail className="h-5 w-5" />
                </div>
                <input 
                  type="email"
                  value={userInfo.email}
                  disabled
                  className="h-[52px] w-full pl-11 pr-4 bg-slate-900/50 border border-white/10 text-slate-400 focus:outline-none rounded-[16px] text-sm font-semibold cursor-not-allowed"
                />
              </div>
            </div>

            {/* New Password field */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 block">
                New Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#8A8E98]">
                  <Lock className="h-5 w-5" />
                </div>
                <input 
                  id="password"
                  type={showPassword ? "text" : "password"} 
                  placeholder="Min 8 characters" 
                  className="h-[52px] w-full pl-11 pr-12 border border-white/10 bg-slate-900/50 text-white focus:outline-none focus:border-[#7D5CE4] focus:ring-2 focus:ring-[#7D5CE4]/25 rounded-[16px] text-sm font-semibold placeholder:text-slate-500"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* Confirm Password field */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 block">
                Confirm Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#8A8E98]">
                  <Lock className="h-5 w-5" />
                </div>
                <input 
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"} 
                  placeholder="Re-type password" 
                  className="h-[52px] w-full pl-11 pr-12 border border-white/10 bg-slate-900/50 text-white focus:outline-none focus:border-[#7D5CE4] focus:ring-2 focus:ring-[#7D5CE4]/25 rounded-[16px] text-sm font-semibold placeholder:text-slate-500"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <button 
              type="submit" 
              className="group flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#7D5CE4] to-[#9F85F0] py-3 text-sm font-semibold text-white shadow-lg shadow-[#7D5CE4]/20 transition-all hover:opacity-95 active:scale-[0.98] disabled:opacity-50 h-[52px]"
              disabled={loading}
            >
              {loading ? (
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
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
      <div className="text-center mt-8 z-10 text-xs text-[#8A8E98]">
        <p>
          Anxora OS is secure and encrypted. Need help? Contact admin.
        </p>
      </div>
    </div>
  );
}
