import React, { useState, useCallback, useEffect, lazy, Suspense } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router';
import imageCompression from 'browser-image-compression';
import ChatOnboarding from './components/features/ChatOnboarding';
import { analyzeCoffeeCup, AnalysisResponse, UserData, AnalysisError } from './services/analysisService';
import { saveAnalysis, HistoryItem } from './services/historyService';
import { createPayment } from './services/paymentService';
import { ErrorCodes } from './constants/errorCodes';
import Header from './components/layout/Header';
import ImageUploader from './components/features/analysis/ImageUploader';
import ResultDisplay from './components/features/analysis/ResultDisplay';
import { LoaderIcon } from './components/icons/LoaderIcon';
import { isTelegramWebApp } from './hooks/useTelegramWebApp';

// Heavy components - load on demand
const HistoryDisplay = lazy(() => import('./components/features/history/HistoryDisplay'));
const TariffSelector = lazy(() => import('./components/features/payment/TariffSelector'));
const PaymentWidget = lazy(() => import('./components/features/payment/PaymentWidget'));

// Pages - route-based code splitting
const Pricing = lazy(() => import('./pages/Pricing'));
const Terms = lazy(() => import('./pages/Terms'));
const Contacts = lazy(() => import('./pages/Contacts'));
const TestPayment = lazy(() => import('./pages/TestPayment'));
const PaymentSuccess = lazy(() => import('./pages/PaymentSuccess'));
const PaymentResult = lazy(() => import('./pages/PaymentResult'));
const Chat = lazy(() => import('./pages/Chat'));
const History = lazy(() => import('./pages/History'));
const Link = lazy(() => import('./pages/Link'));
const Profile = lazy(() => import('./pages/Profile'));
const ProfileCredits = lazy(() => import('./pages/Profile/Credits'));
const AdminApp = lazy(() => import('./admin/AdminApp'));

// Telegram Mini App pages
const Home = lazy(() => import('./pages/Home'));
const Onboarding = lazy(() => import('./pages/Onboarding'));
const Analysis = lazy(() => import('./pages/Analysis'));

// Layout components
import { AppLayout } from './components/layout/AppLayout';
import { MysticalBackground } from './components/features/MysticalCoffeeCupIllustration';
import { OfficialLogo } from './components/icons/OfficialLogo';
import { useAuth } from './contexts/AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useCloudStorage } from './hooks/useCloudStorage';

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { ToggleGroup, ToggleGroupItem } from './components/ui/toggle-group';
import { CoffeeIcon } from './components/icons/CoffeeIcon';
import { translations, Lang, detectInitialLanguage, t as i18n_t } from './lib/i18n';
import type { ProductType } from './types/payment';

type Theme = 'light' | 'dark';
type FocusArea = 'wellbeing' | 'career' | 'relationships';
type View = 'uploader' | 'history';

/**
 * Wrapper component that handles Telegram WebApp initialization
 *
 * NEW BEHAVIOR (2025-01):
 * - Telegram users now see Home page at `/` (no redirect to /chat)
 * - Home page includes BottomNav for navigation to Chat, History, Profile
 * - This guard only handles initialization, not routing
 *
 * Fixes applied:
 * - CRITICAL-BUG-1: Added proper loading state to prevent race condition
 * - HIGH-BUG-3: Added try-catch error handling for Telegram API failures
 */
const TelegramRedirectGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const [state, setState] = useState<{
    isChecking: boolean;
    error: Error | null;
  }>({ isChecking: location.pathname === '/', error: null });

  useEffect(() => {
    // Only perform initialization check on home page
    if (location.pathname !== '/') {
      setState({ isChecking: false, error: null });
      return;
    }

    const initializeTelegram = async () => {
      try {
        // Wait for Telegram script to load (max 200ms)
        await new Promise<void>((resolve) => {
          if (window.Telegram?.WebApp) {
            resolve();
            return;
          }

          // Poll for Telegram object with timeout
          const timeout = setTimeout(resolve, 200);
          const interval = setInterval(() => {
            if (window.Telegram?.WebApp) {
              clearTimeout(timeout);
              clearInterval(interval);
              resolve();
            }
          }, 50);
        });

        // Telegram WebApp initialized (or not present for web users)
        // No redirect - let the router handle displaying appropriate content
      } catch (error) {
        console.error('Telegram initialization error:', error);
        setState({
          isChecking: false,
          error: error instanceof Error ? error : new Error('Failed to initialize Telegram WebApp'),
        });
        return;
      }

      setState((prev) => ({ ...prev, isChecking: false }));
    };

    initializeTelegram();
  }, [location.pathname]);

  // Error state - show fallback UI
  if (state.error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center">
          <p className="text-destructive mb-4">Failed to initialize Telegram WebApp</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }

  // Loading state - prevents flash of wrong content
  if (state.isChecking && location.pathname === '/') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <LoaderIcon className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return <>{children}</>;
};

const App: React.FC = () => {
  const { user } = useAuth();
  const { onboardingCompleted, isLoading: cloudStorageLoading } = useCloudStorage();
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
    if (typeof window !== 'undefined') {
      // Priority 1: Use Telegram colorScheme if running in Telegram WebApp
      const telegramColorScheme = window.Telegram?.WebApp?.colorScheme;
      if (telegramColorScheme === 'light' || telegramColorScheme === 'dark') {
        return telegramColorScheme;
      }
      // Priority 2: Use stored theme from localStorage (for web users)
      if (window.localStorage) {
        const storedTheme = window.localStorage.getItem('theme');
        if (storedTheme === 'light' || storedTheme === 'dark') {
          return storedTheme;
        }
      }
      // Priority 3: Use system preference
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
    // Only save to localStorage for non-Telegram users (Telegram manages its own theme)
    if (!window.Telegram?.WebApp?.colorScheme) {
      localStorage.setItem('theme', theme);
    }
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
        setError(t('error.loginRequired'));
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

        // Handle structured errors with error codes
        if (err instanceof AnalysisError) {
            switch (err.code) {
                case ErrorCodes.INSUFFICIENT_CREDITS:
                    setPaymentMessage(t('error.creditRequired'));
                    setShowTariffSelector(true);
                    break;
                case ErrorCodes.AI_SERVICE_UNAVAILABLE:
                    setError(t('error.aiUnavailable'));
                    break;
                case ErrorCodes.RATE_LIMIT_EXCEEDED:
                    setError(t('error.rateLimitExceeded'));
                    break;
                case ErrorCodes.INVALID_IMAGE:
                    setError(t('error.invalidImage'));
                    break;
                case ErrorCodes.UNAUTHORIZED:
                    setError(t('error.unauthorized'));
                    break;
                default:
                    setError(t('error.analyzeFailed'));
            }
        } else if (err instanceof Error && err.message === 'INSUFFICIENT_CREDITS') {
            // Fallback for legacy error format
            setPaymentMessage(t('error.creditRequired'));
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
      setPaymentError(err instanceof Error ? err.message : t('error.paymentCreationFailed'));
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
                        {userData?.intent ? t('imageReady.intent').replace('{intent}', userData.intent) : ''}
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
        <ChatOnboarding
            onAnalysisReady={handleAnalysisReady}
            language={language}
            t={t}
        />
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
          <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><LoaderIcon className="w-8 h-8 animate-spin" /></div>}>
            <HistoryDisplay
              onSelectAnalysis={handleSelectHistoryItem}
              onClose={() => setCurrentView('uploader')}
              t={t}
              language={language}
            />
          </Suspense>
        ) : (
          <Card className="w-full shadow-2xl transition-all duration-500 backdrop-blur-xl bg-card/70 flex flex-col flex-grow">
              {renderContent()}
          </Card>
        )}
        <footer className="text-center mt-auto pt-8 text-muted-foreground text-sm z-10">
          <nav className="mb-3 flex flex-wrap justify-center gap-4">
            <a href="/pricing" className="hover:text-foreground transition-colors">{t('footer.link.pricing')}</a>
            <a href="/offer" className="hover:text-foreground transition-colors">{t('footer.link.terms')}</a>
            <a href="/contacts" className="hover:text-foreground transition-colors">{t('footer.link.contacts')}</a>
          </nav>
          <p>{t('footer.copyright').replace('{year}', new Date().getFullYear().toString())}</p>
          <p className="mt-1">{t('footer.disclaimer')}</p>
        </footer>
      </main>

      {/* T022: TariffSelector Modal */}
      {showTariffSelector && (
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><LoaderIcon className="w-8 h-8 animate-spin" /></div>}>
          <TariffSelector
            onClose={() => {
              setShowTariffSelector(false);
              setPaymentMessage(''); // Clear message on close
            }}
            onSelectTariff={handleSelectTariff}
            isLoading={isPaymentLoading}
            message={paymentMessage}
          />
        </Suspense>
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
              aria-label={t('payment.modal.close')}
            >
              &times;
            </button>
            <h2 className="text-xl font-display font-bold mb-4 text-center">
              {t('payment.modal.title')}
            </h2>
            <Suspense fallback={<div className="flex items-center justify-center p-8"><LoaderIcon className="w-8 h-8 animate-spin" /></div>}>
              <PaymentWidget
                confirmationToken={paymentData.confirmationToken}
                purchaseId={paymentData.purchaseId}
                onComplete={handlePaymentComplete}
                onError={handlePaymentError}
              />
            </Suspense>
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

  /**
   * HomeRoute - Renders different content based on environment
   * - Telegram Mini App users: Show Onboarding if not completed, then Home with BottomNav
   * - Web users: Show the original mainAppContent
   */
  const homeRouteElement = isTelegramWebApp() ? (
    // Show loading while checking CloudStorage
    cloudStorageLoading ? (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <LoaderIcon className="w-8 h-8 animate-spin text-primary" />
      </div>
    ) : // Show Onboarding if not completed
    !onboardingCompleted ? (
      <Onboarding language={language} t={t} />
    ) : (
      // Show Home with BottomNav after onboarding
      <AppLayout language={language} t={t}>
        <Home language={language} t={t} />
      </AppLayout>
    )
  ) : (
    mainAppContent
  );

  /**
   * Wrap Telegram Mini App routes with AppLayout for BottomNav
   */
  const withAppLayout = (element: React.ReactNode, showBottomNav = true) => (
    <AppLayout language={language} t={t} showBottomNav={showBottomNav}>
      {element}
    </AppLayout>
  );

  return (
    <ErrorBoundary language={language}>
      <TelegramRedirectGuard>
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><LoaderIcon className="w-8 h-8 animate-spin" /></div>}>
          <Routes>
          {/* Home route - different content for Telegram vs Web */}
          <Route path="/" element={homeRouteElement} />

          {/* Payment result pages - no BottomNav */}
          <Route path="/payment/success" element={<PaymentSuccess />} />
          <Route path="/payment/result" element={<PaymentResult />} />
          <Route path="/test-payment" element={<TestPayment />} />
          <Route path="/link" element={<Link language={language} t={t} />} />

          {/* Info pages - with BottomNav for Telegram Mini App navigation consistency */}
          <Route
            path="/pricing"
            element={withAppLayout(<Pricing language={language} t={t} />)}
          />
          <Route
            path="/offer"
            element={withAppLayout(<Terms language={language} t={t} />)}
          />
          <Route
            path="/terms"
            element={withAppLayout(<Terms language={language} t={t} />)}
          />
          <Route
            path="/contacts"
            element={withAppLayout(<Contacts language={language} t={t} />)}
          />

          {/* Onboarding route for Telegram Mini App */}
          <Route
            path="/onboarding"
            element={<Onboarding language={language} t={t} />}
          />

          {/* Photo Analysis flow for Telegram Mini App */}
          <Route
            path="/analysis"
            element={<Analysis language={language} t={t} />}
          />

          {/* Telegram Mini App routes - with BottomNav */}
          <Route
            path="/chat"
            element={withAppLayout(<Chat language={language} t={t} />)}
          />
          <Route
            path="/history"
            element={withAppLayout(<History language={language} t={t} />)}
          />
          <Route
            path="/profile"
            element={withAppLayout(<Profile language={language} t={t} />)}
          />
          <Route
            path="/profile/credits"
            element={withAppLayout(<ProfileCredits language={language} t={t} />)}
          />

          {/* Admin routes - no BottomNav */}
          <Route path="/admin/*" element={<AdminApp />} />
          </Routes>
        </Suspense>
      </TelegramRedirectGuard>
    </ErrorBoundary>
  );
};

export default App;