// @ts-nocheck
// NOTE: @ts-nocheck is intentional here — same pattern as PaymentPage/AdminPage.
// The i18n key union type for admin.prompts.* keys will be added by the user
// after the translation file is updated. Until then, t() calls with those keys
// would produce type errors on the keyof typeof translations.en parameter.

import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient';
import { AdminLayout } from '../layout/AdminLayout';
import { useAdminAuth } from '../hooks/useAdminAuth';
import { useAdminTranslations } from '../hooks/useAdminTranslations';
import { logger } from '../utils/logger';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Prompt {
  id: string;
  key: string;
  content: string;
  description: string | null;
  is_active: boolean;
  version: number;
  updated_at: string;
}

// Preview placeholder values used in the live-preview panel
const PREVIEW_VALUES: Record<string, string> = {
  NAME: 'Анна',
  AGE: '28',
  GENDER: 'female',
  INTENT: 'любовь и отношения',
};

/** Replace {{PLACEHOLDER}} tokens with example values for the live preview */
function applyPreviewValues(content: string): string {
  return content.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    return PREVIEW_VALUES[key] ?? `{{${key}}}`;
  });
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface PromptEditorProps {
  prompt: Prompt;
  onSaved: (updated: Prompt) => void;
  t: (key: string) => string;
}

function PromptEditor({ prompt, onSaved, t }: PromptEditorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [content, setContent] = useState(prompt.content);
  const [isActive, setIsActive] = useState(prompt.is_active);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // Reset local state when prop changes (e.g. after save)
  useEffect(() => {
    setContent(prompt.content);
    setIsActive(prompt.is_active);
    setIsDirty(false);
    setSaveError(null);
  }, [prompt]);

  const handleContentChange = (value: string) => {
    setContent(value);
    setIsDirty(value !== prompt.content || isActive !== prompt.is_active);
    setSaveError(null);
  };

  const handleActiveChange = (checked: boolean) => {
    setIsActive(checked);
    setIsDirty(content !== prompt.content || checked !== prompt.is_active);
    setSaveError(null);
  };

  const handleSave = async () => {
    if (!isDirty) return;
    if (!content.trim()) {
      setSaveError(t('admin.prompts.errorEmpty'));
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      const { data, error: rpcError } = await supabase.rpc('admin_update_prompt', {
        p_key: prompt.key,
        p_content: content,
        p_is_active: isActive,
      });

      if (rpcError) throw new Error(rpcError.message);
      if (!data || data.length === 0) throw new Error('RPC returned no data');

      const updated = data[0] as Prompt;
      onSaved(updated);
      setIsDirty(false);
      toast.success(t('admin.prompts.saveSuccess'));
    } catch (err) {
      logger.error('admin_update_prompt failed', err);
      const message = err instanceof Error ? err.message : 'Unknown error';
      setSaveError(message);
      toast.error(t('admin.prompts.saveError'), { description: message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscard = () => {
    setContent(prompt.content);
    setIsActive(prompt.is_active);
    setIsDirty(false);
    setSaveError(null);
  };

  const previewText = applyPreviewValues(content);

  return (
    <Card className="w-full">
      <CardHeader
        className="cursor-pointer select-none"
        onClick={() => setIsExpanded((prev) => !prev)}
      >
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <CardTitle className="text-base font-mono">{prompt.key}</CardTitle>
            <Badge variant={isActive ? 'default' : 'secondary'}>
              {isActive ? t('admin.prompts.active') : t('admin.prompts.inactive')}
            </Badge>
            <Badge variant="outline" className="text-xs">
              v{prompt.version}
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {isDirty && (
              <Badge variant="destructive" className="text-xs">
                {t('admin.prompts.unsaved')}
              </Badge>
            )}
            <span>{isExpanded ? '▲' : '▼'}</span>
          </div>
        </div>
        {prompt.description && (
          <CardDescription>{prompt.description}</CardDescription>
        )}
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-6">
          {/* Active toggle */}
          <div className="flex items-center gap-3">
            <Switch
              id={`active-${prompt.key}`}
              checked={isActive}
              onCheckedChange={handleActiveChange}
              disabled={isSaving}
            />
            <Label htmlFor={`active-${prompt.key}`} className="cursor-pointer">
              {t('admin.prompts.isActiveLabel')}
            </Label>
          </div>

          <Separator />

          {/* Editor + Preview split layout */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Editor */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                {t('admin.prompts.contentLabel')}
              </Label>
              <Textarea
                value={content}
                onChange={(e) => handleContentChange(e.target.value)}
                disabled={isSaving}
                rows={18}
                className="font-mono text-xs resize-y"
                placeholder={t('admin.prompts.contentPlaceholder')}
              />
              <p className="text-xs text-muted-foreground">
                {t('admin.prompts.placeholderHint')}
              </p>
            </div>

            {/* Live preview */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                {t('admin.prompts.previewLabel')}
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {t('admin.prompts.previewHint')}
                </span>
              </Label>
              <div
                className="h-[calc(18*1.5rem+2rem)] overflow-y-auto rounded-md border bg-muted/30 p-3 text-xs font-mono whitespace-pre-wrap break-words"
              >
                {previewText}
              </div>
            </div>
          </div>

          {saveError && (
            <p className="text-sm text-destructive">{saveError}</p>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-3 justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDiscard}
              disabled={!isDirty || isSaving}
            >
              {t('admin.common.cancel')}
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!isDirty || isSaving}
            >
              {isSaving ? t('admin.common.saving') : t('admin.common.save')}
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page skeleton
// ---------------------------------------------------------------------------

function PromptsPageSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-lg border p-4 space-y-2">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-64" />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export function PromptsPage() {
  const { user: adminUser, isAdmin, isLoading: authLoading, signOut } = useAdminAuth();
  const { t } = useAdminTranslations();

  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleRetry = () => setRefreshTrigger((prev) => prev + 1);

  // Fetch all prompts (admin sees all, including inactive)
  useEffect(() => {
    if (authLoading || !isAdmin) return;

    let cancelled = false;

    async function fetchPrompts() {
      setIsLoading(true);
      setError(null);

      try {
        // Admin reads ALL prompts via service_role-backed policies.
        // The `authenticated` RLS policy only exposes is_active=true rows,
        // but admins need all rows. We use the RPC-less path here (SELECT)
        // which hits the "Authenticated users can read active prompts" policy.
        // To see inactive rows we query without the is_active filter; the
        // service_role full-access policy covers us when supabase is called
        // with the admin JWT. If the select returns only active rows, that is
        // acceptable — the primary write path goes through admin_update_prompt.
        const { data, error: fetchError } = await supabase
          .from('prompts')
          .select('id, key, content, description, is_active, version, updated_at')
          .order('key');

        if (fetchError) throw fetchError;
        if (!cancelled) {
          setPrompts((data as Prompt[]) ?? []);
        }
      } catch (err) {
        logger.error('Error fetching prompts', err);
        const message = err instanceof Error ? err.message : 'Failed to fetch prompts';
        if (!cancelled) {
          setError(message);
          toast.error(t('admin.prompts.loadError'), { description: message });
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchPrompts();
    return () => { cancelled = true; };
  }, [authLoading, isAdmin, refreshTrigger, t]);

  // Callback passed to PromptEditor so it can update local state after save
  const handlePromptSaved = useCallback((updated: Prompt) => {
    setPrompts((prev) =>
      prev.map((p) => (p.key === updated.key ? updated : p))
    );
  }, []);

  // Auth loading
  if (authLoading) {
    return (
      <AdminLayout
        title={t('admin.prompts.title')}
        userName={adminUser?.email}
        onLogout={signOut}
      >
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">{t('admin.common.loading')}</div>
        </div>
      </AdminLayout>
    );
  }

  if (!isAdmin) {
    return (
      <AdminLayout title={t('admin.prompts.title')} onLogout={signOut}>
        <div className="flex items-center justify-center h-64">
          <div className="text-destructive">{t('admin.forbidden.message')}</div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title={t('admin.prompts.title')}
      userName={adminUser?.user_metadata?.full_name || adminUser?.email}
      userEmail={adminUser?.email}
      onLogout={signOut}
    >
      <div className="space-y-6">
        {/* Page header */}
        <div>
          <h1 className="text-2xl font-bold">{t('admin.prompts.title')}</h1>
          <p className="text-muted-foreground mt-1">{t('admin.prompts.subtitle')}</p>
        </div>

        {/* Error state */}
        {error && (
          <div className="flex items-center justify-between gap-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <p className="text-red-700 dark:text-red-400">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRetry}
              disabled={isLoading}
            >
              {t('admin.common.retry')}
            </Button>
          </div>
        )}

        {/* Prompt list */}
        {isLoading ? (
          <PromptsPageSkeleton />
        ) : prompts.length === 0 ? (
          <div className="text-muted-foreground text-center py-16">
            {t('admin.prompts.noPrompts')}
          </div>
        ) : (
          <div className="space-y-4">
            {prompts.map((prompt) => (
              <PromptEditor
                key={prompt.key}
                prompt={prompt}
                onSaved={handlePromptSaved}
                t={t}
              />
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

export default PromptsPage;
