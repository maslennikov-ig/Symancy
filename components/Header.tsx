import React, { useState, useRef, useEffect } from 'react';
import ThemeToggle from './ThemeToggle';
import { Lang } from '../lib/i18n';
import { Button } from './ui/button';
import { ProfileIcon } from './auth/ProfileIcon';
import AuthModal from './auth/AuthModal';
import { useAuth } from '../contexts/AuthContext';
import { LogoutIcon } from './auth/LogoutIcon';

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
    const { user, signOut } = useAuth();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const handleLanguageSelect = (langCode: Lang) => {
        setLanguage(langCode);
        setIsMenuOpen(false);
    };

    const handleSignInClick = () => {
        setIsMenuOpen(false);
        setIsAuthModalOpen(true);
    };

    const handleLogout = async () => {
        await signOut();
        setIsMenuOpen(false);
    };

    const UserAvatar = () => {
        if (!user || !user.email) return <ProfileIcon className="h-6 w-6" />;
        const initial = user.email.charAt(0).toUpperCase();
        return (
            <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-sm">
                {initial}
            </div>
        );
    };

    return (
        <>
            <header className="w-full max-w-4xl mx-auto text-center mb-8 sm:mb-12 z-20">
                <div className="flex items-center justify-between py-2">
                    <div className="flex-1"></div>
                    <div className="flex-1 flex justify-center">
                        <div className="flex items-center space-x-3">
                            <LogoComponent className="w-14 h-14 sm:w-16 sm:h-16 flex-shrink-0" />
                            <h1 className="text-4xl lg:text-5xl font-display font-bold text-stone-800 dark:text-stone-100 tracking-tight sm:whitespace-nowrap">
                                {t('header.title')}
                            </h1>
                        </div>
                    </div>
                    <div className="flex-1 flex justify-end items-center">
                        <div className="relative" ref={menuRef}>
                            <Button onClick={() => setIsMenuOpen(prev => !prev)} variant="ghost" size="icon" aria-label="Open user menu">
                                {user ? <UserAvatar /> : <ProfileIcon className="h-6 w-6" />}
                            </Button>

                            {isMenuOpen && (
                                <div className="absolute top-full right-0 mt-2 w-64 rounded-md shadow-lg bg-popover text-popover-foreground border z-50 animate-accordion-down origin-top p-2">
                                    {user ? (
                                        <>
                                            <div className="p-2 border-b">
                                                <p className="text-sm font-medium text-foreground truncate" title={user.email}>{user.email}</p>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="p-1">
                                            <Button onClick={handleSignInClick} className="w-full justify-center">
                                                {t('menu.signIn')}
                                            </Button>
                                            <div className="border-t border-border my-2"></div>
                                        </div>
                                    )}

                                    {/* Settings */}
                                    <div className="px-2 pt-1 pb-2 space-y-1">
                                        <div>
                                            <h3 className="px-2 text-xs font-semibold text-muted-foreground uppercase">{t('menu.language')}</h3>
                                            <div className="mt-1">
                                                {languages.map((lang) => (
                                                    <button key={lang.code} role="menuitem" className={`w-full text-left px-2 py-1.5 text-sm rounded-sm transition-colors hover:bg-accent focus:outline-none focus:bg-accent ${language === lang.code ? 'font-semibold text-primary' : ''}`} onClick={() => handleLanguageSelect(lang.code)}>
                                                        {lang.name}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="border-t border-border -mx-2 my-1"></div>
                                        <div>
                                            <h3 className="px-2 text-xs font-semibold text-muted-foreground uppercase">{t('menu.theme')}</h3>
                                            <div className="mt-1 flex items-center justify-between px-2 py-1.5 text-sm font-medium">
                                                <span>{currentTheme === 'light' ? t('menu.light') : t('menu.dark')}</span>
                                                <ThemeToggle onToggle={onToggleTheme} theme={currentTheme} />
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {user && (
                                        <>
                                            <div className="border-t border-border -mx-2 my-1"></div>
                                            <button role="menuitem" className="w-full text-left px-4 py-2 text-sm rounded-sm transition-colors hover:bg-accent focus:outline-none focus:bg-accent flex items-center text-red-600 dark:text-red-400 font-medium" onClick={handleLogout}>
                                                <LogoutIcon className="w-4 h-4 mr-2" />
                                                {t('auth.logout')}
                                            </button>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                <p className="mt-2 text-md text-stone-600 dark:text-stone-400">
                    {t('header.subtitle')}
                </p>
            </header>
            
            {isAuthModalOpen && <AuthModal onClose={() => setIsAuthModalOpen(false)} t={t} />}
        </>
    );
};

export default Header;