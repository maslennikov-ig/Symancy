import React, { useState, useCallback, useEffect } from 'react';
import { analyzeCoffeeCup } from './services/geminiService';
import Header from './components/Header';
import ImageUploader from './components/ImageUploader';
import ResultDisplay from './components/ResultDisplay';
import { LoaderIcon } from './components/LoaderIcon';
import { BackgroundPattern } from './components/BackgroundPattern';
import { OfficialLogo } from './components/logos/OfficialLogo';

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { ToggleGroup, ToggleGroupItem } from './components/ui/toggle-group';
import { CoffeeIcon } from './components/CoffeeIcon';
import { translations, Lang, detectInitialLanguage, t as i18n_t } from './lib/i18n';

type Theme = 'light' | 'dark';
type FocusArea = 'wellbeing' | 'career' | 'relationships';

const App: React.FC = () => {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [focusArea, setFocusArea] = useState<FocusArea>('wellbeing');
  const [language, setLanguage] = useState<Lang>(detectInitialLanguage);

  const t = useCallback((key: keyof typeof translations.en) => {
    return i18n_t(key, language);
  }, [language]);

  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      const storedTheme = window.localStorage.getItem('theme');
      if (storedTheme === 'light' || storedTheme === 'dark') {
        return storedTheme;
      }
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
      }
    }
    return 'light';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('language', language);
    document.documentElement.lang = language;
  }, [language]);

  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (err) => reject(err);
    });
  };

  const handleImageSelect = (file: File) => {
    setImageFile(file);
    const objectUrl = URL.createObjectURL(file);
    setImageUrl(objectUrl);
    setAnalysis(null);
    setError(null);
  };

  const handleAnalyzeClick = useCallback(async () => {
    if (!imageFile) {
      setError(t('error.selectImage'));
      return;
    }

    setIsLoading(true);
    setError(null);
    setAnalysis(null);

    try {
      const base64Image = await fileToBase64(imageFile);
      const dataUrlParts = base64Image.split(',');
      if (dataUrlParts.length !== 2) {
        throw new Error('Invalid base64 string format');
      }
      const mimeType = dataUrlParts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
      const imageData = dataUrlParts[1];

      const result = await analyzeCoffeeCup(imageData, mimeType, focusArea, language);
      setAnalysis(result);
    } catch (err) {
      console.error(err);
      setError(t('error.analyzeFailed'));
    } finally {
      setIsLoading(false);
    }
  }, [imageFile, focusArea, language, t]);

  const handleReset = () => {
    setImageFile(null);
    setImageUrl(null);
    setAnalysis(null);
    setError(null);
    setIsLoading(false);
    setFocusArea('wellbeing');
  };
  
  const isUploaderVisible = !isLoading && !error && !analysis && !imageUrl;

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center text-center p-8 h-96">
          <LoaderIcon className="w-8 h-8 animate-spin text-primary" />
          <p className="mt-4 text-muted-foreground animate-pulse">{t('loader.message')}</p>
        </div>
      );
    }

    if (error) {
       return (
        <div className="text-center text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/50 p-4 rounded-lg border border-red-300 dark:border-red-700">
          <p>{error}</p>
          <Button onClick={handleReset} variant="link" className="mt-2">
            {t('error.tryAgain')}
          </Button>
        </div>
      );
    }

    if (analysis) {
      return <ResultDisplay analysis={analysis} onReset={handleReset} theme={theme} t={t} />;
    }

    if (imageUrl) {
      return (
        <div className="flex flex-col items-center text-center">
            <CardHeader>
                <CardTitle className="text-2xl font-display">{t('imageReady.title')}</CardTitle>
            </CardHeader>
            <CardContent className="w-full flex flex-col items-center">
                 <div className="relative w-full max-w-sm mb-6 rounded-lg overflow-hidden shadow-lg border">
                    <img src={imageUrl} alt="Uploaded coffee cup" className="w-full h-auto object-cover" />
                </div>
                 <div className="mb-6 w-full max-w-sm">
                    <h3 className="text-lg font-medium text-foreground mb-3">{t('imageReady.focus.title')}</h3>
                    <ToggleGroup
                        type="single"
                        defaultValue={focusArea}
                        value={focusArea}
                        onValueChange={(value) => { if(value) setFocusArea(value as FocusArea) }}
                        aria-label="Focus Area"
                    >
                        <ToggleGroupItem value="wellbeing" aria-label="Focus on General well-being">
                            {t('imageReady.focus.wellbeing')}
                        </ToggleGroupItem>
                        <ToggleGroupItem value="career" aria-label="Focus on Career">
                            {t('imageReady.focus.career')}
                        </ToggleGroupItem>
                        <ToggleGroupItem value="relationships" aria-label="Focus on Relationships">
                            {t('imageReady.focus.relationships')}
                        </ToggleGroupItem>
                    </ToggleGroup>
                </div>
            </CardContent>
            <CardFooter className="flex-col sm:flex-row gap-4">
                 <Button onClick={handleAnalyzeClick} disabled={isLoading} size="lg">
                    {isLoading ? (
                        <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <CoffeeIcon className="mr-2 h-4 w-4" />
                    )}
                    {t('button.analyze')}
                </Button>
                <Button onClick={handleReset} variant="outline" size="lg">
                    {t('button.reset')}
                </Button>
            </CardFooter>
        </div>
      );
    }

    return <ImageUploader onImageSelect={handleImageSelect} t={t} />;
  }

  return (
    <div className={`min-h-screen flex flex-col items-center p-4 sm:p-6 lg:p-8 font-sans bg-background text-foreground transition-colors duration-300 relative ${isUploaderVisible ? 'state-uploader' : ''}`}>
      <BackgroundPattern />
      <Header 
        logoComponent={OfficialLogo}
        onToggleTheme={toggleTheme} 
        currentTheme={theme} 
        language={language} 
        setLanguage={setLanguage}
        t={t}
      />
      <main className="w-full max-w-4xl mx-auto flex-grow flex flex-col items-center z-10">
        <Card className="w-full shadow-2xl transition-all duration-500 backdrop-blur-xl bg-card/70">
            {renderContent()}
        </Card>
        <footer className="text-center mt-auto pt-8 text-muted-foreground text-sm z-10">
          <p>{t('footer.copyright').replace('{year}', new Date().getFullYear().toString())}</p>
          <p className="mt-1">{t('footer.disclaimer')}</p>
        </footer>
      </main>
    </div>
  );
};

export default App;
