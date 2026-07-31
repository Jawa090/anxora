import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Loader2,
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Mail,
  Lock,
  Shield,
  Zap,
  Layers,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { z } from "zod";

const emailSchema = z.string().email("Please enter a valid email address");
const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters");

export default function AuthPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, user } = useAuth();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showSignInPassword, setShowSignInPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  // Redirect if already logged in
  if (user) {
    const from = (location.state as { from?: Location })?.from?.pathname || "/";
    navigate(from, { replace: true });
    return null;
  }

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    try {
      emailSchema.parse(email);
      passwordSchema.parse(password);

      const { error: authError } = await signIn(email, password);

      if (authError) {
        setError(authError.message);
      } else {
        setSuccessMessage("Successfully authenticated. Redirecting...");
        setTimeout(() => navigate("/"), 1000);
      }
    } catch (err) {
      if (err instanceof z.ZodError) {
        setError(err.errors[0].message);
      } else {
        setError("An unexpected error occurred");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4 py-12 font-sans antialiased">
      {/* Background decorative glows */}
      <div className="absolute top-1/4 left-1/4 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#7D5CE4]/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 h-96 w-96 translate-x-1/2 translate-y-1/2 rounded-full bg-[#8A8E98]/10 blur-[100px] pointer-events-none" />

      <div className="relative w-full max-w-md z-10">
        {/* Logo & Header */}
        <div className="mb-8 text-center animate-fade-in">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#7D5CE4] to-[#9F85F0] text-white shadow-lg shadow-[#7D5CE4]/20">
            <Sparkles className="h-6 w-6 animate-pulse" />
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Anxora<span className="text-[#7D5CE4]">OS</span>
          </h2>
          <p className="mt-2 text-sm text-[#8A8E98]">
            Enter your credentials to access your workspace
          </p>
        </div>

        {/* Card with Glassmorphism */}
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 shadow-2xl backdrop-blur-xl">
          <form onSubmit={handleSignIn} className="space-y-6">
            {error && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3.5 text-center text-xs font-medium text-red-400">
                {error}
              </div>
            )}

            {successMessage && (
              <div className="rounded-xl border border-green-500/20 bg-green-50/10 p-3.5 text-center text-xs font-medium text-green-400">
                {successMessage}
              </div>
            )}

            {/* Email Input */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Email Address
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-[#8A8E98]">
                  <Mail className="h-4 w-4" />
                </span>
                <input
                  id="signin-email"
                  name="email"
                  type="email"
                  required
                  disabled={isLoading}
                  placeholder="name@company.com"
                  className="w-full rounded-xl border border-white/10 bg-slate-900/50 py-3 pl-11 pr-4 text-sm text-white placeholder-slate-500 outline-none transition-all focus:border-[#7D5CE4] focus:ring-2 focus:ring-[#7D5CE4]/25 disabled:opacity-50"
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Password
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-[#8A8E98]">
                  <Lock className="h-4 w-4" />
                </span>
                <input
                  id="signin-password"
                  name="password"
                  type={showSignInPassword ? "text" : "password"}
                  required
                  disabled={isLoading}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-white/10 bg-slate-900/50 py-3 pl-11 pr-10 text-sm text-white placeholder-slate-500 outline-none transition-all focus:border-[#7D5CE4] focus:ring-2 focus:ring-[#7D5CE4]/25 disabled:opacity-50"
                />
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => setShowSignInPassword(!showSignInPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-200"
                >
                  {showSignInPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer group selection:bg-transparent">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  disabled={isLoading}
                  className="w-4 h-4 rounded border-white/10 bg-slate-900 text-[#7D5CE4] focus:ring-[#7D5CE4]/25 cursor-pointer accent-[#7D5CE4]"
                />
                <span className="text-xs font-semibold text-slate-400 group-hover:text-slate-200 transition-colors">
                  Remember Me
                </span>
              </label>
              <Link
                to="/forgot-password"
                className="text-xs font-semibold text-[#7D5CE4] hover:text-[#9F85F0] transition-colors"
              >
                Forgot Password?
              </Link>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="group flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#7D5CE4] to-[#9F85F0] py-3 text-sm font-semibold text-white shadow-lg shadow-[#7D5CE4]/20 transition-all hover:opacity-95 active:scale-[0.98] disabled:opacity-50"
            >
              {isLoading ? (
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <>
                  Sign In to Workspace
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer Link & Policies */}
        <div className="mt-8 text-center text-xs text-[#8A8E98] space-y-3">
          <div>
            Anxora OS is secure and encrypted. Need help? Contact admin.
          </div>
          <div className="flex items-center justify-center gap-2">
            <Link
              to="/privacy"
              className="hover:text-slate-300 transition-colors underline decoration-slate-700 underline-offset-2"
            >
              Privacy Policy
            </Link>
            <span className="text-slate-700">|</span>
            <Link
              to="/terms"
              className="hover:text-slate-300 transition-colors underline decoration-slate-700 underline-offset-2"
            >
              Terms of Service
            </Link>
            <span className="text-slate-700">|</span>
            <Link
              to="/contact"
              className="hover:text-slate-300 transition-colors underline decoration-slate-700 underline-offset-2"
            >
              Contact
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

