import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeftCircle, Loader2, AlertCircle, CheckCircle2, ArrowLeft, Sparkles, Mail, Lock, Shield, Zap, Layers } from 'lucide-react';
import { z } from 'zod';

const emailSchema = z.string().email('Please enter a valid email address');

export default function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [sentTo, setSentTo] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;

    try {
      emailSchema.parse(email);

      await authApi.forgotPassword(email);
      setSentTo(email);
      setEmailSent(true);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        setError(err.errors[0].message);
      } else {
        setError(err.message || 'Failed to send reset email');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-[#F8FAFC] selection:bg-blue-600 selection:text-white font-sans antialiased overflow-hidden">
      {/* Left Side: Brand & Feature Highlights */}
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
          <span className="text-5xl font-bold tracking-wider text-white bg-clip-text bg-gradient-to-r from-white via-slate-100 to-slate-300">
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
          </div>
        </div>

        <div className="relative z-10 text-xs text-white">
          &copy; {new Date().getFullYear()} XCLATIX. All rights reserved.
        </div>
      </div>

      {/* Right Side: Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 md:p-12 bg-[#F8FAFC]">
        <div className="w-full max-w-[440px] bg-white rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 p-8 md:p-10 space-y-8 transition-all duration-500">
          {/* Mobile Logo Visibility */}
          <div className="flex lg:hidden items-center justify-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-md">
              <Sparkles className="w-4.5 h-4.5 text-white" />
            </div>
            <span className="text-4x font-bold tracking-wider text-slate-900">
              XCLATIX
            </span>
          </div>

          <div className="space-y-2 text-center">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
              Forgot Password
            </h2>
            <p className="text-sm text-slate-500">
              {emailSent
                ? "Recovery link dispatched successfully"
                : "Enter your email to receive a recovery link"}
            </p>
          </div>

          {error && (
            <Alert variant="destructive" className="border-red-100 bg-red-50/60 rounded-xl p-4">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-700 text-sm font-medium">
                {error}
              </AlertDescription>
            </Alert>
          )}

          {emailSent ? (
            <div className="space-y-6">
              <div className="p-6 border border-green-100 bg-green-50/60 rounded-2xl text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">Success</h3>
                <p className="text-sm text-slate-600 leading-relaxed mb-4">
                  A secure link has been sent to <strong className="text-slate-900">{sentTo}</strong>. Please check your inbox.
                </p>
              </div>

              <Link to="/auth" className="block">
                <Button variant="outline" className="w-full h-[52px] border-slate-200 text-slate-700 font-semibold rounded-[14px] hover:bg-slate-50 hover:text-slate-900 transition-all duration-300 flex items-center justify-center gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Back to Login
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Email Address
                </Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                    <Mail className="h-5 w-5" />
                  </div>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="name@company.com"
                    required
                    disabled={isLoading}
                    className="h-[52px] pl-11 pr-4 bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all w-full text-sm font-medium"
                  />
                </div>
              </div>

              <div className="space-y-4 pt-2">
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-[52px] bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-[14px] shadow-lg shadow-blue-500/10 hover:shadow-blue-500/25 transition-all duration-300 active:scale-[0.98] flex items-center justify-center gap-2 text-base"
                >
                  {isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    'Send Recovery Link'
                  )}
                </Button>

                <Link to="/auth" className="block text-center">
                  <Button variant="ghost" className="text-sm font-semibold text-primary bg-slate-200 hover:text-white hover:bg-primary transition-colors h-auto py-2">
                    Cancel and Return
                  </Button>
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
