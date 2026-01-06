import { useState, useEffect, useCallback } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { supabase } from '@/lib/supabaseClient';
import { AdminLayout } from '../layout/AdminLayout';
import { useAdminAuth } from '../hooks/useAdminAuth';
import { useAdminTranslations } from '../hooks/useAdminTranslations';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { X, UserPlus, Shield } from 'lucide-react';

// Import new config components
import { VisionStageSettings } from '../components/config/VisionStageSettings';
import { InterpretationStageSettings } from '../components/config/InterpretationStageSettings';
import { PersonasSettings } from '../components/config/PersonasSettings';
import { SystemSettings } from '../components/config/SystemSettings';

// Import runtime type validation helpers
import {
  getStringConfig,
  getNumberConfig,
  getBooleanConfig,
  type SystemConfig
} from '../utils/configValidation';

/**
 * Skeleton loader for configuration tabs
 * Displayed while loading configuration data
 */
function ConfigTabSkeleton(): React.ReactElement {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-1/3" />
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

/**
 * Error fallback component for configuration errors
 * Displays user-friendly error message with retry button
 */
function ConfigErrorFallback({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }): React.ReactElement {
  return (
    <Card className="border-destructive">
      <CardHeader>
        <CardTitle className="text-destructive">Configuration Error</CardTitle>
        <CardDescription>
          Failed to load system configuration: {error.message}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          This error has been logged. Try refreshing the page or contact support if the problem persists.
        </p>
        <Button onClick={resetErrorBoundary} variant="outline">
          Retry Loading Configuration
        </Button>
      </CardContent>
    </Card>
  );
}

// Admin Users Card Component
interface AdminUsersCardProps {
  adminEmails: string[];
  currentUserEmail: string | undefined;
  onAddAdmin: (email: string) => Promise<void>;
  onRemoveAdmin: (email: string) => Promise<void>;
  loading: boolean;
  t: (key: string) => string;
}

function AdminUsersCard({ adminEmails, currentUserEmail, onAddAdmin, onRemoveAdmin, loading, t }: AdminUsersCardProps) {
  const [newEmail, setNewEmail] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [removingEmail, setRemovingEmail] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!newEmail.trim() || !newEmail.includes('@')) {
      toast.error(t('admin.adminUsers.invalidEmail'));
      return;
    }
    if (adminEmails.includes(newEmail.trim().toLowerCase())) {
      toast.error(t('admin.adminUsers.alreadyAdmin'));
      return;
    }
    setIsAdding(true);
    try {
      await onAddAdmin(newEmail.trim().toLowerCase());
      setNewEmail('');
      toast.success(t('admin.adminUsers.added'));
    } catch {
      toast.error(t('admin.adminUsers.addFailed'));
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemove = async (email: string) => {
    if (email === currentUserEmail) {
      toast.error(t('admin.adminUsers.cannotRemoveSelf'));
      return;
    }
    if (adminEmails.length === 1) {
      toast.error(t('admin.adminUsers.cannotRemoveLast'));
      return;
    }
    setRemovingEmail(email);
    try {
      await onRemoveAdmin(email);
      toast.success(t('admin.adminUsers.removed'));
    } catch {
      toast.error(t('admin.adminUsers.removeFailed'));
    } finally {
      setRemovingEmail(null);
    }
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          {t('admin.adminUsers.title')}
        </CardTitle>
        <CardDescription>{t('admin.adminUsers.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-20 w-full" />
        ) : (
          <div className="space-y-4">
            {/* Current admins list */}
            <div className="flex flex-wrap gap-2">
              {adminEmails.map((email) => (
                <Badge
                  key={email}
                  variant={email === currentUserEmail ? 'default' : 'secondary'}
                  className="flex items-center gap-1 px-3 py-1.5"
                >
                  {email}
                  {email === currentUserEmail && (
                    <span className="text-xs opacity-70 ml-1">({t('admin.adminUsers.you')})</span>
                  )}
                  {email !== currentUserEmail && adminEmails.length > 1 && (
                    <button
                      onClick={() => handleRemove(email)}
                      disabled={removingEmail === email}
                      className="ml-1 hover:bg-destructive/20 rounded p-0.5 transition-colors"
                      aria-label={`Remove ${email}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </Badge>
              ))}
            </div>

            {/* Add new admin form */}
            <div className="flex gap-2 pt-2">
              <Input
                type="email"
                placeholder={t('admin.adminUsers.emailPlaceholder')}
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                className="max-w-xs"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleAdd}
                disabled={isAdding || !newEmail.trim()}
                className="gap-1"
              >
                <UserPlus className="h-4 w-4" />
                {t('admin.adminUsers.add')}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function SystemConfigPage() {
  const { user, signOut } = useAdminAuth();
  const { t } = useAdminTranslations();
  const [configs, setConfigs] = useState<SystemConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Admin emails state (extracted from configs)
  const [adminEmails, setAdminEmails] = useState<string[]>([]);

  // Refresh trigger for manual refresh and after save
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Fetch configs from Supabase on mount and when refreshTrigger changes
  useEffect(() => {
    let cancelled = false;

    async function fetchConfigs() {
      setLoading(true);
      setError(null);

      try {
        const { data, error: fetchError } = await supabase
          .from('system_config')
          .select('*')
          .order('key');

        if (fetchError) {
          throw fetchError;
        }

        if (!cancelled) {
          setConfigs(data || []);
          // Extract admin_emails from configs
          const adminConfig = data?.find((c: SystemConfig) => c.key === 'admin_emails');
          if (adminConfig && Array.isArray(adminConfig.value)) {
            setAdminEmails(adminConfig.value as string[]);
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load configurations';
        if (!cancelled) {
          setError(message);
          toast.error('Failed to load configurations', { description: message });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchConfigs();

    return () => {
      cancelled = true;
    };
  }, [refreshTrigger]);

  // Handle manual refresh
  const handleRefresh = () => setRefreshTrigger((prev) => prev + 1);

  // Add admin email
  const handleAddAdmin = async (email: string) => {
    const newEmails = [...adminEmails, email];
    const { error: updateError } = await supabase
      .from('system_config')
      .update({
        value: newEmails,
        updated_at: new Date().toISOString(),
      })
      .eq('key', 'admin_emails');

    if (updateError) {
      throw updateError;
    }

    setAdminEmails(newEmails);
    handleRefresh();
  };

  // Remove admin email
  const handleRemoveAdmin = async (email: string) => {
    const newEmails = adminEmails.filter((e) => e !== email);
    const { error: updateError } = await supabase
      .from('system_config')
      .update({
        value: newEmails,
        updated_at: new Date().toISOString(),
      })
      .eq('key', 'admin_emails');

    if (updateError) {
      throw updateError;
    }

    setAdminEmails(newEmails);
    handleRefresh();
  };

  // Handle config updates from child components
  const handleConfigUpdate = useCallback(async (key: string, value: unknown) => {
    const { error } = await supabase
      .from('system_config')
      .update({
        value: value,
        updated_at: new Date().toISOString(),
      })
      .eq('key', key);

    if (error) {
      throw error;
    }

    // Refresh configs after update
    setRefreshTrigger((prev) => prev + 1);
  }, []); // Empty deps - setRefreshTrigger is stable, supabase is stable

  return (
    <AdminLayout
      title={t('admin.systemConfig.title')}
      userName={user?.user_metadata?.full_name || user?.email || 'Admin'}
      userEmail={user?.email}
      userAvatar={user?.user_metadata?.avatar_url}
      onLogout={signOut}
    >
      {/* Admin Users Management Card */}
      <AdminUsersCard
        adminEmails={adminEmails}
        currentUserEmail={user?.email}
        onAddAdmin={handleAddAdmin}
        onRemoveAdmin={handleRemoveAdmin}
        loading={loading}
        t={t}
      />

      {/* Configuration sections wrapped in Error Boundary */}
      <ErrorBoundary
        FallbackComponent={ConfigErrorFallback}
        onReset={handleRefresh}
        resetKeys={[refreshTrigger]}
      >
        {/* Tabs for configuration sections */}
        <Tabs defaultValue="vision" className="mt-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="vision">Vision</TabsTrigger>
            <TabsTrigger value="interpretation">Interpretation</TabsTrigger>
            <TabsTrigger value="personas">{t('admin.systemConfig.tabs.personas')}</TabsTrigger>
            <TabsTrigger value="system">System</TabsTrigger>
          </TabsList>

          <TabsContent value="vision" className="mt-4">
            {loading ? (
              <ConfigTabSkeleton />
            ) : (
              <VisionStageSettings
                visionModel={getStringConfig(configs, 'vision_model', 'google/gemini-1.5-flash')}
                visionTemperature={getNumberConfig(configs, 'vision_temperature', 0.7)}
                visionMaxTokens={getNumberConfig(configs, 'vision_max_tokens', 4096)}
                onUpdate={handleConfigUpdate}
                loading={loading}
              />
            )}
          </TabsContent>

          <TabsContent value="interpretation" className="mt-4">
            {loading ? (
              <ConfigTabSkeleton />
            ) : (
              <InterpretationStageSettings
                interpretationModel={getStringConfig(configs, 'interpretation_model', 'google/gemini-1.5-flash')}
                interpretationTemperature={getNumberConfig(configs, 'interpretation_temperature', 0.7)}
                interpretationMaxTokens={getNumberConfig(configs, 'interpretation_max_tokens', 2048)}
                onUpdate={handleConfigUpdate}
                loading={loading}
              />
            )}
          </TabsContent>

          <TabsContent value="personas" className="mt-4">
            {loading ? (
              <ConfigTabSkeleton />
            ) : (
              <PersonasSettings
                arinaModel={getStringConfig(configs, 'arina_model', 'xiaomi/mimo-v2-flash:free')}
                arinaTemperature={getNumberConfig(configs, 'arina_temperature', 0.9)}
                arinaMaxTokens={getNumberConfig(configs, 'arina_max_tokens', 1200)}
                arinaFrequencyPenalty={getNumberConfig(configs, 'arina_frequency_penalty', 0)}
                arinaPresencePenalty={getNumberConfig(configs, 'arina_presence_penalty', 0)}
                arinaPrompt={getStringConfig(configs, 'arina_prompt', '')}
                cassandraModel={getStringConfig(configs, 'cassandra_model', 'moonshotai/kimi-k2')}
                cassandraTemperature={getNumberConfig(configs, 'cassandra_temperature', 1.0)}
                cassandraMaxTokens={getNumberConfig(configs, 'cassandra_max_tokens', 1500)}
                cassandraFrequencyPenalty={getNumberConfig(configs, 'cassandra_frequency_penalty', 0)}
                cassandraPresencePenalty={getNumberConfig(configs, 'cassandra_presence_penalty', 0)}
                cassandraPrompt={getStringConfig(configs, 'cassandra_prompt', '')}
                onUpdate={handleConfigUpdate}
                loading={loading}
              />
            )}
          </TabsContent>

          <TabsContent value="system" className="mt-4">
            {loading ? (
              <ConfigTabSkeleton />
            ) : (
              <SystemSettings
                configs={{
                  daily_chat_limit: getNumberConfig(configs, 'daily_chat_limit', 50),
                  default_language: getStringConfig(configs, 'default_language', 'ru'),
                  maintenance_mode: getBooleanConfig(configs, 'maintenance_mode', false),
                  proactive_messages_enabled: getBooleanConfig(configs, 'proactive_messages_enabled', true),
                }}
                onUpdate={handleConfigUpdate}
                loading={loading}
              />
            )}
          </TabsContent>
        </Tabs>
      </ErrorBoundary>
    </AdminLayout>
  );
}

export default SystemConfigPage;
