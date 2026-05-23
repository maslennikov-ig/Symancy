import React, { useState } from 'react';
import { Link } from 'react-router';
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

/**
 * Admin Forgot Password Page
 *
 * Allows admin users to request a password reset link. To prevent email
 * enumeration, a generic success message is shown regardless of whether
 * the email exists in the system. Only true network / unexpected failures
 * surface an error to the user.
 */
export function ForgotPasswordPage() {
  const { t } = useAdminTranslations();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      // Supabase typically does NOT return an error for unknown emails to
      // avoid enumeration. Any returned error is logged but we still show
      // the generic success state.
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email,
        {
          redirectTo: `${window.location.origin}/admin/reset-password`,
        }
      );

      if (resetError) {
        // Log for debugging but do not leak details about email existence.
        console.warn('resetPasswordForEmail returned an error:', resetError);
      }

      setIsSubmitted(true);
    } catch (err) {
      // Genuine network / unexpected failure — surface to user.
      console.error('Forgot password error:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-900">
      <Card className="w-full max-w-md mx-4 bg-white">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            {isSubmitted
              ? t('admin.forgotPassword.successTitle')
              : t('admin.forgotPassword.title')}
          </CardTitle>
          {!isSubmitted && (
            <CardDescription className="text-center">
              {t('admin.forgotPassword.subtitle')}
            </CardDescription>
          )}
        </CardHeader>

        {isSubmitted ? (
          <CardContent className="space-y-4">
            <div className="p-3 text-sm text-green-700 bg-green-50 border border-green-200 rounded-md">
              {t('admin.forgotPassword.successMessage')}
            </div>
            <Link
              to="/admin/login"
              className="block text-center text-sm text-primary underline-offset-4 hover:underline"
            >
              {t('admin.forgotPassword.backToLogin')}
            </Link>
          </CardContent>
        ) : (
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {error && (
                <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">
                  {t('admin.forgotPassword.email')}
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                  autoComplete="email"
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-4">
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading
                  ? t('admin.forgotPassword.submitting')
                  : t('admin.forgotPassword.submit')}
              </Button>
              <Link
                to="/admin/login"
                className="text-sm text-muted-foreground underline-offset-4 hover:underline"
              >
                {t('admin.forgotPassword.backToLogin')}
              </Link>
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  );
}

export default ForgotPasswordPage;
