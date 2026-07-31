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
    <div className="min-h-screen w-full flex bg-[#F8FAFC] selection:bg-blue-600 selection:text-white font-sans antialiased overflow-hidden">
      {/* Left Side: Brand & Feature Highlights */}
      <div className="hidden lg:flex w-1/2 relative bg-[#0B1020] flex-col justify-between p-16 overflow-hidden">
        {/* Background image & gradient overlay */}
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

        {/* Top Section - Logo */}
        <div className="relative z-10 flex items-center gap-3 animate-fade-in">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Sparkles className="w-5 h-5 text-white animate-pulse" />
          </div>
          <span className="text-5xl font-bold tracking-wider text-white bg-clip-text bg-gradient-to-r from-white via-slate-100 to-slate-300">
            XCLATIX
          </span>
        </div>

        {/* Middle Section - Title and Bullet Points */}
        <div className="relative z-10 my-auto max-w-lg space-y-4">
          <div className="space-y-3">
            <h1 className="text-3xl font-extrabold text-white leading-tight tracking-tight">
              AI Powered CRM & ERP Platform
            </h1>
            <p className="text-sm text-slate-300 font-normal leading-relaxed">
              Manage CRM, HRMS, Projects, Inventory, Finance, Marketing and Team Collaboration from one place.
            </p>
          </div>

          <div className="space-y-3.5 pt-2 border-t border-slate-800/80">
            <div className="flex items-center gap-3 text-slate-200 text-sm font-medium">
              <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                ✓
              </div>
              <span>Gmail Integration</span>
            </div>
            <div className="flex items-center gap-3 text-slate-200 text-sm font-medium">
              <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                ✓
              </div>
              <span>Google Calendar Sync</span>
            </div>
            <div className="flex items-center gap-3 text-slate-200 text-sm font-medium">
              <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                ✓
              </div>
              <span>Google Drive Integration</span>
            </div>
            <div className="flex items-center gap-3 text-slate-200 text-sm font-medium">
              <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                ✓
              </div>
              <span>Multi Tenant SaaS Platform</span>
            </div>
          </div>
        </div>

        {/* Bottom Section - Footer Branding */}
        <div className="relative z-10 text-xs text-slate-400">
          &copy; {new Date().getFullYear()} XCLATIX. All rights reserved.
        </div>
      </div>

      {/* Right Side: Centered White Login Card */}
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

          <div className="space-y-2 text-center">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
              Welcome Back
            </h2>
            <p className="text-sm text-slate-500">
              Sign in to continue to your workspace.
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

          {successMessage && (
            <Alert className="border-green-100 bg-green-50/60 rounded-xl p-4">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-700 text-sm font-medium">
                {successMessage}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-5">
            <form onSubmit={handleSignIn} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="signin-email" className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Email Address
                </Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                    <Mail className="h-5 w-5" />
                  </div>
                  <Input
                    id="signin-email"
                    name="email"
                    type="email"
                    placeholder="name@company.com"
                    required
                    disabled={isLoading}
                    className="h-[52px] pl-11 pr-4 bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all w-full text-sm font-medium"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="signin-password" className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Password
                  </Label>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                    <Lock className="h-5 w-5" />
                  </div>
                  <Input
                    id="signin-password"
                    name="password"
                    type={showSignInPassword ? "text" : "password"}
                    placeholder="••••••••"
                    required
                    disabled={isLoading}
                    className="h-[52px] pl-11 pr-12 bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all w-full text-sm font-medium"
                  />
                  <button
                    type="button"
                    disabled={isLoading}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                    onClick={() => setShowSignInPassword(!showSignInPassword)}
                  >
                    {showSignInPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer group selection:bg-transparent">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4.5 h-4.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500/20 cursor-pointer"
                  />
                  <span className="text-sm font-semibold text-slate-600 group-hover:text-slate-900 transition-colors">
                    Remember Me
                  </span>
                </label>
                <Link
                  to="/forgot-password"
                  className="text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors"
                >
                  Forgot Password?
                </Link>
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-[52px] bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-[14px] shadow-lg shadow-blue-500/10 hover:shadow-blue-500/25 transition-all duration-300 active:scale-[0.98] flex items-center justify-center gap-2 text-base"
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>
          </div>

          {/* Footer Text */}
          <div className="text-center pt-2 space-y-1.5">
            <p className="text-xs text-slate-400 font-semibold tracking-wide uppercase">
              Need an account?{" "}
              <span className="text-slate-500 hover:text-slate-800 transition-colors">
                Contact your administrator.
              </span>
            </p>
            <div className="text-xs text-slate-400 font-medium flex items-center justify-center gap-2">
              <Link
                to="/privacy"
                className="hover:text-slate-600 transition-colors underline decoration-slate-300 underline-offset-2"
              >
                Privacy Policy
              </Link>
              <span className="text-slate-300">|</span>
              <Link
                to="/terms"
                className="hover:text-slate-600 transition-colors underline decoration-slate-300 underline-offset-2"
              >
                Terms of Service
              </Link>
              <span className="text-slate-300">|</span>
              <Link
                to="/contact"
                className="hover:text-slate-600 transition-colors underline decoration-slate-300 underline-offset-2"
              >
                Contact
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

