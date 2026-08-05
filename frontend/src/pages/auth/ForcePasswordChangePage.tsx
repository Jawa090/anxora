import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { authApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle, LayoutGrid, ChevronRight, ShieldCheck } from 'lucide-react';

export default function ForcePasswordChangePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { refreshProfile } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (newPassword !== confirmPassword) { setError('Passwords do not match'); return; }
    if (newPassword === currentPassword) { setError('New password must be different from current password'); return; }

    setIsSubmitting(true);
    try {
      await authApi.changePassword({ currentPassword, newPassword });
      await refreshProfile();
      // Ensure post-password-change screens use fresh data immediately.
      await queryClient.invalidateQueries();
      navigate('/', { replace: true });
    } catch (err: any) {
      setError(err.message || 'Failed to change password');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-white dark:bg-slate-950 font-sans selection:bg-slate-900 selection:text-white">
      {/* Left Pane: Brand & Visual */}
      <div className="hidden lg:flex relative overflow-hidden bg-slate-900 border-r border-slate-800">
        <div className="absolute inset-0 z-0">
          <img 
            src="https://images.unsplash.com/photo-1633265485768-3069c94050a1?auto=format&fit=crop&q=80&w=2000" 
            alt="Security background" 
            className="w-full h-full object-cover opacity-20 scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-tr from-slate-950 via-slate-900/40 to-transparent" />
        </div>
        
        <div className="relative z-10 p-16 flex flex-col justify-between w-full h-full">
          <div>
            <div className="flex items-center gap-3 mb-12">
              <div className="w-12 h-12 bg-white flex items-center justify-center rounded-xl shadow-2xl">
                <LayoutGrid className="w-6 h-6 text-slate-950" />
              </div>
              <span className="text-2xl font-bold tracking-tighter text-white uppercase">Rush RMS</span>
            </div>
            
            <h2 className="text-6xl font-extralight text-white leading-[1.1] mb-8 tracking-tighter">
              Mandatory <br />
              <span className="text-slate-400">Credential Update.</span>
            </h2>
            
            <div className="space-y-6">
              {[
                { title: 'Identity Protection', desc: 'Secure your account with new unique credentials.' },
                { title: 'Session Security', desc: 'Encryption standards require periodic password rotation.' },
                { title: 'Access Control', desc: 'Maintain strict control over system permissions.' }
              ].map((item, idx) => (
                <div key={idx} className="flex gap-4 items-start group">
                  <div className="mt-1 w-5 h-5 rounded-full border border-slate-700 flex items-center justify-center group-hover:border-white transition-colors">
                    <ChevronRight className="w-3 h-3 text-slate-500 group-hover:text-white" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-200 uppercase tracking-widest mb-1">{item.title}</h4>
                    <p className="text-sm text-slate-500 leading-relaxed max-w-sm">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="text-slate-500 text-[10px] font-black uppercase tracking-[0.4em]">
            ELINA Resource Management System v2.0
          </div>
        </div>
      </div>

      {/* Right Pane: Form */}
      <div className="flex flex-col justify-center items-center p-8 lg:p-24 bg-white dark:bg-slate-950">
        <div className="w-full max-w-[400px]">
          <div className="mb-10 lg:hidden text-center">
             <div className="flex items-center justify-center gap-2 mb-4">
              <div className="w-8 h-8 bg-slate-900 dark:bg-white flex items-center justify-center rounded-lg">
                <LayoutGrid className="w-4 h-4 text-white dark:text-slate-900" />
              </div>
              <span className="text-xl font-bold tracking-tighter text-slate-900 dark:text-white uppercase">Rush RMS</span>
            </div>
          </div>

          <div className="mb-8">
            <h3 className="text-3xl font-extralight tracking-tighter text-slate-900 dark:text-white mb-2">
              Security Notice
            </h3>
            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-relaxed">
              Initial password detected. Please update your credentials.
            </p>
          </div>

          {error && (
            <Alert variant="destructive" className="mb-6 border-red-100 dark:border-red-900/30 bg-red-50 dark:bg-red-950/20 rounded-xl">
              <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
              <AlertDescription className="text-red-700 dark:text-red-400 font-medium text-xs uppercase tracking-wider">{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="currentPassword" className="font-bold text-slate-400 dark:text-slate-500 text-[10px] uppercase tracking-widest pl-1">
                Current Password
              </Label>
              <Input
                id="currentPassword"
                type="password"
                placeholder="Temporary password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                disabled={isSubmitting}
                className="h-12 border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-sm rounded-xl focus:ring-4 focus:ring-slate-900/5 dark:focus:ring-white/5 transition-all"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword" className="font-bold text-slate-400 dark:text-slate-500 text-[10px] uppercase tracking-widest pl-1">
                New Password
              </Label>
              <Input
                id="newPassword"
                type="password"
                placeholder="Min. 8 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                disabled={isSubmitting}
                className="h-12 border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-sm rounded-xl focus:ring-4 focus:ring-slate-900/5 dark:focus:ring-white/5 transition-all"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="font-bold text-slate-400 dark:text-slate-500 text-[10px] uppercase tracking-widest pl-1">
                Verify New Password
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                disabled={isSubmitting}
                className="h-12 border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-sm rounded-xl focus:ring-4 focus:ring-slate-900/5 dark:focus:ring-white/5 transition-all"
              />
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-12 bg-primary hover:bg-primary/80 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-bold uppercase tracking-[0.2em] text-xs rounded-xl transition-all duration-300 shadow-lg shadow-primary/20 active:scale-[0.98]"
            >
              {isSubmitting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                'Update & Sync Account'
              )}
            </Button>
          </form>

          <div className="mt-12 pt-8 border-t border-slate-100 dark:border-slate-900">
             <div className="flex items-center justify-center gap-2 text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                <ShieldCheck className="w-3 h-3" />
                <span>Encrypted Connection State</span>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
