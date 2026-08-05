import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Logo } from "@/components/Logo";
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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#021B1D] px-4 py-12 font-sans antialiased">
      {/* Background decorative glows */}
      <div className="absolute top-1/4 left-1/4 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#2DD4BF]/15 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 h-96 w-96 translate-x-1/2 translate-y-1/2 rounded-full bg-[#2DD4BF]/10 blur-[100px] pointer-events-none" />

      <div className="relative w-full max-w-md z-10">
        {/* Logo & Header */}
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
         

        {/* Card with Glassmorphism */}
        <div className="rounded-3xl border border-[#2DD4BF]/20 bg-[#021B1D]/60 p-8 shadow-2xl backdrop-blur-xl">
           <p className="mb-1 text-center text-sm text-[#8AA1A3]">
            {emailSent
              ? "Recovery link dispatched successfully"
              : "Enter your email to receive a recovery link"}
          </p>
          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3.5 text-center text-xs font-medium text-red-400 mb-6">
              {error}
            </div>
          )}

          {emailSent ? (
            <div className="space-y-6">
              <div className="p-6 border border-emerald-500/25 bg-emerald-500/10 rounded-2xl text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-500/15 rounded-full mb-4">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Success</h3>
                <p className="text-sm text-[#C8DBDC] leading-relaxed mb-4">
                  A secure link has been sent to <strong className="text-white">{sentTo}</strong>. Please check your inbox.
                </p>
              </div>

              <Link to="/auth" className="block">
                <button className="group flex w-full items-center justify-center gap-2 rounded-xl border border-[#2DD4BF]/20 bg-[#021B1D] py-3 text-sm font-semibold text-white shadow-lg transition-all hover:bg-[#021B1D]/80 active:scale-[0.98] h-[52px]">
                  <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
                  Back to Login
                </button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Email Input */}
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#C8DBDC]">
                  Email Address
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-[#8AA1A3]">
                    <Mail className="h-4 w-4" />
                  </span>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    disabled={isLoading}
                    placeholder="name@company.com"
                    className="w-full rounded-xl border border-[#2DD4BF]/20 bg-[#021B1D] py-3 pl-11 pr-4 text-sm text-white placeholder-[#8AA1A3] outline-none transition-all focus:border-[#2DD4BF] focus:ring-2 focus:ring-[#2DD4BF]/25 disabled:opacity-50 h-[52px]"
                  />
                </div>
              </div>

              <div className="space-y-4 pt-2">
                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="group flex w-full items-center justify-center gap-2 rounded-xl bg-[#2DD4BF] py-3 text-sm font-semibold text-[#021B1D] shadow-lg shadow-[#2DD4BF]/20 transition-all hover:bg-[#2DD4BF]/90 active:scale-[0.98] disabled:opacity-50 h-[52px]"
                >
                  {isLoading ? (
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#021B1D] border-t-transparent" />
                  ) : (
                    'Send Recovery Link'
                  )}
                </button>

                <Link to="/auth" className="block text-center pt-2">
                  <span className="text-xs font-semibold text-[#8AA1A3] hover:text-[#C8DBDC] transition-colors cursor-pointer">
                    Cancel and Return
                  </span>
                </Link>
              </div>
            </form>
          )}
        </div>

        {/* Footer Link & Policies */}
        <div className="mt-8 text-center text-xs text-[#8AA1A3] space-y-3">
          <div>
            ELINA OS Security & Encryption Active
          </div>
          <div className="flex items-center justify-center gap-2">
            <Link
              to="/privacy"
              className="hover:text-[#C8DBDC] transition-colors underline decoration-[#2DD4BF]/30 underline-offset-2"
            >
              Privacy Policy
            </Link>
            <span className="text-[#2DD4BF]/30">|</span>
            <Link
              to="/terms"
              className="hover:text-[#C8DBDC] transition-colors underline decoration-[#2DD4BF]/30 underline-offset-2"
            >
              Terms of Service
            </Link>
            <span className="text-[#2DD4BF]/30">|</span>
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
