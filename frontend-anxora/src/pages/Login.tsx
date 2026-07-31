import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock, Mail, ArrowRight, Sparkles, Eye, EyeOff } from 'lucide-react'
import { API_URL } from '@/lib/api'

export default function Login() {
    const navigate = useNavigate()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            // Send login request to backend
            const response = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password }),
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.message || 'Login failed')
            }

            // Save token and user details
            localStorage.setItem('token', data.token)
            localStorage.setItem('user', JSON.stringify(data.user || { email }))
            
            // Navigate to Dashboard
            navigate('/')
        } catch (err: any) {
            setError(err.message || 'Something went wrong')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4 py-12">
            {/* Background decorative glows */}
            <div className="absolute top-1/4 left-1/4 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#7D5CE4]/20 blur-[120px] pointer-events-none" />
            <div className="absolute bottom-1/4 right-1/4 h-96 w-96 translate-x-1/2 translate-y-1/2 rounded-full bg-[#8A8E98]/10 blur-[100px] pointer-events-none" />

            <div className="relative w-full max-w-md">
                {/* Logo & Header */}
                <div className="mb-8 text-center">
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
                    <form onSubmit={handleLogin} className="space-y-6">
                        {error && (
                            <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3.5 text-center text-xs font-medium text-red-400">
                                {error}
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
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="name@company.com"
                                    className="w-full rounded-xl border border-white/10 bg-slate-900/50 py-3 pl-11 pr-4 text-sm text-white placeholder-slate-500 outline-none transition-all focus:border-[#7D5CE4] focus:ring-2 focus:ring-[#7D5CE4]/25"
                                />
                            </div>
                        </div>

                        {/* Password Input */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                                    Password
                                </label>
                            </div>
                            <div className="relative">
                                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-[#8A8E98]">
                                    <Lock className="h-4 w-4" />
                                </span>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full rounded-xl border border-white/10 bg-slate-900/50 py-3 pl-11 pr-10 text-sm text-white placeholder-slate-500 outline-none transition-all focus:border-[#7D5CE4] focus:ring-2 focus:ring-[#7D5CE4]/25"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-200"
                                >
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="group flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#7D5CE4] to-[#9F85F0] py-3 text-sm font-semibold text-white shadow-lg shadow-[#7D5CE4]/20 transition-all hover:opacity-95 active:scale-[0.98] disabled:opacity-50"
                        >
                            {loading ? (
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

                {/* Footer Link */}
                <div className="mt-8 text-center text-xs text-[#8A8E98]">
                    Anxora OS is secure and encrypted. Need help? Contact admin.
                </div>
            </div>
        </div>
    )
}
