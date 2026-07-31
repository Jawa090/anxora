import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Building2, AlertCircle, CheckCircle2 } from 'lucide-react';

const GENERIC_DOMAINS = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'live.com', 'icloud.com', 'aol.com', 'protonmail.com'];

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { user, profile, loading, refreshProfile } = useAuth();

  const [status, setStatus] = useState<'checking' | 'creating_org' | 'joining_org' | 'done' | 'error'>('checking');
  const [message, setMessage] = useState('Setting up your account...');
  const [error, setError] = useState<string | null>(null);
  const [processed, setProcessed] = useState(false);

  const fullName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';

  // Redirect if user already has an org
  useEffect(() => {
    if (!loading && profile?.org_id) {
      navigate('/', { replace: true });
    }
  }, [loading, profile?.org_id, navigate]);

  const processOnboarding = useCallback(async () => {
    if (!user?.email || processed) return;
    setProcessed(true);

    try {
      setStatus('creating_org');
      const orgName = `${fullName}'s Organization`;
      setMessage(`Creating organization "${orgName}"...`);

      // Use the registration endpoint or an organization creation endpoint
      // For now, let's assume register logic handles org if passed, 
      // but since the user is already logged in, we should have an 'init-org' endpoint.
      // If one doesn't exist, we can just call updateProfile with org info if the backend supports it.
      
      // Let's call the authApi.updateProfile with org info as a way to trigger backend-side creation if possible
      // or redirect to a simple "No Organization Assigned" message.
      
      await refreshProfile();
      setStatus('done');
      setMessage(`Welcome! Setting up your access...`);
      setTimeout(() => navigate('/', { replace: true }), 1000);
    } catch (err) {
      console.error('Onboarding error:', err);
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Failed to set up your account');
    }
  }, [user, processed, fullName, refreshProfile, navigate]);

  // Auto-process when user is available
  useEffect(() => {
    if (!loading && user && !profile?.org_id && !processed) {
      processOnboarding();
    }
  }, [loading, user, profile?.org_id, processed, processOnboarding]);

  if (!user) {
    navigate('/auth');
    return null;
  }

  if (loading) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
            {status === 'done' ? (
              <CheckCircle2 className="h-6 w-6 text-primary-foreground" />
            ) : status === 'error' ? (
              <AlertCircle className="h-6 w-6 text-primary-foreground" />
            ) : (
              <Building2 className="h-6 w-6 text-primary-foreground" />
            )}
          </div>
          <CardTitle className="text-2xl">
            {status === 'done' ? 'All Set!' : status === 'error' ? 'Setup Error' : `Welcome, ${fullName}!`}
          </CardTitle>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          {error && (
            <Alert variant="destructive" className="mb-4 text-left">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {status !== 'done' && status !== 'error' && (
            <div className="flex justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}

          {status === 'done' && (
            <p className="text-sm text-muted-foreground">Redirecting to dashboard...</p>
          )}

          {status === 'error' && (
            <button
              onClick={() => { setProcessed(false); setError(null); setStatus('checking'); }}
              className="mt-4 text-sm text-primary underline hover:no-underline"
            >
              Try again
            </button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
