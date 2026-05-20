import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { translations } from '../../../lib/i18n';

/**
 * One section of the comparison result, as returned by the
 * `compare-coffee` Edge Function.
 */
export interface ComparisonSection {
  title: string;
  content: string;
}

/**
 * Shape of the `result` field returned by the `compare-coffee`
 * Edge Function (see `supabase/functions/compare-coffee/index.ts`).
 */
export interface ComparisonResultData {
  intro: string;
  sections: ComparisonSection[];
}

export type CompareMode = 'dynamics' | 'compatibility';

interface ComparisonResultProps {
  /** Result payload from the Edge Function. */
  result: ComparisonResultData;
  /** Mode used for the comparison (affects the heading copy). */
  mode: CompareMode;
  /** Translation function. */
  t: (key: keyof typeof translations.en) => string;
  /** Callback to reset the form (e.g. compare another pair). */
  onReset?: () => void;
}

/**
 * Convert lightweight HTML coming from the LLM (e.g. `<b>`, `<i>`, `<br>`)
 * to a Markdown string that `react-markdown` can safely render.
 *
 * This mirrors the helper in `ResultDisplay.tsx` — `react-markdown` by
 * default escapes raw HTML, so we down-convert to Markdown to keep the
 * formatting while avoiding `dangerouslySetInnerHTML`.
 */
function parseHtmlToMarkdown(text: string): string {
  if (!text) return '';
  return text
    .replace(/<b>([\s\S]*?)<\/b>/gi, '**$1**')
    .replace(/<strong>([\s\S]*?)<\/strong>/gi, '**$1**')
    .replace(/<i>([\s\S]*?)<\/i>/gi, '*$1*')
    .replace(/<em>([\s\S]*?)<\/em>/gi, '*$1*')
    .replace(/<br\s*\/?>/gi, '\n')
    // Defensive: also handle entity-escaped HTML.
    .replace(/&lt;b&gt;([\s\S]*?)&lt;\/b&gt;/gi, '**$1**')
    .replace(/&lt;strong&gt;([\s\S]*?)&lt;\/strong&gt;/gi, '**$1**')
    .replace(/&lt;i&gt;([\s\S]*?)&lt;\/i&gt;/gi, '*$1*')
    .replace(/&lt;em&gt;([\s\S]*?)&lt;\/em&gt;/gi, '*$1*')
    .replace(/&lt;br\s*\/?&gt;/gi, '\n');
}

/**
 * ComparisonResult — renders the structured response of the
 * `compare-coffee` Edge Function (intro + N labeled sections).
 *
 * Visual layout:
 * - Large italic intro block at the top, centered.
 * - One {@link Card} per section, stacked vertically.
 *
 * Safety: we never use `dangerouslySetInnerHTML`. The LLM's lightweight
 * HTML is converted to Markdown first, then rendered through
 * `react-markdown`, which escapes anything else by default.
 */
export const ComparisonResult: React.FC<ComparisonResultProps> = ({
  result,
  mode,
  t,
  onReset,
}) => {
  const intro = parseHtmlToMarkdown(result.intro ?? '');

  return (
    <section
      className="w-full flex flex-col gap-6"
      aria-label={t('compare.result.title')}
    >
      <header className="text-center">
        <h2 className="text-2xl sm:text-3xl font-display font-bold text-foreground">
          {t('compare.result.title')}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === 'dynamics'
            ? t('compare.dynamics.title')
            : t('compare.compatibility.title')}
        </p>
      </header>

      {intro ? (
        <div className="px-4 sm:px-8 text-center">
          <div className="prose prose-sm sm:prose dark:prose-invert prose-stone max-w-none italic text-foreground">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{intro}</ReactMarkdown>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-4">
        {result.sections.map((section, index) => (
          <Card key={index} className="bg-card/80 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-display">
                {section.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm sm:prose dark:prose-invert prose-stone max-w-none text-foreground leading-relaxed">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {parseHtmlToMarkdown(section.content)}
                </ReactMarkdown>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {onReset ? (
        <div className="flex justify-center pt-2">
          <Button onClick={onReset} variant="default" size="lg">
            {t('compare.result.reset')}
          </Button>
        </div>
      ) : null}
    </section>
  );
};

export default ComparisonResult;
