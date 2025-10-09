import React from 'react';
import { SunIcon } from './SunIcon';
import { MoonIcon } from './MoonIcon';
import { Button } from './ui/button';

interface ThemeToggleProps {
  onToggle: () => void;
  theme: 'light' | 'dark';
}

const ThemeToggle: React.FC<ThemeToggleProps> = ({ onToggle, theme }) => {
  return (
    <Button
      onClick={onToggle}
      variant="ghost"
      size="icon"
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
    >
      <SunIcon className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <MoonIcon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
};

export default ThemeToggle;