import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { supabase } from '@/lib/supabaseClient';
import { useAdminTranslations } from '../hooks/useAdminTranslations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';

const MIN_PASSWORD_LENGTH = 8;
const RECOVERY_TIMEOUT_MS = 3000;

/**
 * Admin Reset Password Page
 *
 * Handles the second half of the password reset flow. Supabase processes
 * the recovery code from the URL (PKCE flow, `detectSessionInUrl: true`)
 * and emits a `PASSWORD_RECOVERY` event. We wait for that event (or for an
 * already-established recovery session) before showing the form. If no
 * recovery session materializes within {@link RECOVERY_TIMEOUT_MS}, we
 * assume the link is invalid or expired.
 */
export function ResetPasswordPage() {
  const navigate = useNavigate();
  const { t } = useAdminTranslations();

  const [ready, setReady] = useState(false);
  const [linkInvalid, setLinkInvalid] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (cancelled) return;
        // The recovery event fires once Supabase has exchanged the code in
        // the URL for a session. We also accept SIGNED_IN if a session is
        // already present from a previous exchange.
        if (event === 'PASSWORD_RECOVERY' && session) {
          setReady(true);
          setLinkInvalid(false);
        }
      }
    );

    // Also check the current session in case Supabase exchanged the code
    // before our listener attached.
    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session) {
        setReady(true);
        setLinkInvalid(false);
      }
    });

    // Fallback: if no recovery session arrives in time, show the
    // invalid-link state.
    timeoutId = setTimeout(() => {
      if (cancelled) return;
      setReady((current) => {
        if (!current) {
          setLinkInvalid(true);
        }
        return current;
      });
    }, RECOVERY_TIMEOUT_MS);

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(t('admin.resetPassword.errorTooShort'));
      return;
    }

    if (password !== confirmPassword) {
      setError(t('admin.resetPassword.errorMismatch'));
      return;
    }

    setIsLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        setError(updateError.message);
        return;
      }

      // Sign the recovery session out so the user must re-authenticate
      // with the new password. Failure here is non-fatal — log and proceed.
      try {
        await supabase.auth.signOut();
      } catch (signOutErr) {
        console.warn('signOut after password reset failed:', signOutErr);
      }

      navigate('/admin/login', { state: { passwordResetSuccess: true } });
    } catch (err) {
      console.error('Password update error:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Render: invalid / expired link state.
  if (linkInvalid) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900">
        <Card className="w-full max-w-md mx-4 bg-white">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-center">
              {t('admin.resetPassword.title')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
              {t('admin.resetPassword.errorInvalidLink')}
            </div>
            <Link
              to="/admin/forgot-password"
              className="block text-center text-sm text-primary underline-offset-4 hover:underline"
            >
              {t('admin.forgotPassword.title')}
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render: waiting for the recovery session to be established.
  if (!ready) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900">
        <Card className="w-full max-w-md mx-4 bg-white">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {t('admin.resetPassword.waitingForLink')}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render: reset form.
  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-900">
      <Card className="w-full max-w-md mx-4 bg-white">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            {t('admin.resetPassword.title')}
          </CardTitle>
          <CardDescription className="text-center">
            {t('admin.resetPassword.subtitle')}
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="new-password">
                {t('admin.resetPassword.newPassword')}
              </Label>
              <Input
                id="new-password"
                type="password"
                placeholder="********"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={MIN_PASSWORD_LENGTH}
                disabled={isLoading}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">
                {t('admin.resetPassword.confirmPassword')}
              </Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="********"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={MIN_PASSWORD_LENGTH}
                disabled={isLoading}
                autoComplete="new-password"
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading
                ? t('admin.resetPassword.submitting')
                : t('admin.resetPassword.submit')}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

export default ResetPasswordPage;
