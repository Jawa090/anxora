import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, Mail, ArrowRight, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { API_URL } from "@/lib/api";
import { BrandLogo } from "@/components/brand-logo";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Login failed");
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user || { email }));

      navigate("/");
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#02181A] px-4 py-12 select-none">
      {/* Background decorative glowing teal ambient elements */}
      <div className="absolute top-1/4 left-1/4 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#0D646B]/30 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 h-96 w-96 translate-x-1/2 translate-y-1/2 rounded-full bg-[#2DD4BF]/20 blur-[120px] pointer-events-none" />

      <div className="relative w-full max-w-md">
        {/* Logo Header */}
        <div className="mb-8 flex flex-col items-center text-center">
          <BrandLogo size="xl" lightText subtitle="ENTERPRISE SUITE" className="mb-3" />
          <p className="mt-2 text-xs text-[#8AA1A3] font-medium">
            Sign in to access your secure enterprise workspace
          </p>
        </div>

        {/* Form Container with Deep Teal Glassmorphism */}
        <div className="rounded-3xl border border-[#2DD4BF]/20 bg-[#04292C]/80 p-8 shadow-2xl backdrop-blur-2xl">
          <form onSubmit={handleLogin} className="space-y-5">
            {error && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-center text-xs font-semibold text-rose-300">
                {error}
              </div>
            )}

            {/* Email Input */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[#D3E2E3]">
                Corporate Email Address
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-[#2DD4BF]">
                  <Mail className="h-4 w-4" />
                </span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full rounded-xl border border-[#2DD4BF]/20 bg-[#02181A]/70 py-3 pl-11 pr-4 text-sm text-white placeholder-[#5B6D6E] outline-none transition-all focus:border-[#2DD4BF] focus:ring-2 focus:ring-[#2DD4BF]/25"
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold uppercase tracking-wider text-[#D3E2E3]">
                  Password
                </label>
              </div>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-[#2DD4BF]">
                  <Lock className="h-4 w-4" />
                </span>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-[#2DD4BF]/20 bg-[#02181A]/70 py-3 pl-11 pr-10 text-sm text-white placeholder-[#5B6D6E] outline-none transition-all focus:border-[#2DD4BF] focus:ring-2 focus:ring-[#2DD4BF]/25"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-[#8AA1A3] hover:text-white"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="group flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0D646B] via-[#14858E] to-[#2DD4BF] py-3 text-xs font-extrabold uppercase tracking-wider text-[#032124] shadow-lg shadow-[#2DD4BF]/25 transition-all hover:opacity-95 active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? (
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#032124] border-t-transparent" />
              ) : (
                <>
                  Sign In to Workspace
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Security Badge Footer */}
        <div className="mt-8 flex items-center justify-center gap-2 text-center text-xs text-[#8AA1A3]">
          <ShieldCheck className="h-4 w-4 text-[#2DD4BF]" />
          <span>Anxora OS Security & Encryption Active</span>
        </div>
      </div>
    </div>
  );
}
