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
import { toast } from 'sonner';
import { Brain, ChevronDown, ChevronUp } from 'lucide-react';
import { useAdminTranslations } from '@/admin/hooks/useAdminTranslations';
import { useConfigUpdate } from '@/admin/hooks/useConfigUpdate';
import { cn } from '@/lib/utils';

interface InterpretationStageSettingsProps {
  interpretationModel: string;
  interpretationTemperature: number;
  interpretationMaxTokens: number;
  onUpdate: (key: string, value: unknown) => Promise<void>;
  loading: boolean;
}

// Text model options with display labels
const INTERPRETATION_MODELS = [
  { value: 'google/gemini-1.5-flash', label: 'Google Gemini 1.5 Flash (Recommended)' },
  { value: 'google/gemini-1.5-pro', label: 'Google Gemini 1.5 Pro' },
  { value: 'anthropic/claude-3-5-sonnet', label: 'Anthropic Claude 3.5 Sonnet' },
  { value: 'anthropic/claude-3-5-haiku', label: 'Anthropic Claude 3.5 Haiku' },
  { value: 'openai/gpt-4o', label: 'OpenAI GPT-4o' },
  { value: 'openai/gpt-4o-mini', label: 'OpenAI GPT-4o Mini' },
] as const;

// Validation constants
const MIN_TEMPERATURE = 0;
const MAX_TEMPERATURE = 2;
const DEFAULT_TEMPERATURE = 0.7;
const MIN_MAX_TOKENS = 1;
const MAX_MAX_TOKENS = 8192;
const DEFAULT_MAX_TOKENS = 2048;

export const InterpretationStageSettings = memo(function InterpretationStageSettings({
  interpretationModel,
  interpretationTemperature,
  interpretationMaxTokens,
  onUpdate,
  loading,
}: InterpretationStageSettingsProps): React.ReactElement {
  const { t } = useAdminTranslations();

  // Model config
  const { value: selectedModel, saving: modelSaving, handleUpdate: handleModelUpdate } = useConfigUpdate(
    interpretationModel,
    'interpretation_model',
    onUpdate,
    t('admin.systemConfig.modelUpdated')
  );

  // Temperature config
  const {
    value: temperature,
    setValue: setTemperature,
    saving: tempSaving,
    handleUpdate: handleTempUpdate
  } = useConfigUpdate(
    interpretationTemperature,
    'interpretation_temperature',
    onUpdate,
    t('admin.systemConfig.interpretation.temperatureUpdated')
  );

  // Max tokens config
  const {
    value: maxTokens,
    setValue: setMaxTokens,
    saving: tokensSaving,
    handleUpdate: handleTokensUpdate
  } = useConfigUpdate(
    interpretationMaxTokens,
    'interpretation_max_tokens',
    onUpdate,
    t('admin.systemConfig.interpretation.maxTokensUpdated')
  );

  const saving = modelSaving || tempSaving || tokensSaving;
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // Real-time validation state
  const [temperatureError, setTemperatureError] = useState<string | null>(null);
  const [maxTokensError, setMaxTokensError] = useState<string | null>(null);

  // Helper to format temperature range message
  const getTemperatureRangeMessage = useCallback(() => {
    return t('admin.systemConfig.interpretation.temperatureRange')
      .replace('{min}', String(MIN_TEMPERATURE))
      .replace('{max}', String(MAX_TEMPERATURE));
  }, [t]);

  // Helper to format max tokens range message
  const getMaxTokensRangeMessage = useCallback(() => {
    return t('admin.systemConfig.interpretation.maxTokensRange')
      .replace('{min}', String(MIN_MAX_TOKENS))
      .replace('{max}', String(MAX_MAX_TOKENS));
  }, [t]);

  // Temperature handlers with validation
  const handleTemperatureChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setTemperature(value);

    // Real-time validation
    if (value < MIN_TEMPERATURE || value > MAX_TEMPERATURE) {
      setTemperatureError(getTemperatureRangeMessage());
    } else {
      setTemperatureError(null);
    }
  }, [setTemperature, getTemperatureRangeMessage]);

  const handleTemperatureBlur = useCallback(async () => {
    if (temperature === interpretationTemperature) return;

    if (temperature < MIN_TEMPERATURE || temperature > MAX_TEMPERATURE) {
      toast.error(t('admin.systemConfig.interpretation.temperatureInvalid'));
      setTemperature(interpretationTemperature); // Revert
      setTemperatureError(null);
      return;
    }

    await handleTempUpdate(temperature);
  }, [temperature, interpretationTemperature, handleTempUpdate, setTemperature, t]);

  // Max tokens handlers with validation
  const handleMaxTokensChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value) || DEFAULT_MAX_TOKENS;
    setMaxTokens(value);

    // Real-time validation
    if (value < MIN_MAX_TOKENS || value > MAX_MAX_TOKENS) {
      setMaxTokensError(getMaxTokensRangeMessage());
    } else {
      setMaxTokensError(null);
    }
  }, [setMaxTokens, getMaxTokensRangeMessage]);

  const handleMaxTokensBlur = useCallback(async () => {
    if (maxTokens === interpretationMaxTokens) return;

    if (maxTokens < MIN_MAX_TOKENS || maxTokens > MAX_MAX_TOKENS) {
      toast.error(t('admin.systemConfig.interpretation.maxTokensInvalid'));
      setMaxTokens(interpretationMaxTokens); // Revert
      setMaxTokensError(null);
      return;
    }

    await handleTokensUpdate(maxTokens);
  }, [maxTokens, interpretationMaxTokens, handleTokensUpdate, setMaxTokens, t]);

  // Get display label for selected model
  const selectedModelLabel = INTERPRETATION_MODELS.find(m => m.value === selectedModel)?.label || selectedModel;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-purple-600 dark:text-purple-400" />
          {t('admin.systemConfig.interpretation.title')}
        </CardTitle>
        <CardDescription>
          {t('admin.systemConfig.interpretation.description')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Model Selector */}
        <div className="space-y-2">
          <Label htmlFor="interpretation-model">{t('admin.systemConfig.interpretation.model')}</Label>
          <Select
            value={selectedModel}
            onValueChange={handleModelUpdate}
            disabled={loading || saving}
          >
            <SelectTrigger id="interpretation-model" className="w-full">
              <SelectValue placeholder={t('admin.systemConfig.interpretation.selectPlaceholder')}>
                {selectedModelLabel}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {INTERPRETATION_MODELS.map((model) => (
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
          <p className="text-sm font-medium text-muted-foreground mb-1">{t('admin.systemConfig.interpretation.currentModel')}</p>
          <code className="text-sm font-mono bg-background px-2 py-1 rounded">
            {selectedModel}
          </code>
        </div>

        {/* Advanced Settings */}
        <div className="border-t pt-4">
          <button
            type="button"
            onClick={() => setAdvancedOpen(!advancedOpen)}
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors w-full"
            aria-expanded={advancedOpen}
            aria-label={advancedOpen
              ? t('admin.systemConfig.hideAdvancedSettings')
              : t('admin.systemConfig.showAdvancedSettings')
            }
            aria-controls="interpretation-advanced-settings"
          >
            {advancedOpen ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
            {t('admin.systemConfig.interpretation.advancedSettings')}
          </button>

          {advancedOpen && (
            <div id="interpretation-advanced-settings" className="mt-4 space-y-4">
              {/* Temperature Slider */}
              <div className="space-y-2">
                <Label htmlFor="interpretation-temperature">
                  {t('admin.systemConfig.interpretation.temperature')}
                  <span className="ml-2 text-xs text-muted-foreground font-normal">
                    ({MIN_TEMPERATURE}.0 - {MAX_TEMPERATURE}.0, {t('admin.systemConfig.interpretation.default')}: {DEFAULT_TEMPERATURE})
                  </span>
                </Label>
                <div className="flex items-center gap-4">
                  <input
                    id="interpretation-temperature"
                    type="range"
                    min={MIN_TEMPERATURE}
                    max={MAX_TEMPERATURE}
                    step="0.1"
                    value={temperature}
                    onChange={handleTemperatureChange}
                    onBlur={handleTemperatureBlur}
                    disabled={loading || saving}
                    className={cn(
                      "flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer",
                      (loading || saving) && "cursor-not-allowed opacity-50"
                    )}
                  />
                  <span className="text-sm font-mono bg-muted px-2 py-1 rounded min-w-[3rem] text-center">
                    {temperature.toFixed(1)}
                  </span>
                </div>
                {temperatureError && (
                  <p className="text-xs text-destructive">{temperatureError}</p>
                )}
              </div>

              {/* Max Tokens Input */}
              <div className="space-y-2">
                <Label htmlFor="interpretation-max-tokens">
                  {t('admin.systemConfig.interpretation.maxTokens')}
                  <span className="ml-2 text-xs text-muted-foreground font-normal">
                    ({MIN_MAX_TOKENS} - {MAX_MAX_TOKENS}, {t('admin.systemConfig.interpretation.default')}: {DEFAULT_MAX_TOKENS})
                  </span>
                </Label>
                <Input
                  id="interpretation-max-tokens"
                  type="number"
                  min={MIN_MAX_TOKENS}
                  max={MAX_MAX_TOKENS}
                  value={maxTokens}
                  onChange={handleMaxTokensChange}
                  onBlur={handleMaxTokensBlur}
                  disabled={loading || saving}
                  className={cn(
                    "max-w-xs",
                    maxTokensError && "border-destructive"
                  )}
                />
                {maxTokensError && (
                  <p className="text-xs text-destructive">{maxTokensError}</p>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
});

InterpretationStageSettings.displayName = 'InterpretationStageSettings';
