import React from 'react';
import Logo from './Logo';
import ThemeToggle from './ThemeToggle';

interface HeaderProps {
    onToggleTheme: () => void;
    currentTheme: 'light' | 'dark';
}

const Header: React.FC<HeaderProps> = ({ onToggleTheme, currentTheme }) => {
  return (
    <header className="w-full max-w-2xl mx-auto text-center mb-8 sm:mb-12 relative">
      <div className="flex items-center justify-center space-x-3">
        <Logo className="w-12 h-12 sm:w-14 sm:h-14" />
        <h1 className="text-4xl sm:text-5xl font-display font-bold text-stone-800 dark:text-stone-100 tracking-tight">
          Кофейный Психолог
        </h1>
      </div>
      <p className="mt-3 text-md text-stone-600 dark:text-stone-400">
        Ваш личный гид по самопознанию через узоры на кофейной гуще
      </p>
      <div className="absolute top-0 right-0">
        <ThemeToggle onToggle={onToggleTheme} theme={currentTheme} />
      </div>
    </header>
  );
};

export default Header;