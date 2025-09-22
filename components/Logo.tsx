import React from 'react';
import { LogoIcon } from './LogoIcon';

interface LogoProps {
  className?: string;
}

const Logo: React.FC<LogoProps> = ({ className }) => {
  return (
    <LogoIcon
      className={className}
    />
  );
};

export default Logo;