import React, { useCallback, memo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { AlertTriangle } from 'lucide-react';
import { useAdminTranslations } from '@/admin/hooks/useAdminTranslations';
import { useConfigUpdate } from '@/admin/hooks/useConfigUpdate';

interface SystemSettingsProps {
  configs: {
    daily_chat_limit: number;
    default_language: string;
    maintenance_mode: boolean;
    proactive_messages_enabled: boolean;
  };
  onUpdate: (key: string, value: unknown) => Promise<void>;
  loading: boolean;
}

const MIN_CHAT_LIMIT = 0;
const MAX_CHAT_LIMIT = 1000;

export const SystemSettings = memo(function SystemSettings({ configs, onUpdate, loading }: SystemSettingsProps): React.ReactElement {
  const { t } = useAdminTranslations();

  // Chat limit config
  const {
    value: chatLimit,
    setValue: setChatLimit,
    saving: chatLimitSaving,
    handleUpdate: handleChatLimitUpdate
  } = useConfigUpdate(
    configs.daily_chat_limit,
    'daily_chat_limit',
    onUpdate,
    t('admin.systemConfig.system.chatLimitUpdated')
  );

  // Language config
  const {
    value: language,
    saving: languageSaving,
    handleUpdate: handleLanguageUpdate
  } = useConfigUpdate(
    configs.default_language,
    'default_language',
    onUpdate,
    t('admin.systemConfig.system.languageUpdated')
  );

  // Maintenance mode config
  const {
    value: maintenanceMode,
    saving: maintenanceSaving,
    handleUpdate: handleMaintenanceUpdate
  } = useConfigUpdate(
    configs.maintenance_mode,
    'maintenance_mode',
    onUpdate,
    '' // Custom toast message handled in wrapper
  );

  // Proactive messages config
  const {
    value: proactiveMessages,
    saving: proactiveSaving,
    handleUpdate: handleProactiveUpdate
  } = useConfigUpdate(
    configs.proactive_messages_enabled,
    'proactive_messages_enabled',
    onUpdate,
    t('admin.systemConfig.system.proactiveMessagesUpdated')
  );

  const saving = chatLimitSaving || languageSaving || maintenanceSaving || proactiveSaving;

  const handleChatLimitBlur = useCallback(async () => {
    if (chatLimit === configs.daily_chat_limit) return;

    if (chatLimit < MIN_CHAT_LIMIT || chatLimit > MAX_CHAT_LIMIT) {
      toast.error(t('admin.systemConfig.system.chatLimitInvalid'), {
        description: `Chat limit must be between ${MIN_CHAT_LIMIT} and ${MAX_CHAT_LIMIT}`,
      });
      setChatLimit(configs.daily_chat_limit); // Revert
      return;
    }

    await handleChatLimitUpdate(chatLimit);
  }, [chatLimit, configs.daily_chat_limit, handleChatLimitUpdate, setChatLimit, t]);

  const handleMaintenanceModeToggle = useCallback(async (checked: boolean) => {
    await handleMaintenanceUpdate(checked);
    if (checked) {
      toast.warning(t('admin.systemConfig.system.maintenanceModeEnabled'));
    } else {
      toast.success(t('admin.systemConfig.system.maintenanceModeDisabled'));
    }
  }, [handleMaintenanceUpdate, t]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('admin.systemConfig.system.title')}</CardTitle>
        <CardDescription>
          {t('admin.systemConfig.system.description')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Daily Chat Limit */}
        <div className="space-y-2">
          <Label htmlFor="chat-limit">{t('admin.systemConfig.system.chatLimit')}</Label>
          <p className="text-sm text-muted-foreground">
            {t('admin.systemConfig.system.chatLimitDesc')}
          </p>
          <Input
            id="chat-limit"
            type="number"
            min={MIN_CHAT_LIMIT}
            max={MAX_CHAT_LIMIT}
            value={chatLimit}
            onChange={(e) => setChatLimit(parseInt(e.target.value) || 0)}
            onBlur={handleChatLimitBlur}
            disabled={loading || saving}
            className="max-w-xs"
          />
          {saving && (
            <p className="text-xs text-muted-foreground animate-pulse">
              {t('admin.systemConfig.savingChanges')}
            </p>
          )}
        </div>

        <Separator />

        {/* Default Language */}
        <div className="space-y-2">
          <Label htmlFor="default-language">{t('admin.systemConfig.system.defaultLanguage')}</Label>
          <p className="text-sm text-muted-foreground">
            {t('admin.systemConfig.system.defaultLanguageDesc')}
          </p>
          <Select
            value={language}
            onValueChange={handleLanguageUpdate}
            disabled={loading || saving}
          >
            <SelectTrigger id="default-language" className="max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ru">Русский (Russian)</SelectItem>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="zh">中文 (Chinese)</SelectItem>
            </SelectContent>
          </Select>
          {saving && (
            <p className="text-xs text-muted-foreground animate-pulse">
              {t('admin.systemConfig.savingChanges')}
            </p>
          )}
        </div>

        <Separator />

        {/* Maintenance Mode */}
        <div className="flex items-center justify-between">
          <div className="space-y-1 flex-1">
            <div className="flex items-center gap-2">
              <Label htmlFor="maintenance-mode">{t('admin.systemConfig.system.maintenanceMode')}</Label>
              {maintenanceMode && (
                <AlertTriangle className="h-4 w-4 text-destructive" />
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {t('admin.systemConfig.system.maintenanceModeDesc')}
            </p>
          </div>
          <Switch
            id="maintenance-mode"
            checked={maintenanceMode}
            onCheckedChange={handleMaintenanceModeToggle}
            disabled={loading || saving}
          />
        </div>

        <Separator />

        {/* Proactive Messages */}
        <div className="flex items-center justify-between">
          <div className="space-y-1 flex-1">
            <Label htmlFor="proactive-messages">{t('admin.systemConfig.system.proactiveMessages')}</Label>
            <p className="text-sm text-muted-foreground">
              {t('admin.systemConfig.system.proactiveMessagesDesc')}
            </p>
          </div>
          <Switch
            id="proactive-messages"
            checked={proactiveMessages}
            onCheckedChange={handleProactiveUpdate}
            disabled={loading || saving}
          />
        </div>
      </CardContent>
    </Card>
  );
});

SystemSettings.displayName = 'SystemSettings';
