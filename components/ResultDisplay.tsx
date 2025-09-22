import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { generateShareableImage } from '../services/imageGenerator';
import { ShareIcon } from './ShareIcon';
import { LoaderIcon } from './LoaderIcon';
import { ScrollArea } from './ui/scroll-area';
import { Button } from './ui/button';

interface ResultDisplayProps {
  analysis: string;
  onReset: () => void;
  theme: 'light' | 'dark';
}

interface AnalysisSection {
  title: string;
  content: string;
}

const ResultDisplay: React.FC<ResultDisplayProps> = ({ analysis, onReset, theme }) => {
  const [sections, setSections] = useState<AnalysisSection[]>([]);
  const [intro, setIntro] = useState<string>('');
  const [isSharing, setIsSharing] = useState<boolean>(false);

  useEffect(() => {
    // This regex splits the text by lines that look like markdown headers (## Title), capturing the title.
    const parts = analysis.split(/^\s*##?\s*(.*)\s*$/m);
    
    const introText = parts.shift()?.trim() || '';
    setIntro(introText);
    
    const parsedSections: AnalysisSection[] = [];
    for (let i = 0; i < parts.length; i += 2) {
      const title = parts[i]?.trim();
      const content = parts[i + 1]?.trim();
      if (title && content) {
        parsedSections.push({ title, content });
      }
    }
    setSections(parsedSections);
  }, [analysis]);

  const handleShare = async () => {
    setIsSharing(true);
    try {
        const imageBlob = await generateShareableImage(sections, theme);
        if (!imageBlob) {
            throw new Error("Failed to generate image.");
        }

        const file = new File([imageBlob], 'coffee-analysis.png', { type: 'image/png' });
        const shareData = {
            title: 'Мой кофейный анализ',
            text: 'Вот что рассказала моя кофейная чашка:',
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
        alert("Не удалось поделиться изображением. Пожалуйста, попробуйте еще раз.");
    } finally {
        setIsSharing(false);
    }
  };

  return (
    <div className="flex flex-col items-center w-full p-6 sm:p-8">
      <h2 className="text-3xl font-display font-bold text-foreground mb-6 text-center">Ваш Психологический Портрет</h2>
      <ScrollArea className="w-full bg-muted/50 rounded-lg p-6 max-h-[50vh] prose dark:prose-invert prose-stone border">
         <div className="font-sans text-foreground leading-relaxed">
            {intro && (
               <ReactMarkdown remarkPlugins={[remarkGfm]}>{intro}</ReactMarkdown>
            )}
            {sections.map((section, index) => (
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
          disabled={isSharing}
          variant="outline"
        >
          {isSharing ? (
            <LoaderIcon className="w-4 h-4 mr-2 animate-spin" />
          ) : (
             <ShareIcon className="w-4 h-4 mr-2" />
          )}
          <span>Поделиться</span>
        </Button>
        <Button onClick={onReset}>
          Проанализировать еще одну чашку
        </Button>
      </div>
    </div>
  );
};

export default ResultDisplay;