import React, { useState, useCallback, useEffect } from 'react';
import { analyzeCoffeeCup } from './services/geminiService';
import Header from './components/Header';
import ImageUploader from './components/ImageUploader';
import ResultDisplay from './components/ResultDisplay';
import { LoaderIcon } from './components/LoaderIcon';
import { BackgroundPattern } from './components/BackgroundPattern';

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { ToggleGroup, ToggleGroupItem } from './components/ui/toggle-group';
import { CoffeeIcon } from './components/CoffeeIcon';

type Theme = 'light' | 'dark';

const App: React.FC = () => {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [focusArea, setFocusArea] = useState<string>('Общее самочувствие');
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
      setError("Пожалуйста, сначала выберите изображение.");
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

      const result = await analyzeCoffeeCup(imageData, mimeType, focusArea);
      setAnalysis(result);
    } catch (err) {
      console.error(err);
      setError("Не удалось проанализировать изображение. Пожалуйста, попробуйте еще раз.");
    } finally {
      setIsLoading(false);
    }
  }, [imageFile, focusArea]);

  const handleReset = () => {
    setImageFile(null);
    setImageUrl(null);
    setAnalysis(null);
    setError(null);
    setIsLoading(false);
    setFocusArea('Общее самочувствие');
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center text-center p-8 h-96">
          <LoaderIcon className="w-8 h-8 animate-spin text-primary" />
          <p className="mt-4 text-muted-foreground animate-pulse">Изучаю узоры на кофейной гуще...</p>
        </div>
      );
    }

    if (error) {
       return (
        <div className="text-center text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/50 p-4 rounded-lg border border-red-300 dark:border-red-700">
          <p>{error}</p>
          <Button onClick={handleReset} variant="link" className="mt-2">
            Попробовать снова
          </Button>
        </div>
      );
    }

    if (analysis) {
      return <ResultDisplay analysis={analysis} onReset={handleReset} theme={theme} />;
    }

    if (imageUrl) {
      return (
        <div className="flex flex-col items-center text-center">
            <CardHeader>
                <CardTitle className="text-2xl font-display">Ваша чашка готова к анализу</CardTitle>
            </CardHeader>
            <CardContent className="w-full flex flex-col items-center">
                 <div className="relative w-full max-w-sm mb-6 rounded-lg overflow-hidden shadow-lg border">
                    <img src={imageUrl} alt="Uploaded coffee cup" className="w-full h-auto object-cover" />
                </div>
                 <div className="mb-6 w-full max-w-sm">
                    <h3 className="text-lg font-medium text-foreground mb-3">На чем сфокусироваться?</h3>
                    <ToggleGroup
                        type="single"
                        defaultValue={focusArea}
                        value={focusArea}
                        onValueChange={(value) => { if(value) setFocusArea(value) }}
                        aria-label="Focus Area"
                    >
                        <ToggleGroupItem value="Общее самочувствие" aria-label="Focus on General well-being">
                            Общее самочувствие
                        </ToggleGroupItem>
                        <ToggleGroupItem value="Карьера" aria-label="Focus on Career">
                            Карьера
                        </ToggleGroupItem>
                        <ToggleGroupItem value="Отношения" aria-label="Focus on Relationships">
                            Отношения
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
                    Анализировать
                </Button>
                <Button onClick={handleReset} variant="outline" size="lg">
                    Сбросить
                </Button>
            </CardFooter>
        </div>
      );
    }

    return <ImageUploader onImageSelect={handleImageSelect} />;
  }

  return (
    <div className="min-h-screen flex flex-col items-center p-4 sm:p-6 lg:p-8 font-sans bg-background text-foreground transition-colors duration-300 relative">
      <BackgroundPattern />
      <Header onToggleTheme={toggleTheme} currentTheme={theme} />
      <main className="w-full max-w-2xl mx-auto flex-grow flex flex-col items-center justify-center z-10">
        <Card className="w-full shadow-2xl transition-all duration-500 backdrop-blur-xl bg-card/70">
            {renderContent()}
        </Card>
        <footer className="text-center mt-8 text-muted-foreground text-sm z-10">
          <p>&copy; {new Date().getFullYear()} Кофейный Психолог. Все права защищены.</p>
           <p className="mt-1">Помните, это лишь инструмент для самопознания.</p>
        </footer>
      </main>
    </div>
  );
};

export default App;