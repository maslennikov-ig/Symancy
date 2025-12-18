import React, { useState, useCallback, useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import imageCompression from 'browser-image-compression';
import ChatOnboarding from './components/ChatOnboarding';
import { analyzeCoffeeCup, AnalysisResponse, UserData } from './services/analysisService';
import { saveAnalysis, HistoryItem } from './services/historyService';
import { createPayment } from './services/paymentService';
import Header from './components/Header';
import ImageUploader from './components/ImageUploader';
import ResultDisplay from './components/ResultDisplay';
import HistoryDisplay from './components/HistoryDisplay';
import TariffSelector from './components/payment/TariffSelector';
import { PaymentWidget } from './components/payment/PaymentWidget';
import PaymentSuccess from './pages/PaymentSuccess';
import PaymentResult from './pages/PaymentResult';
import Pricing from './pages/Pricing';
import Terms from './pages/Terms';
import Contacts from './pages/Contacts';
import { LoaderIcon } from './components/LoaderIcon';
import { MysticalBackground } from './components/MysticalCoffeeCupIllustration';
import { OfficialLogo } from './components/logos/OfficialLogo';
import { useAuth } from './contexts/AuthContext';

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { ToggleGroup, ToggleGroupItem } from './components/ui/toggle-group';
import { CoffeeIcon } from './components/CoffeeIcon';
import { translations, Lang, detectInitialLanguage, t as i18n_t } from './lib/i18n';
import type { ProductType } from './types/payment';

type Theme = 'light' | 'dark';
type FocusArea = 'wellbeing' | 'career' | 'relationships';
type View = 'uploader' | 'history';

const App: React.FC = () => {
  const { user } = useAuth();
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [focusArea, setFocusArea] = useState<FocusArea>('wellbeing');
  const [language, setLanguage] = useState<Lang>(detectInitialLanguage);
  const [currentView, setCurrentView] = useState<View>('uploader');
  const [userData, setUserData] = useState<UserData | null>(null);

  // Payment state
  const [showTariffSelector, setShowTariffSelector] = useState(false);
  const [isPaymentLoading, setIsPaymentLoading] = useState(false);
  const [paymentData, setPaymentData] = useState<{
    confirmationToken: string;
    purchaseId: string;
  } | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentMessage, setPaymentMessage] = useState<string>('');

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

  const performAnalysis = async (file: File, data: UserData) => {
    if (!user) {
        setError('Войдите в аккаунт для анализа');
        return;
    }

    setIsLoading(true);
    setError(null);
    setAnalysis(null);

    try {
        // Compress image
        const options = {
            maxSizeMB: 0.3,
            maxWidthOrHeight: 1024,
            useWebWorker: true,
            fileType: 'image/webp' as const,
            initialQuality: 0.7
        };

        let compressedFile = file;
        try {
            console.log(`Original file size: ${(file.size / 1024 / 1024).toFixed(2)} MB`);
            compressedFile = await imageCompression(file, options);
            console.log(`Compressed file size: ${(compressedFile.size / 1024 / 1024).toFixed(2)} MB`);
        } catch (compressionError) {
            console.error('Image compression failed, using original:', compressionError);
        }

        const base64Image = await fileToBase64(compressedFile);
        const dataUrlParts = base64Image.split(',');
        if (dataUrlParts.length !== 2) {
            throw new Error('Invalid base64 string format');
        }
        const mimeType = dataUrlParts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
        const imageData = dataUrlParts[1];

        const result = await analyzeCoffeeCup(imageData, mimeType, data, 'psychologist', language);
        setAnalysis(result);

        console.log('Analysis complete.');

        if (user) {
            saveAnalysis(user.id, result, data.intent || 'wellbeing');
        }

    } catch (err) {
        console.error(err);
        // Handle insufficient credits error from Edge Function
        if (err instanceof Error && err.message === 'INSUFFICIENT_CREDITS') {
            setPaymentMessage('Для анализа нужен кредит');
            setShowTariffSelector(true);
        } else {
            setError(t('error.analyzeFailed'));
        }
    } finally {
        setIsLoading(false);
    }
  };

  const handleAnalysisReady = useCallback(async (file: File, data: UserData) => {
    setImageFile(file);
    setUserData(data);
    await performAnalysis(file, data);
  }, [user, language, t]);

  const handleReset = () => {
    setImageFile(null);
    setImageUrl(null);
    setAnalysis(null);
    setError(null);
    setIsLoading(false);
    setFocusArea('wellbeing');
    setUserData(null);
    setCurrentView('uploader');
  };

  const handleSelectHistoryItem = (item: HistoryItem) => {
      setAnalysis(item.analysis);
      setFocusArea(item.focus_area as FocusArea);
      setImageUrl(null);
      setError(null);
      setIsLoading(false);
      setCurrentView('uploader');
  };

  const handleOpenTariffSelector = () => {
    setPaymentError(null);
    setPaymentMessage(''); 
    setShowTariffSelector(true);
  };

  const handleSelectTariff = async (productType: ProductType) => {
    setIsPaymentLoading(true);
    setPaymentError(null);
    try {
      const result = await createPayment(productType);
      setPaymentData({
        confirmationToken: result.confirmation_token,
        purchaseId: result.purchase_id,
      });
      setShowTariffSelector(false);
    } catch (err) {
      console.error('Payment creation failed:', err);
      setPaymentError(err instanceof Error ? err.message : 'Ошибка создания платежа');
    } finally {
      setIsPaymentLoading(false);
    }
  };

  const handleClosePaymentWidget = () => {
    setPaymentData(null);
    setPaymentError(null);
  };

  const handlePaymentComplete = () => {
    setPaymentData(null);
  };

  const handlePaymentError = (errorMsg: string) => {
    console.error('Payment widget error:', errorMsg);
    setPaymentData(null);
    setPaymentError(errorMsg);
  };

  const isUploaderVisible = !isLoading && !error && !analysis && !imageUrl && currentView === 'uploader';

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
                    <p className="text-muted-foreground italic">
                        {userData?.intent ? `Ваш запрос: "${userData.intent}"` : ''}
                    </p>
                </div>
            </CardContent>
            <CardFooter className="flex-col sm:flex-row gap-4">
                <Button onClick={handleReset} variant="outline" size="lg">
                    {t('button.reset')}
                </Button>
            </CardFooter>
        </div>
      );
    }

    return (
        <div className="w-full h-full flex flex-col">
            <ChatOnboarding 
                onAnalysisReady={handleAnalysisReady} 
                language={language}
                t={t}
            />
        </div>
    );
  };

  const mainAppContent = (
    <div className={`min-h-screen flex flex-col items-center p-4 sm:p-6 lg:p-8 font-sans bg-background text-foreground transition-colors duration-300 relative ${isUploaderVisible ? 'state-uploader' : ''}`}>
      <MysticalBackground />
      <Header
        logoComponent={OfficialLogo}
        onToggleTheme={toggleTheme}
        currentTheme={theme}
        language={language}
        setLanguage={setLanguage}
        t={t}
        onShowHistory={() => setCurrentView('history')}
        onBuyCredits={handleOpenTariffSelector}
      />
      <main className="w-full max-w-4xl mx-auto flex-grow flex flex-col items-center z-10">
        {currentView === 'history' ? (
          <HistoryDisplay
            onSelectAnalysis={handleSelectHistoryItem}
            onClose={() => setCurrentView('uploader')}
            t={t}
            language={language}
          />
        ) : (
          <Card className="w-full shadow-2xl transition-all duration-500 backdrop-blur-xl bg-card/70 flex flex-col flex-grow">
              {renderContent()}
          </Card>
        )}
        <footer className="text-center mt-auto pt-8 text-muted-foreground text-sm z-10">
          <nav className="mb-3 flex flex-wrap justify-center gap-4">
            <a href="/pricing" className="hover:text-foreground transition-colors">Тарифы</a>
            <a href="/offer" className="hover:text-foreground transition-colors">Оферта</a>
            <a href="/contacts" className="hover:text-foreground transition-colors">Контакты</a>
          </nav>
          <p>{t('footer.copyright').replace('{year}', new Date().getFullYear().toString())}</p>
          <p className="mt-1">{t('footer.disclaimer')}</p>
        </footer>
      </main>

      {/* T022: TariffSelector Modal */}
      {showTariffSelector && (
        <TariffSelector
          onClose={() => {
            setShowTariffSelector(false);
            setPaymentMessage(''); // Clear message on close
          }}
          onSelectTariff={handleSelectTariff}
          isLoading={isPaymentLoading}
          message={paymentMessage}
        />
      )}

      {/* T023: PaymentWidget Modal */}
      {paymentData && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={handleClosePaymentWidget}
        >
          <div
            className="bg-popover rounded-lg shadow-2xl p-6 w-full max-w-lg relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={handleClosePaymentWidget}
              className="absolute top-2 right-2 text-muted-foreground hover:text-foreground p-2 rounded-full text-2xl leading-none"
              aria-label="Закрыть"
            >
              &times;
            </button>
            <h2 className="text-xl font-display font-bold mb-4 text-center">
              Оплата
            </h2>
            <PaymentWidget
              confirmationToken={paymentData.confirmationToken}
              purchaseId={paymentData.purchaseId}
              onComplete={handlePaymentComplete}
              onError={handlePaymentError}
            />
          </div>
        </div>
      )}

      {/* Payment error toast */}
      {paymentError && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-destructive text-destructive-foreground px-4 py-3 rounded-lg shadow-lg flex items-center gap-3">
          <span>{paymentError}</span>
          <button
            onClick={() => setPaymentError(null)}
            className="text-destructive-foreground/80 hover:text-destructive-foreground"
          >
            &times;
          </button>
        </div>
      )}
    </div>
  );

  return (
    <Routes>
      <Route path="/" element={mainAppContent} />
      <Route path="/pricing" element={<Pricing />} />
      <Route path="/payment/success" element={<PaymentSuccess />} />
      <Route path="/payment/result" element={<PaymentResult />} />
      <Route path="/offer" element={<Terms />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/contacts" element={<Contacts />} />
    </Routes>
  );
};

export default App;