import React, { useState, useCallback, memo } from 'react';
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
import { Eye, ChevronDown, ChevronUp } from 'lucide-react';
import { useAdminTranslations } from '@/admin/hooks/useAdminTranslations';
import { useConfigUpdate } from '@/admin/hooks/useConfigUpdate';
import { toast } from 'sonner';

// Constants for temperature and max tokens validation
const MIN_TEMPERATURE = 0;
const MAX_TEMPERATURE = 2;
const DEFAULT_TEMPERATURE = 0.7;
const MIN_MAX_TOKENS = 1;
const MAX_MAX_TOKENS = 8192;
const DEFAULT_MAX_TOKENS = 4096;

interface VisionStageSettingsProps {
  visionModel: string;
  visionTemperature: number;
  visionMaxTokens: number;
  onUpdate: (key: string, value: unknown) => Promise<void>;
  loading: boolean;
}

// Vision model options with display labels
const VISION_MODELS = [
  { value: 'google/gemini-1.5-flash', label: 'Google Gemini 1.5 Flash (Recommended)' },
  { value: 'google/gemini-1.5-pro', label: 'Google Gemini 1.5 Pro' },
  { value: 'x-ai/grok-vision-beta', label: 'X.AI Grok Vision Beta' },
  { value: 'openai/gpt-4-vision-preview', label: 'OpenAI GPT-4 Vision' },
  { value: 'anthropic/claude-3-5-sonnet', label: 'Anthropic Claude 3.5 Sonnet' },
] as const;

export const VisionStageSettings = memo(function VisionStageSettings({
  visionModel,
  visionTemperature,
  visionMaxTokens,
  onUpdate,
  loading,
}: VisionStageSettingsProps): React.ReactElement {
  const { t } = useAdminTranslations();

  // Model config
  const {
    value: selectedModel,
    saving: modelSaving,
    handleUpdate: handleModelUpdate,
  } = useConfigUpdate(
    visionModel,
    'vision_model',
    onUpdate,
    t('admin.systemConfig.modelUpdated')
  );

  // Temperature config
  const {
    value: temperature,
    saving: tempSaving,
    handleUpdate: handleTempUpdate,
  } = useConfigUpdate(
    visionTemperature,
    'vision_temperature',
    onUpdate,
    t('admin.systemConfig.vision.temperatureUpdated')
  );

  // Max tokens config
  const {
    value: maxTokens,
    setValue: setMaxTokens,
    saving: tokensSaving,
    handleUpdate: handleTokensUpdate,
  } = useConfigUpdate(
    visionMaxTokens,
    'vision_max_tokens',
    onUpdate,
    t('admin.systemConfig.vision.maxTokensUpdated')
  );

  const [advancedOpen, setAdvancedOpen] = useState(false);

  // Combined saving state
  const saving = modelSaving || tempSaving || tokensSaving;

  // Handle max tokens blur with validation
  const handleMaxTokensBlur = useCallback(async () => {
    if (maxTokens === visionMaxTokens) return;
    if (maxTokens < MIN_MAX_TOKENS || maxTokens > MAX_MAX_TOKENS) {
      toast.error(t('admin.systemConfig.vision.maxTokensInvalid'));
      setMaxTokens(visionMaxTokens);
      return;
    }
    await handleTokensUpdate(maxTokens);
  }, [maxTokens, visionMaxTokens, handleTokensUpdate, setMaxTokens, t]);

  // Get display label for selected model
  const selectedModelLabel = VISION_MODELS.find(m => m.value === selectedModel)?.label || selectedModel;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Eye className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          {t('admin.systemConfig.vision.title')}
        </CardTitle>
        <CardDescription>
          {t('admin.systemConfig.vision.description')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Model Selector */}
        <div className="space-y-2">
          <Label htmlFor="vision-model">{t('admin.systemConfig.vision.model')}</Label>
          <Select
            value={selectedModel}
            onValueChange={handleModelUpdate}
            disabled={loading || saving}
          >
            <SelectTrigger id="vision-model" className="w-full">
              <SelectValue placeholder={t('admin.systemConfig.vision.selectPlaceholder')}>
                {selectedModelLabel}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {VISION_MODELS.map((model) => (
                <SelectItem key={model.value} value={model.value}>
                  {model.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {saving && (
            <p className="text-xs text-muted-foreground animate-pulse">
              {t('admin.systemConfig.savingChanges')}
            </p>
          )}
        </div>

        {/* Current Model Display */}
        <div className="rounded-lg bg-muted/50 p-3 border border-border/50">
          <p className="text-sm font-medium text-muted-foreground mb-1">{t('admin.systemConfig.vision.currentModel')}</p>
          <code className="text-sm font-mono bg-background px-2 py-1 rounded">
            {selectedModel}
          </code>
        </div>

        {/* Advanced Settings */}
        <div className="border-t pt-4">
          <button
            onClick={() => setAdvancedOpen(!advancedOpen)}
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors w-full"
            aria-expanded={advancedOpen}
            aria-label={advancedOpen
              ? t('admin.systemConfig.hideAdvancedSettings')
              : t('admin.systemConfig.showAdvancedSettings')
            }
            aria-controls="vision-advanced-settings"
          >
            {advancedOpen ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
            {t('admin.systemConfig.vision.advancedSettings')}
          </button>

          {advancedOpen && (
            <div id="vision-advanced-settings" className="mt-4 space-y-4">
              {/* Temperature Slider */}
              <div className="space-y-2">
                <Label htmlFor="vision-temperature">
                  {t('admin.systemConfig.vision.temperature')}
                  <span className="ml-2 text-xs text-muted-foreground font-normal">
                    ({MIN_TEMPERATURE}.0 - {MAX_TEMPERATURE}.0, default: {DEFAULT_TEMPERATURE})
                  </span>
                </Label>
                <div className="flex items-center gap-4">
                  <input
                    id="vision-temperature"
                    type="range"
                    min={MIN_TEMPERATURE}
                    max={MAX_TEMPERATURE}
                    step="0.1"
                    value={temperature}
                    onChange={(e) => handleTempUpdate(parseFloat(e.target.value))}
                    disabled={loading || saving}
                    className="flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer"
                  />
                  <span className="text-sm font-mono bg-muted px-2 py-1 rounded min-w-[3rem] text-center">
                    {temperature.toFixed(1)}
                  </span>
                </div>
              </div>

              {/* Max Tokens Input */}
              <div className="space-y-2">
                <Label htmlFor="vision-max-tokens">
                  {t('admin.systemConfig.vision.maxTokens')}
                  <span className="ml-2 text-xs text-muted-foreground font-normal">
                    ({MIN_MAX_TOKENS} - {MAX_MAX_TOKENS}, default: {DEFAULT_MAX_TOKENS})
                  </span>
                </Label>
                <Input
                  id="vision-max-tokens"
                  type="number"
                  min={MIN_MAX_TOKENS}
                  max={MAX_MAX_TOKENS}
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(parseInt(e.target.value) || DEFAULT_MAX_TOKENS)}
                  onBlur={handleMaxTokensBlur}
                  disabled={loading || saving}
                  className="max-w-xs"
                />
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
});

VisionStageSettings.displayName = 'VisionStageSettings';
