
import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authApi } from '@/lib/api';
import { toast } from 'sonner';
import { ShieldCheck, Lock, Loader2, CheckCircle2, Eye, EyeOff, Sparkles, Zap, Layers, Shield, AlertCircle } from 'lucide-react';

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
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const leftPanel = (
    <div className="hidden lg:flex w-1/2 relative bg-[#0B1020] flex-col justify-between p-16 overflow-hidden">
      <div className="absolute inset-0 z-0">
        <img
          src="https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=2000"
          alt="Workspace Background"
          className="w-full h-full object-cover opacity-[0.06] filter grayscale"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0B1020]/90 via-[#0B1020]/95 to-[#0B1020]" />
      </div>

      {/* Ambient light glow shapes */}
      <div className="absolute top-[-20%] left-[-20%] w-[80%] h-[80%] rounded-full bg-blue-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-indigo-600/10 blur-[100px] pointer-events-none" />

      <div className="relative z-10 flex items-center gap-3 animate-fade-in">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
          <Sparkles className="w-5 h-5 text-white animate-pulse" />
        </div>
        <span className="text-xl font-bold tracking-wider text-white bg-clip-text bg-gradient-to-r from-white via-slate-100 to-slate-300">
          XCLATIX
        </span>
      </div>

      <div className="relative z-10 my-auto max-w-lg space-y-12">
        <div className="space-y-4">
          <h1 className="text-4xl xl:text-5xl font-extrabold text-white leading-tight tracking-tight">
            Workflows that <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-300">stay out</span> of the way.
          </h1>
          <p className="text-lg text-slate-400 font-normal leading-relaxed">
            A straightforward space to manage leads, calls, follow-ups, and the rest of your day.
          </p>
        </div>

        <div className="space-y-6">
          <div className="flex gap-5 items-start group">
            <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/30 text-blue-400 shadow-inner group-hover:bg-slate-800/60 group-hover:border-blue-500/30 transition-all duration-300">
              <Layers className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h4 className="text-base font-semibold text-slate-100">Lead Management</h4>
              <p className="text-sm text-slate-400 leading-relaxed">Keep contacts, notes and follow-ups organized.</p>
            </div>
          </div>
          <div className="flex gap-5 items-start group">
            <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/30 text-blue-400 shadow-inner group-hover:bg-slate-800/60 group-hover:border-blue-500/30 transition-all duration-300">
              <Zap className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h4 className="text-base font-semibold text-slate-100">Lightning Fast</h4>
              <p className="text-sm text-slate-400 leading-relaxed">Simple workflows without unnecessary complexity.</p>
            </div>
          </div>
          <div className="flex gap-5 items-start group">
              <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/30 text-blue-400 shadow-inner group-hover:bg-slate-800/60 group-hover:border-blue-500/30 transition-all duration-300">
                <Shield className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-semibold text-slate-100">
                  Built for Teams
                </h4>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Collaborate securely with your entire organization.
                </p>
              </div>
            </div>
        </div>
      </div>

      <div className="relative z-10 text-xs text-slate-500">
        &copy; {new Date().getFullYear()} XCLATIX. All rights reserved.
      </div>
    </div>
  );

  if (!token || !userInfo) {
    return (
      <div className="min-h-screen w-full flex bg-[#F8FAFC] selection:bg-blue-600 selection:text-white font-sans antialiased overflow-hidden">
        {leftPanel}
        <div className="w-full lg:w-1/2 flex items-center justify-center p-6 md:p-12 bg-[#F8FAFC]">
          <div className="w-full max-w-[440px] bg-white rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 p-8 md:p-10 space-y-8 text-center">
            <div className="flex lg:hidden items-center justify-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-md">
                <Sparkles className="w-4.5 h-4.5 text-white" />
              </div>
              <span className="text-lg font-bold tracking-wider text-slate-900">
                XCLATIX
              </span>
            </div>

            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-50 border border-red-100">
              <AlertCircle className="h-8 w-8 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-950">Invalid Invitation</h2>
            <p className="text-sm text-slate-500 leading-relaxed">This invitation link is invalid or has expired.</p>
            <Button
              className="w-full h-[52px] bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-[14px] shadow-lg shadow-blue-500/10 hover:shadow-blue-500/25 transition-all duration-300 active:scale-[0.98]"
              onClick={() => navigate('/auth')}
            >
              Return to Login
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex bg-[#F8FAFC] selection:bg-blue-600 selection:text-white font-sans antialiased overflow-hidden">
      {leftPanel}

      {/* Right Side: Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 md:p-12 bg-[#F8FAFC]">
        <div className="w-full max-w-[440px] bg-white rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 p-8 md:p-10 space-y-8 transition-all duration-500">
          {/* Mobile Logo Visibility */}
          <div className="flex lg:hidden items-center justify-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-md">
              <Sparkles className="w-4.5 h-4.5 text-white" />
            </div>
            <span className="text-lg font-bold tracking-wider text-slate-900">
              XCLATIX
            </span>
          </div>

          {success ? (
            <div className="space-y-6 text-center">
              <div className="p-8 border border-green-100 bg-green-50/60 rounded-2xl">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">Account Activated!</h3>
                <p className="text-sm text-slate-600">Your password has been set successfully. Redirecting you to the login page shortly.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-2 text-center">
                <div className="mx-auto mb-4 h-16 w-16 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center">
                  <ShieldCheck className="h-9 w-9 text-blue-600" />
                </div>
                <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
                  Welcome, {userInfo.full_name}!
                </h2>
                <p className="text-sm text-slate-500">
                  Setting up account for <span className="text-slate-900 font-semibold">{userInfo.email}</span>
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    New Password
                  </Label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                      <Lock className="h-5 w-5" />
                    </div>
                    <Input 
                      id="password"
                      type={showPassword ? "text" : "password"} 
                      placeholder="Min 8 characters" 
                      className="h-[52px] pl-11 pr-12 bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all w-full text-sm font-medium"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Confirm Password
                  </Label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                      <Lock className="h-5 w-5" />
                    </div>
                    <Input 
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"} 
                      placeholder="Re-type password" 
                      className="h-[52px] pl-11 pr-12 bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all w-full text-sm font-medium"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                <Button 
                  type="submit" 
                  className="w-full h-[52px] bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-[14px] shadow-lg shadow-blue-500/10 hover:shadow-blue-500/25 transition-all duration-300 active:scale-[0.98] flex items-center justify-center gap-2 text-base"
                  disabled={loading}
                >
                  {loading && <Loader2 className="h-5 w-5 animate-spin" />}
                  Complete Account Setup
                </Button>
              </form>
            </>
          )}

          <div className="text-center pt-2 border-t border-slate-100">
            <p className="text-xs text-slate-400 font-semibold tracking-wide uppercase">XCLATIX secure onboarding process</p>
          </div>
        </div>
      </div>
    </div>
  );
}
