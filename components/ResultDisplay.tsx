
import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { generateShareableImage } from '../services/imageGenerator';
import { ShareIcon } from './ShareIcon';
import { LoaderIcon } from './LoaderIcon';
import { ScrollArea } from './ui/scroll-area';
import { Button } from './ui/button';
import { AnalysisResponse } from '../services/geminiService';

interface ResultDisplayProps {
  analysis: AnalysisResponse;
  onReset: () => void;
  theme: 'light' | 'dark';
  t: (key: string) => string;
}

const ResultDisplay: React.FC<ResultDisplayProps> = ({ analysis, onReset, theme, t }) => {
  const [isSharing, setIsSharing] = useState<boolean>(false);

  const handleShare = async () => {
    setIsSharing(true);
    try {
        const mainSection = analysis.sections[0];
        if (!mainSection) {
            throw new Error("No analysis sections found to share.");
        }

        const imageTranslations = {
            title: t('header.title'),
            footer: t('share.image.footer'),
        };

        const imageBlob = await generateShareableImage(mainSection, theme, imageTranslations);
        if (!imageBlob) {
            throw new Error("Failed to generate image.");
        }

        const file = new File([imageBlob], 'coffee-analysis.png', { type: 'image/png' });
        const shareData = {
            title: t('share.title'),
            text: t('share.text'),
            files: [file],
        };

        if (navigator.canShare && navigator.canShare(shareData)) {
            await navigator.share(shareData);
        } else {
            // Fallback for desktop or unsupported browsers
            const link = document.createElement('a');
            link.href = URL.createObjectURL(imageBlob);
            link.download = 'coffee-analysis.png';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    } catch (err) {
        console.error("Sharing failed:", err);
        alert(t('share.error'));
    } finally {
        setIsSharing(false);
    }
  };

  return (
    <div className="flex flex-col items-center w-full p-6 sm:p-8">
      <h2 className="text-3xl font-display font-bold text-foreground mb-6 text-center">{t('result.title')}</h2>
      <ScrollArea className="w-full bg-muted/50 rounded-lg p-6 max-h-[50vh] prose dark:prose-invert prose-stone border">
         <div className="font-sans text-foreground leading-relaxed">
            {analysis.intro && (
               <ReactMarkdown remarkPlugins={[remarkGfm]}>{analysis.intro}</ReactMarkdown>
            )}
            {analysis.sections.map((section, index) => (
              <div key={index} className="mt-6">
                <h3 className="font-display text-xl font-bold text-foreground mb-3">
                  {section.title}
                </h3>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{section.content}</ReactMarkdown>
              </div>
            ))}
         </div>
      </ScrollArea>
      <div 
        className="mt-8 flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4"
      >
        <Button
          onClick={handleShare}
          disabled={isSharing || analysis.sections.length === 0}
          variant="outline"
        >
          {isSharing ? (
            <LoaderIcon className="w-4 h-4 mr-2 animate-spin" />
          ) : (
             <ShareIcon className="w-4 h-4 mr-2" />
          )}
          <span>{t('result.button.share')}</span>
        </Button>
        <Button onClick={onReset}>
          {t('result.button.analyzeAnother')}
        </Button>
      </div>
    </div>
  );
};

export default ResultDisplay;
