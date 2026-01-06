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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { Users, ChevronDown, ChevronUp, HelpCircle } from 'lucide-react';
import { useAdminTranslations } from '@/admin/hooks/useAdminTranslations';
import { useConfigUpdate } from '@/admin/hooks/useConfigUpdate';
import { cn } from '@/lib/utils';

interface PersonasSettingsProps {
  arinaModel: string;
  arinaTemperature: number;
  arinaMaxTokens: number;
  arinaFrequencyPenalty: number;
  arinaPresencePenalty: number;
  arinaPrompt: string;
  cassandraModel: string;
  cassandraTemperature: number;
  cassandraMaxTokens: number;
  cassandraFrequencyPenalty: number;
  cassandraPresencePenalty: number;
  cassandraPrompt: string;
  onUpdate: (key: string, value: unknown) => Promise<void>;
  loading: boolean;
}

// Persona model options with display labels
const PERSONA_MODELS = [
  { value: 'xiaomi/mimo-v2-flash:free', label: 'Xiaomi MiMo v2 Flash (Free)' },
  { value: 'moonshotai/kimi-k2', label: 'Moonshot Kimi K2' },
  { value: 'google/gemini-1.5-flash', label: 'Google Gemini 1.5 Flash' },
  { value: 'google/gemini-1.5-pro', label: 'Google Gemini 1.5 Pro' },
  { value: 'anthropic/claude-3-5-sonnet', label: 'Anthropic Claude 3.5 Sonnet' },
  { value: 'anthropic/claude-3-5-haiku', label: 'Anthropic Claude 3.5 Haiku' },
  { value: 'openai/gpt-4o', label: 'OpenAI GPT-4o' },
  { value: 'openai/gpt-4o-mini', label: 'OpenAI GPT-4o Mini' },
] as const;

// Validation constants
const MIN_PROMPT_LENGTH = 50;
const MIN_TEMPERATURE = 0;
const MAX_TEMPERATURE = 2;
const DEFAULT_TEMPERATURE = 0.7;
const MIN_MAX_TOKENS = 1;
const MAX_MAX_TOKENS = 8192;
const DEFAULT_MAX_TOKENS = 2048;
const MIN_PENALTY = 0;
const MAX_PENALTY = 2;
const DEFAULT_FREQUENCY_PENALTY = 0;
const DEFAULT_PRESENCE_PENALTY = 0;

export const PersonasSettings = memo(function PersonasSettings({
  arinaModel,
  arinaTemperature,
  arinaMaxTokens,
  arinaFrequencyPenalty,
  arinaPresencePenalty,
  arinaPrompt,
  cassandraModel,
  cassandraTemperature,
  cassandraMaxTokens,
  cassandraFrequencyPenalty,
  cassandraPresencePenalty,
  cassandraPrompt,
  onUpdate,
  loading,
}: PersonasSettingsProps): React.ReactElement {
  const { t } = useAdminTranslations();

  // Arina model config
  const {
    value: arinaModelValue,
    saving: arinaModelSaving,
    handleUpdate: handleArinaModelUpdate,
  } = useConfigUpdate(
    arinaModel,
    'arina_model',
    onUpdate,
    t('admin.systemConfig.personas.modelUpdated')
  );

  // Arina temperature config
  const {
    value: arinaTemp,
    setValue: setArinaTemp,
    saving: arinaTempSaving,
    handleUpdate: handleArinaTempUpdate,
  } = useConfigUpdate(
    arinaTemperature,
    'arina_temperature',
    onUpdate,
    t('admin.systemConfig.personas.temperatureUpdated')
  );

  // Arina max tokens config
  const {
    value: arinaTokens,
    setValue: setArinaTokens,
    saving: arinaTokensSaving,
    handleUpdate: handleArinaTokensUpdate,
  } = useConfigUpdate(
    arinaMaxTokens,
    'arina_max_tokens',
    onUpdate,
    t('admin.systemConfig.personas.maxTokensUpdated')
  );

  // Arina frequency penalty config
  const {
    value: arinaFreqPenalty,
    setValue: setArinaFreqPenalty,
    saving: arinaFreqPenaltySaving,
    handleUpdate: handleArinaFreqPenaltyUpdate,
  } = useConfigUpdate(
    arinaFrequencyPenalty,
    'arina_frequency_penalty',
    onUpdate,
    t('admin.systemConfig.personas.frequencyPenaltyUpdated')
  );

  // Arina presence penalty config
  const {
    value: arinaPresPenalty,
    setValue: setArinaPresPenalty,
    saving: arinaPresPenaltySaving,
    handleUpdate: handleArinaPresPenaltyUpdate,
  } = useConfigUpdate(
    arinaPresencePenalty,
    'arina_presence_penalty',
    onUpdate,
    t('admin.systemConfig.personas.presencePenaltyUpdated')
  );

  // Arina prompt config
  const {
    value: arinaPromptValue,
    setValue: setArinaPromptValue,
    saving: arinaPromptSaving,
    handleUpdate: handleArinaPromptUpdate,
  } = useConfigUpdate(
    arinaPrompt,
    'arina_prompt',
    onUpdate,
    t('admin.systemConfig.personas.promptUpdated')
  );

  // Cassandra model config
  const {
    value: cassandraModelValue,
    saving: cassandraModelSaving,
    handleUpdate: handleCassandraModelUpdate,
  } = useConfigUpdate(
    cassandraModel,
    'cassandra_model',
    onUpdate,
    t('admin.systemConfig.personas.modelUpdated')
  );

  // Cassandra temperature config
  const {
    value: cassandraTemp,
    setValue: setCassandraTemp,
    saving: cassandraTempSaving,
    handleUpdate: handleCassandraTempUpdate,
  } = useConfigUpdate(
    cassandraTemperature,
    'cassandra_temperature',
    onUpdate,
    t('admin.systemConfig.personas.temperatureUpdated')
  );

  // Cassandra max tokens config
  const {
    value: cassandraTokens,
    setValue: setCassandraTokens,
    saving: cassandraTokensSaving,
    handleUpdate: handleCassandraTokensUpdate,
  } = useConfigUpdate(
    cassandraMaxTokens,
    'cassandra_max_tokens',
    onUpdate,
    t('admin.systemConfig.personas.maxTokensUpdated')
  );

  // Cassandra frequency penalty config
  const {
    value: cassandraFreqPenalty,
    setValue: setCassandraFreqPenalty,
    saving: cassandraFreqPenaltySaving,
    handleUpdate: handleCassandraFreqPenaltyUpdate,
  } = useConfigUpdate(
    cassandraFrequencyPenalty,
    'cassandra_frequency_penalty',
    onUpdate,
    t('admin.systemConfig.personas.frequencyPenaltyUpdated')
  );

  // Cassandra presence penalty config
  const {
    value: cassandraPresPenalty,
    setValue: setCassandraPresPenalty,
    saving: cassandraPresPenaltySaving,
    handleUpdate: handleCassandraPresPenaltyUpdate,
  } = useConfigUpdate(
    cassandraPresencePenalty,
    'cassandra_presence_penalty',
    onUpdate,
    t('admin.systemConfig.personas.presencePenaltyUpdated')
  );

  // Cassandra prompt config
  const {
    value: cassandraPromptValue,
    setValue: setCassandraPromptValue,
    saving: cassandraPromptSaving,
    handleUpdate: handleCassandraPromptUpdate,
  } = useConfigUpdate(
    cassandraPrompt,
    'cassandra_prompt',
    onUpdate,
    t('admin.systemConfig.personas.promptUpdated')
  );

  // UI state
  const [arinaAdvancedOpen, setArinaAdvancedOpen] = useState(false);
  const [cassandraAdvancedOpen, setCassandraAdvancedOpen] = useState(false);

  // Validation errors
  const [arinaPromptError, setArinaPromptError] = useState<string | null>(null);
  const [cassandraPromptError, setCassandraPromptError] = useState<string | null>(null);
  const [arinaTempError, setArinaTempError] = useState<string | null>(null);
  const [cassandraTempError, setCassandraTempError] = useState<string | null>(null);
  const [arinaTokensError, setArinaTokensError] = useState<string | null>(null);
  const [cassandraTokensError, setCassandraTokensError] = useState<string | null>(null);
  const [arinaFreqPenaltyError, setArinaFreqPenaltyError] = useState<string | null>(null);
  const [arinaPresPenaltyError, setArinaPresPenaltyError] = useState<string | null>(null);
  const [cassandraFreqPenaltyError, setCassandraFreqPenaltyError] = useState<string | null>(null);
  const [cassandraPresPenaltyError, setCassandraPresPenaltyError] = useState<string | null>(null);

  // Combined saving state
  const saving =
    arinaModelSaving ||
    arinaTempSaving ||
    arinaTokensSaving ||
    arinaFreqPenaltySaving ||
    arinaPresPenaltySaving ||
    arinaPromptSaving ||
    cassandraModelSaving ||
    cassandraTempSaving ||
    cassandraTokensSaving ||
    cassandraFreqPenaltySaving ||
    cassandraPresPenaltySaving ||
    cassandraPromptSaving;

  // Helper messages
  const getPromptMinLengthMessage = useCallback(() => {
    return t('admin.systemConfig.personas.promptMinLength').replace('{count}', String(MIN_PROMPT_LENGTH));
  }, [t]);

  const getTemperatureRangeMessage = useCallback(() => {
    return t('admin.systemConfig.personas.temperatureRange')
      .replace('{min}', String(MIN_TEMPERATURE))
      .replace('{max}', String(MAX_TEMPERATURE));
  }, [t]);

  const getMaxTokensRangeMessage = useCallback(() => {
    return t('admin.systemConfig.personas.maxTokensRange')
      .replace('{min}', String(MIN_MAX_TOKENS))
      .replace('{max}', String(MAX_MAX_TOKENS));
  }, [t]);

  // Arina prompt handlers
  const handleArinaPromptChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setArinaPromptValue(value);
    if (value.length < MIN_PROMPT_LENGTH) {
      setArinaPromptError(getPromptMinLengthMessage());
    } else {
      setArinaPromptError(null);
    }
  }, [setArinaPromptValue, getPromptMinLengthMessage]);

  const handleArinaPromptBlur = useCallback(async () => {
    if (arinaPromptValue === arinaPrompt) return;
    if (arinaPromptValue.length < MIN_PROMPT_LENGTH) {
      toast.error(t('admin.systemConfig.personas.promptTooShort'), {
        description: getPromptMinLengthMessage(),
      });
      setArinaPromptValue(arinaPrompt);
      setArinaPromptError(null);
      return;
    }
    await handleArinaPromptUpdate(arinaPromptValue);
  }, [arinaPromptValue, arinaPrompt, handleArinaPromptUpdate, setArinaPromptValue, t, getPromptMinLengthMessage]);

  // Cassandra prompt handlers
  const handleCassandraPromptChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setCassandraPromptValue(value);
    if (value.length < MIN_PROMPT_LENGTH) {
      setCassandraPromptError(getPromptMinLengthMessage());
    } else {
      setCassandraPromptError(null);
    }
  }, [setCassandraPromptValue, getPromptMinLengthMessage]);

  const handleCassandraPromptBlur = useCallback(async () => {
    if (cassandraPromptValue === cassandraPrompt) return;
    if (cassandraPromptValue.length < MIN_PROMPT_LENGTH) {
      toast.error(t('admin.systemConfig.personas.promptTooShort'), {
        description: getPromptMinLengthMessage(),
      });
      setCassandraPromptValue(cassandraPrompt);
      setCassandraPromptError(null);
      return;
    }
    await handleCassandraPromptUpdate(cassandraPromptValue);
  }, [cassandraPromptValue, cassandraPrompt, handleCassandraPromptUpdate, setCassandraPromptValue, t, getPromptMinLengthMessage]);

  // Arina temperature handlers
  const handleArinaTempChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setArinaTemp(value);
    if (value < MIN_TEMPERATURE || value > MAX_TEMPERATURE) {
      setArinaTempError(getTemperatureRangeMessage());
    } else {
      setArinaTempError(null);
    }
  }, [setArinaTemp, getTemperatureRangeMessage]);

  const handleArinaTempBlur = useCallback(async () => {
    if (arinaTemp === arinaTemperature) return;
    if (arinaTemp < MIN_TEMPERATURE || arinaTemp > MAX_TEMPERATURE) {
      toast.error(t('admin.systemConfig.personas.temperatureInvalid'));
      setArinaTemp(arinaTemperature);
      setArinaTempError(null);
      return;
    }
    await handleArinaTempUpdate(arinaTemp);
  }, [arinaTemp, arinaTemperature, handleArinaTempUpdate, setArinaTemp, t]);

  // Cassandra temperature handlers
  const handleCassandraTempChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setCassandraTemp(value);
    if (value < MIN_TEMPERATURE || value > MAX_TEMPERATURE) {
      setCassandraTempError(getTemperatureRangeMessage());
    } else {
      setCassandraTempError(null);
    }
  }, [setCassandraTemp, getTemperatureRangeMessage]);

  const handleCassandraTempBlur = useCallback(async () => {
    if (cassandraTemp === cassandraTemperature) return;
    if (cassandraTemp < MIN_TEMPERATURE || cassandraTemp > MAX_TEMPERATURE) {
      toast.error(t('admin.systemConfig.personas.temperatureInvalid'));
      setCassandraTemp(cassandraTemperature);
      setCassandraTempError(null);
      return;
    }
    await handleCassandraTempUpdate(cassandraTemp);
  }, [cassandraTemp, cassandraTemperature, handleCassandraTempUpdate, setCassandraTemp, t]);

  // Arina max tokens handlers
  const handleArinaTokensChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value) || DEFAULT_MAX_TOKENS;
    setArinaTokens(value);
    if (value < MIN_MAX_TOKENS || value > MAX_MAX_TOKENS) {
      setArinaTokensError(getMaxTokensRangeMessage());
    } else {
      setArinaTokensError(null);
    }
  }, [setArinaTokens, getMaxTokensRangeMessage]);

  const handleArinaTokensBlur = useCallback(async () => {
    if (arinaTokens === arinaMaxTokens) return;
    if (arinaTokens < MIN_MAX_TOKENS || arinaTokens > MAX_MAX_TOKENS) {
      toast.error(t('admin.systemConfig.personas.maxTokensInvalid'));
      setArinaTokens(arinaMaxTokens);
      setArinaTokensError(null);
      return;
    }
    await handleArinaTokensUpdate(arinaTokens);
  }, [arinaTokens, arinaMaxTokens, handleArinaTokensUpdate, setArinaTokens, t]);

  // Cassandra max tokens handlers
  const handleCassandraTokensChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value) || DEFAULT_MAX_TOKENS;
    setCassandraTokens(value);
    if (value < MIN_MAX_TOKENS || value > MAX_MAX_TOKENS) {
      setCassandraTokensError(getMaxTokensRangeMessage());
    } else {
      setCassandraTokensError(null);
    }
  }, [setCassandraTokens, getMaxTokensRangeMessage]);

  const handleCassandraTokensBlur = useCallback(async () => {
    if (cassandraTokens === cassandraMaxTokens) return;
    if (cassandraTokens < MIN_MAX_TOKENS || cassandraTokens > MAX_MAX_TOKENS) {
      toast.error(t('admin.systemConfig.personas.maxTokensInvalid'));
      setCassandraTokens(cassandraMaxTokens);
      setCassandraTokensError(null);
      return;
    }
    await handleCassandraTokensUpdate(cassandraTokens);
  }, [cassandraTokens, cassandraMaxTokens, handleCassandraTokensUpdate, setCassandraTokens, t]);

  // Arina frequency penalty handlers
  const handleArinaFreqPenaltyChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setArinaFreqPenalty(value);
    if (value < MIN_PENALTY || value > MAX_PENALTY) {
      setArinaFreqPenaltyError(t('admin.systemConfig.personas.penaltyRange'));
    } else {
      setArinaFreqPenaltyError(null);
    }
  }, [setArinaFreqPenalty, t]);

  const handleArinaFreqPenaltyBlur = useCallback(async () => {
    if (arinaFreqPenalty === arinaFrequencyPenalty) return;
    if (arinaFreqPenalty < MIN_PENALTY || arinaFreqPenalty > MAX_PENALTY) {
      toast.error(t('admin.systemConfig.personas.penaltyInvalid'));
      setArinaFreqPenalty(arinaFrequencyPenalty);
      setArinaFreqPenaltyError(null);
      return;
    }
    await handleArinaFreqPenaltyUpdate(arinaFreqPenalty);
  }, [arinaFreqPenalty, arinaFrequencyPenalty, handleArinaFreqPenaltyUpdate, setArinaFreqPenalty, t]);

  // Arina presence penalty handlers
  const handleArinaPresPenaltyChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setArinaPresPenalty(value);
    if (value < MIN_PENALTY || value > MAX_PENALTY) {
      setArinaPresPenaltyError(t('admin.systemConfig.personas.penaltyRange'));
    } else {
      setArinaPresPenaltyError(null);
    }
  }, [setArinaPresPenalty, t]);

  const handleArinaPresPenaltyBlur = useCallback(async () => {
    if (arinaPresPenalty === arinaPresencePenalty) return;
    if (arinaPresPenalty < MIN_PENALTY || arinaPresPenalty > MAX_PENALTY) {
      toast.error(t('admin.systemConfig.personas.penaltyInvalid'));
      setArinaPresPenalty(arinaPresencePenalty);
      setArinaPresPenaltyError(null);
      return;
    }
    await handleArinaPresPenaltyUpdate(arinaPresPenalty);
  }, [arinaPresPenalty, arinaPresencePenalty, handleArinaPresPenaltyUpdate, setArinaPresPenalty, t]);

  // Cassandra frequency penalty handlers
  const handleCassandraFreqPenaltyChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setCassandraFreqPenalty(value);
    if (value < MIN_PENALTY || value > MAX_PENALTY) {
      setCassandraFreqPenaltyError(t('admin.systemConfig.personas.penaltyRange'));
    } else {
      setCassandraFreqPenaltyError(null);
    }
  }, [setCassandraFreqPenalty, t]);

  const handleCassandraFreqPenaltyBlur = useCallback(async () => {
    if (cassandraFreqPenalty === cassandraFrequencyPenalty) return;
    if (cassandraFreqPenalty < MIN_PENALTY || cassandraFreqPenalty > MAX_PENALTY) {
      toast.error(t('admin.systemConfig.personas.penaltyInvalid'));
      setCassandraFreqPenalty(cassandraFrequencyPenalty);
      setCassandraFreqPenaltyError(null);
      return;
    }
    await handleCassandraFreqPenaltyUpdate(cassandraFreqPenalty);
  }, [cassandraFreqPenalty, cassandraFrequencyPenalty, handleCassandraFreqPenaltyUpdate, setCassandraFreqPenalty, t]);

  // Cassandra presence penalty handlers
  const handleCassandraPresPenaltyChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setCassandraPresPenalty(value);
    if (value < MIN_PENALTY || value > MAX_PENALTY) {
      setCassandraPresPenaltyError(t('admin.systemConfig.personas.penaltyRange'));
    } else {
      setCassandraPresPenaltyError(null);
    }
  }, [setCassandraPresPenalty, t]);

  const handleCassandraPresPenaltyBlur = useCallback(async () => {
    if (cassandraPresPenalty === cassandraPresencePenalty) return;
    if (cassandraPresPenalty < MIN_PENALTY || cassandraPresPenalty > MAX_PENALTY) {
      toast.error(t('admin.systemConfig.personas.penaltyInvalid'));
      setCassandraPresPenalty(cassandraPresencePenalty);
      setCassandraPresPenaltyError(null);
      return;
    }
    await handleCassandraPresPenaltyUpdate(cassandraPresPenalty);
  }, [cassandraPresPenalty, cassandraPresencePenalty, handleCassandraPresPenaltyUpdate, setCassandraPresPenalty, t]);

  // Get display labels for selected models
  const arinaModelLabel = PERSONA_MODELS.find(m => m.value === arinaModelValue)?.label || arinaModelValue;
  const cassandraModelLabel = PERSONA_MODELS.find(m => m.value === cassandraModelValue)?.label || cassandraModelValue;

  return (
    <TooltipProvider>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            {t('admin.systemConfig.personas.title')}
          </CardTitle>
          <CardDescription>
            {t('admin.systemConfig.personas.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="arina" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="arina">
                {t('admin.systemConfig.personas.arinaTab')}
              </TabsTrigger>
              <TabsTrigger value="cassandra">
                {t('admin.systemConfig.personas.cassandraTab')}
              </TabsTrigger>
            </TabsList>

            {/* Arina Tab */}
            <TabsContent value="arina" className="space-y-6 mt-4">
              {/* Model Selector */}
              <div className="space-y-2">
                <div className="flex items-center gap-1">
                  <Label htmlFor="arina-model">{t('admin.systemConfig.personas.model')}</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">{t('admin.systemConfig.personas.tooltip.model')}</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              <Select
                value={arinaModelValue}
                onValueChange={handleArinaModelUpdate}
                disabled={loading || saving}
              >
                <SelectTrigger id="arina-model" className="w-full">
                  <SelectValue placeholder={t('admin.systemConfig.personas.selectPlaceholder')}>
                    {arinaModelLabel}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {PERSONA_MODELS.map((model) => (
                    <SelectItem key={model.value} value={model.value}>
                      {model.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {arinaModelSaving && (
                <p className="text-xs text-muted-foreground animate-pulse">
                  {t('admin.systemConfig.savingChanges')}
                </p>
              )}
            </div>

            {/* Current Model Display */}
            <div className="rounded-lg bg-muted/50 p-3 border border-border/50">
              <p className="text-sm font-medium text-muted-foreground mb-1">
                {t('admin.systemConfig.personas.currentModel')}
              </p>
              <code className="text-sm font-mono bg-background px-2 py-1 rounded">
                {arinaModelValue}
              </code>
            </div>

            <Separator />

            {/* Prompt Editor */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <Label htmlFor="arina-prompt">{t('admin.systemConfig.personas.arinaPromptLabel')}</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">{t('admin.systemConfig.personas.tooltip.prompt')}</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <span className="text-xs text-muted-foreground">
                  {t('admin.systemConfig.personas.promptCharCount').replace('{count}', String(arinaPromptValue.length))}
                </span>
              </div>
              <Textarea
                id="arina-prompt"
                value={arinaPromptValue}
                onChange={handleArinaPromptChange}
                onBlur={handleArinaPromptBlur}
                disabled={loading || saving}
                className={cn(
                  "min-h-[200px] font-mono text-sm",
                  arinaPromptError && 'border-destructive'
                )}
                placeholder={t('admin.systemConfig.personas.arinaPromptPlaceholder')}
              />
              {arinaPromptError && (
                <p className="text-xs text-destructive">{arinaPromptError}</p>
              )}
              <p className="text-xs text-muted-foreground">
                {getPromptMinLengthMessage()}. {t('admin.systemConfig.personas.autoSaveHint')}
              </p>
            </div>

            <Separator />

            {/* Advanced Settings */}
            <div className="border-t pt-4">
              <button
                type="button"
                onClick={() => setArinaAdvancedOpen(!arinaAdvancedOpen)}
                className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors w-full"
                aria-expanded={arinaAdvancedOpen}
                aria-label={arinaAdvancedOpen
                  ? t('admin.systemConfig.hideAdvancedSettings')
                  : t('admin.systemConfig.showAdvancedSettings')
                }
                aria-controls="arina-advanced-settings"
              >
                {arinaAdvancedOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
                {t('admin.systemConfig.personas.advancedSettings')}
              </button>

              {arinaAdvancedOpen && (
                <div id="arina-advanced-settings" className="mt-4 space-y-4">
                  {/* Temperature Slider */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-1">
                      <Label htmlFor="arina-temperature">
                        {t('admin.systemConfig.personas.temperature')}
                        <span className="ml-2 text-xs text-muted-foreground font-normal">
                          ({MIN_TEMPERATURE}.0 - {MAX_TEMPERATURE}.0, {t('admin.systemConfig.personas.default')}: {DEFAULT_TEMPERATURE})
                        </span>
                      </Label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">{t('admin.systemConfig.personas.tooltip.temperature')}</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <div className="flex items-center gap-4">
                      <input
                        id="arina-temperature"
                        type="range"
                        min={MIN_TEMPERATURE}
                        max={MAX_TEMPERATURE}
                        step="0.1"
                        value={arinaTemp}
                        onChange={handleArinaTempChange}
                        onBlur={handleArinaTempBlur}
                        disabled={loading || saving}
                        className={cn(
                          "flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer",
                          (loading || saving) && "cursor-not-allowed opacity-50"
                        )}
                      />
                      <span className="text-sm font-mono bg-muted px-2 py-1 rounded min-w-[3rem] text-center">
                        {arinaTemp.toFixed(1)}
                      </span>
                    </div>
                    {arinaTempError && (
                      <p className="text-xs text-destructive">{arinaTempError}</p>
                    )}
                  </div>

                  {/* Max Tokens Input */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-1">
                      <Label htmlFor="arina-max-tokens">
                        {t('admin.systemConfig.personas.maxTokens')}
                        <span className="ml-2 text-xs text-muted-foreground font-normal">
                          ({MIN_MAX_TOKENS} - {MAX_MAX_TOKENS}, {t('admin.systemConfig.personas.default')}: {DEFAULT_MAX_TOKENS})
                        </span>
                      </Label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">{t('admin.systemConfig.personas.tooltip.maxTokens')}</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Input
                      id="arina-max-tokens"
                      type="number"
                      min={MIN_MAX_TOKENS}
                      max={MAX_MAX_TOKENS}
                      value={arinaTokens}
                      onChange={handleArinaTokensChange}
                      onBlur={handleArinaTokensBlur}
                      disabled={loading || saving}
                      className={cn(
                        "max-w-xs",
                        arinaTokensError && "border-destructive"
                      )}
                    />
                    {arinaTokensError && (
                      <p className="text-xs text-destructive">{arinaTokensError}</p>
                    )}
                  </div>

                  {/* Frequency Penalty Slider */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-1">
                      <Label htmlFor="arina-frequency-penalty">
                        {t('admin.systemConfig.personas.frequencyPenalty')}
                        <span className="ml-2 text-xs text-muted-foreground font-normal">
                          ({MIN_PENALTY}.0 - {MAX_PENALTY}.0, {t('admin.systemConfig.personas.default')}: {DEFAULT_FREQUENCY_PENALTY})
                        </span>
                      </Label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">{t('admin.systemConfig.personas.tooltip.frequencyPenalty')}</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <div className="flex items-center gap-4">
                      <input
                        id="arina-frequency-penalty"
                        type="range"
                        min={MIN_PENALTY}
                        max={MAX_PENALTY}
                        step="0.1"
                        value={arinaFreqPenalty}
                        onChange={handleArinaFreqPenaltyChange}
                        onBlur={handleArinaFreqPenaltyBlur}
                        disabled={loading || saving}
                        className={cn(
                          "flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer",
                          (loading || saving) && "cursor-not-allowed opacity-50"
                        )}
                      />
                      <span className="text-sm font-mono bg-muted px-2 py-1 rounded min-w-[3rem] text-center">
                        {arinaFreqPenalty.toFixed(1)}
                      </span>
                    </div>
                    {arinaFreqPenaltyError && (
                      <p className="text-xs text-destructive">{arinaFreqPenaltyError}</p>
                    )}
                  </div>

                  {/* Presence Penalty Slider */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-1">
                      <Label htmlFor="arina-presence-penalty">
                        {t('admin.systemConfig.personas.presencePenalty')}
                        <span className="ml-2 text-xs text-muted-foreground font-normal">
                          ({MIN_PENALTY}.0 - {MAX_PENALTY}.0, {t('admin.systemConfig.personas.default')}: {DEFAULT_PRESENCE_PENALTY})
                        </span>
                      </Label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">{t('admin.systemConfig.personas.tooltip.presencePenalty')}</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <div className="flex items-center gap-4">
                      <input
                        id="arina-presence-penalty"
                        type="range"
                        min={MIN_PENALTY}
                        max={MAX_PENALTY}
                        step="0.1"
                        value={arinaPresPenalty}
                        onChange={handleArinaPresPenaltyChange}
                        onBlur={handleArinaPresPenaltyBlur}
                        disabled={loading || saving}
                        className={cn(
                          "flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer",
                          (loading || saving) && "cursor-not-allowed opacity-50"
                        )}
                      />
                      <span className="text-sm font-mono bg-muted px-2 py-1 rounded min-w-[3rem] text-center">
                        {arinaPresPenalty.toFixed(1)}
                      </span>
                    </div>
                    {arinaPresPenaltyError && (
                      <p className="text-xs text-destructive">{arinaPresPenaltyError}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Cassandra Tab */}
          <TabsContent value="cassandra" className="space-y-6 mt-4">
            {/* Model Selector */}
            <div className="space-y-2">
              <div className="flex items-center gap-1">
                <Label htmlFor="cassandra-model">{t('admin.systemConfig.personas.model')}</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">{t('admin.systemConfig.personas.tooltip.model')}</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <Select
                value={cassandraModelValue}
                onValueChange={handleCassandraModelUpdate}
                disabled={loading || saving}
              >
                <SelectTrigger id="cassandra-model" className="w-full">
                  <SelectValue placeholder={t('admin.systemConfig.personas.selectPlaceholder')}>
                    {cassandraModelLabel}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {PERSONA_MODELS.map((model) => (
                    <SelectItem key={model.value} value={model.value}>
                      {model.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {cassandraModelSaving && (
                <p className="text-xs text-muted-foreground animate-pulse">
                  {t('admin.systemConfig.savingChanges')}
                </p>
              )}
            </div>

            {/* Current Model Display */}
            <div className="rounded-lg bg-muted/50 p-3 border border-border/50">
              <p className="text-sm font-medium text-muted-foreground mb-1">
                {t('admin.systemConfig.personas.currentModel')}
              </p>
              <code className="text-sm font-mono bg-background px-2 py-1 rounded">
                {cassandraModelValue}
              </code>
            </div>

            <Separator />

            {/* Prompt Editor */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <Label htmlFor="cassandra-prompt">{t('admin.systemConfig.personas.cassandraPromptLabel')}</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">{t('admin.systemConfig.personas.tooltip.prompt')}</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <span className="text-xs text-muted-foreground">
                  {t('admin.systemConfig.personas.promptCharCount').replace('{count}', String(cassandraPromptValue.length))}
                </span>
              </div>
              <Textarea
                id="cassandra-prompt"
                value={cassandraPromptValue}
                onChange={handleCassandraPromptChange}
                onBlur={handleCassandraPromptBlur}
                disabled={loading || saving}
                className={cn(
                  "min-h-[200px] font-mono text-sm",
                  cassandraPromptError && 'border-destructive'
                )}
                placeholder={t('admin.systemConfig.personas.cassandraPromptPlaceholder')}
              />
              {cassandraPromptError && (
                <p className="text-xs text-destructive">{cassandraPromptError}</p>
              )}
              <p className="text-xs text-muted-foreground">
                {getPromptMinLengthMessage()}. {t('admin.systemConfig.personas.autoSaveHint')}
              </p>
            </div>

            <Separator />

            {/* Advanced Settings */}
            <div className="border-t pt-4">
              <button
                type="button"
                onClick={() => setCassandraAdvancedOpen(!cassandraAdvancedOpen)}
                className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors w-full"
                aria-expanded={cassandraAdvancedOpen}
                aria-label={cassandraAdvancedOpen
                  ? t('admin.systemConfig.hideAdvancedSettings')
                  : t('admin.systemConfig.showAdvancedSettings')
                }
                aria-controls="cassandra-advanced-settings"
              >
                {cassandraAdvancedOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
                {t('admin.systemConfig.personas.advancedSettings')}
              </button>

              {cassandraAdvancedOpen && (
                <div id="cassandra-advanced-settings" className="mt-4 space-y-4">
                  {/* Temperature Slider */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-1">
                      <Label htmlFor="cassandra-temperature">
                        {t('admin.systemConfig.personas.temperature')}
                        <span className="ml-2 text-xs text-muted-foreground font-normal">
                          ({MIN_TEMPERATURE}.0 - {MAX_TEMPERATURE}.0, {t('admin.systemConfig.personas.default')}: {DEFAULT_TEMPERATURE})
                        </span>
                      </Label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">{t('admin.systemConfig.personas.tooltip.temperature')}</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <div className="flex items-center gap-4">
                      <input
                        id="cassandra-temperature"
                        type="range"
                        min={MIN_TEMPERATURE}
                        max={MAX_TEMPERATURE}
                        step="0.1"
                        value={cassandraTemp}
                        onChange={handleCassandraTempChange}
                        onBlur={handleCassandraTempBlur}
                        disabled={loading || saving}
                        className={cn(
                          "flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer",
                          (loading || saving) && "cursor-not-allowed opacity-50"
                        )}
                      />
                      <span className="text-sm font-mono bg-muted px-2 py-1 rounded min-w-[3rem] text-center">
                        {cassandraTemp.toFixed(1)}
                      </span>
                    </div>
                    {cassandraTempError && (
                      <p className="text-xs text-destructive">{cassandraTempError}</p>
                    )}
                  </div>

                  {/* Max Tokens Input */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-1">
                      <Label htmlFor="cassandra-max-tokens">
                        {t('admin.systemConfig.personas.maxTokens')}
                        <span className="ml-2 text-xs text-muted-foreground font-normal">
                          ({MIN_MAX_TOKENS} - {MAX_MAX_TOKENS}, {t('admin.systemConfig.personas.default')}: {DEFAULT_MAX_TOKENS})
                        </span>
                      </Label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">{t('admin.systemConfig.personas.tooltip.maxTokens')}</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Input
                      id="cassandra-max-tokens"
                      type="number"
                      min={MIN_MAX_TOKENS}
                      max={MAX_MAX_TOKENS}
                      value={cassandraTokens}
                      onChange={handleCassandraTokensChange}
                      onBlur={handleCassandraTokensBlur}
                      disabled={loading || saving}
                      className={cn(
                        "max-w-xs",
                        cassandraTokensError && "border-destructive"
                      )}
                    />
                    {cassandraTokensError && (
                      <p className="text-xs text-destructive">{cassandraTokensError}</p>
                    )}
                  </div>

                  {/* Frequency Penalty Slider */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-1">
                      <Label htmlFor="cassandra-frequency-penalty">
                        {t('admin.systemConfig.personas.frequencyPenalty')}
                        <span className="ml-2 text-xs text-muted-foreground font-normal">
                          ({MIN_PENALTY}.0 - {MAX_PENALTY}.0, {t('admin.systemConfig.personas.default')}: {DEFAULT_FREQUENCY_PENALTY})
                        </span>
                      </Label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">{t('admin.systemConfig.personas.tooltip.frequencyPenalty')}</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <div className="flex items-center gap-4">
                      <input
                        id="cassandra-frequency-penalty"
                        type="range"
                        min={MIN_PENALTY}
                        max={MAX_PENALTY}
                        step="0.1"
                        value={cassandraFreqPenalty}
                        onChange={handleCassandraFreqPenaltyChange}
                        onBlur={handleCassandraFreqPenaltyBlur}
                        disabled={loading || saving}
                        className={cn(
                          "flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer",
                          (loading || saving) && "cursor-not-allowed opacity-50"
                        )}
                      />
                      <span className="text-sm font-mono bg-muted px-2 py-1 rounded min-w-[3rem] text-center">
                        {cassandraFreqPenalty.toFixed(1)}
                      </span>
                    </div>
                    {cassandraFreqPenaltyError && (
                      <p className="text-xs text-destructive">{cassandraFreqPenaltyError}</p>
                    )}
                  </div>

                  {/* Presence Penalty Slider */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-1">
                      <Label htmlFor="cassandra-presence-penalty">
                        {t('admin.systemConfig.personas.presencePenalty')}
                        <span className="ml-2 text-xs text-muted-foreground font-normal">
                          ({MIN_PENALTY}.0 - {MAX_PENALTY}.0, {t('admin.systemConfig.personas.default')}: {DEFAULT_PRESENCE_PENALTY})
                        </span>
                      </Label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">{t('admin.systemConfig.personas.tooltip.presencePenalty')}</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <div className="flex items-center gap-4">
                      <input
                        id="cassandra-presence-penalty"
                        type="range"
                        min={MIN_PENALTY}
                        max={MAX_PENALTY}
                        step="0.1"
                        value={cassandraPresPenalty}
                        onChange={handleCassandraPresPenaltyChange}
                        onBlur={handleCassandraPresPenaltyBlur}
                        disabled={loading || saving}
                        className={cn(
                          "flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer",
                          (loading || saving) && "cursor-not-allowed opacity-50"
                        )}
                      />
                      <span className="text-sm font-mono bg-muted px-2 py-1 rounded min-w-[3rem] text-center">
                        {cassandraPresPenalty.toFixed(1)}
                      </span>
                    </div>
                    {cassandraPresPenaltyError && (
                      <p className="text-xs text-destructive">{cassandraPresPenaltyError}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
    </TooltipProvider>
  );
});

PersonasSettings.displayName = 'PersonasSettings';
