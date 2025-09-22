import React from 'react';

export const LogoIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 100 100"
    aria-hidden="true"
    {...props}
  >
    <g stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none">
        {/* Cup */}
        <path d="M 20 45 C 20 65, 80 65, 80 45" />

        {/* Handle */}
        <path d="M 80 50 C 90 55, 90 70, 80 75" />

        {/* Saucer */}
        <path d="M 15 82 C 15 88, 85 88, 85 82" />
    </g>

    {/* Mystical elements inside the cup, representing the grounds */}
    <g fill="currentColor">
        {/* Crescent Moon */}
        <path d="M 50 50 A 15 15 0 1 1 50 49.9 A 12 12 0 1 0 50 50 Z" opacity="0.8" />

        {/* Star */}
        <path d="M 35 60 L 36 62 L 38 62.5 L 36 63.5 L 35 65.5 L 34 63.5 L 32 62.5 L 34 62 Z" opacity="0.6" />
        <path d="M 65 65 L 66 67 L 68 67.5 L 66 68.5 L 65 70.5 L 64 68.5 L 62 67.5 L 64 67 Z" opacity="0.7" />
    </g>
  </svg>
);