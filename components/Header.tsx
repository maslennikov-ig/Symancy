import React, { useState, useRef, useEffect } from 'react';
import ThemeToggle from './ThemeToggle';
import { Lang } from '../lib/i18n';
import { Button } from './ui/button';
import { SettingsIcon } from './SettingsIcon';
import { MenuIcon } from './MenuIcon';

interface HeaderProps {
    logoComponent: React.FC<React.SVGProps<SVGSVGElement>>;
    onToggleTheme: () => void;
    currentTheme: 'light' | 'dark';
    language: Lang;
    setLanguage: (lang: Lang) => void;
    t: (key: string) => string;
}

const languages: { code: Lang, name: string }[] = [
    { code: 'en', name: 'English' },
    { code: 'ru', name: 'Русский' },
    { code: 'zh', name: '中文' },
];

const Header: React.FC<HeaderProps> = ({ logoComponent: LogoComponent, onToggleTheme, currentTheme, language, setLanguage, t }) => {
  const [isDesktopMenuOpen, setIsDesktopMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const desktopMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (desktopMenuRef.current && !desktopMenuRef.current.contains(event.target as Node)) {
        setIsDesktopMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleLanguageSelect = (langCode: Lang) => {
    setLanguage(langCode);
    setIsDesktopMenuOpen(false);
    setIsMobileMenuOpen(false);
  };
  
  const MenuContent = () => (
     <div className="p-2 space-y-2">
        {/* Language Section */}
        <div>
            <h3 className="px-2 text-xs font-semibold text-muted-foreground uppercase">{t('mobileMenu.language')}</h3>
            <div className="mt-1">
                {languages.map((lang) => (
                    <button
                        key={lang.code}
                        role="menuitem"
                        className={`w-full text-left px-2 py-1.5 text-sm rounded-sm transition-colors hover:bg-accent focus:outline-none focus:bg-accent ${language === lang.code ? 'font-semibold text-primary' : ''}`}
                        onClick={() => handleLanguageSelect(lang.code)}
                    >
                        {lang.name}
                    </button>
                ))}
            </div>
        </div>

        <div className="border-t border-border -mx-2"></div>

        {/* Theme Section */}
        <div>
            <h3 className="px-2 text-xs font-semibold text-muted-foreground uppercase">{t('mobileMenu.theme')}</h3>
            <div className="mt-1 flex items-center justify-between px-2 py-1.5 text-sm font-medium">
                <span>
                    {currentTheme === 'light' ? t('mobileMenu.light') : t('mobileMenu.dark')}
                </span>
                <ThemeToggle onToggle={onToggleTheme} theme={currentTheme} />
            </div>
        </div>
    </div>
  );

  return (
    <header className="w-full max-w-4xl mx-auto text-center mb-8 sm:mb-12 z-20">
      <div className="flex items-center justify-between py-2">
        {/* This div is a spacer for desktop to center the title. It's hidden on mobile. */}
        <div className="hidden sm:flex flex-1"></div>

        <div className="flex-1 sm:flex-none flex justify-start sm:justify-center">
             <div className="flex items-center space-x-3">
                <LogoComponent className="w-14 h-14 sm:w-16 sm:h-16 flex-shrink-0" />
                <h1 className="text-4xl lg:text-5xl font-display font-bold text-stone-800 dark:text-stone-100 tracking-tight sm:whitespace-nowrap">
                    {t('header.title')}
                </h1>
            </div>
        </div>

        <div className="flex-1 flex justify-end items-center">
            {/* Desktop Settings Menu (visible sm and up) */}
            <div className="hidden sm:flex relative" ref={desktopMenuRef}>
                <Button onClick={() => setIsDesktopMenuOpen(prev => !prev)} variant="ghost" size="icon" aria-label="Open settings">
                    <SettingsIcon className="h-6 w-6" />
                </Button>

                {isDesktopMenuOpen && (
                    <div className="absolute top-full right-0 mt-2 w-48 rounded-md shadow-lg bg-popover text-popover-foreground border z-50 animate-accordion-down origin-top">
                        <MenuContent />
                    </div>
                )}
            </div>

            {/* Mobile Hamburger Menu (visible below sm) */}
            <div className="sm:hidden">
                <Button onClick={() => setIsMobileMenuOpen(prev => !prev)} variant="ghost" size="icon" aria-label="Open menu">
                    <MenuIcon className="h-6 w-6" />
                </Button>
            </div>
        </div>
      </div>
      
       {/* Mobile Menu Panel (conditionally rendered) */}
       {isMobileMenuOpen && (
        <div className="sm:hidden mt-4 rounded-md shadow-lg bg-popover text-popover-foreground border animate-accordion-down">
          <MenuContent />
        </div>
      )}

      <p className="mt-2 text-md text-stone-600 dark:text-stone-400">
        {t('header.subtitle')}
      </p>
    </header>
  );
};

export default Header;