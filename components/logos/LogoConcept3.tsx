import React from 'react';

export const LogoConcept3: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 100 100"
    aria-hidden="true"
    {...props}
  >
    <g fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      {/* Saucer */}
      <path d="M 15 85 Q 50 95, 85 85" />
      
      {/* Cup */}
      <path d="M 20 45 C 20 70, 80 70, 80 45" />
      
      {/* Handle */}
      <path d="M 80 50 C 92 55, 92 70, 80 75" />

      {/* Celestial Steam */}
      <g strokeWidth="2.5">
          {/* Moon */}
          <path d="M 45 30 C 55 25, 60 35, 50 40 C 55 35, 55 30, 45 30" />
          
          {/* Stars */}
          <path d="M 62 20 L 63 22 L 65 22.5 L 63 23 L 62 25 L 61 23 L 59 22.5 L 61 22 Z" fill="currentColor" stroke="none" />
          <path d="M 38 18 L 38.5 19.5 L 40 19.8 L 38.5 20.1 L 38 21.6 L 37.5 20.1 L 36 19.8 L 37.5 19.5 Z" fill="currentColor" stroke="none" opacity="0.7"/>
      </g>
    </g>
    
    {/* Saucer Markings */}
    <g fill="currentColor" opacity="0.8">
        <circle cx="25" cy="86" r="1.5" />
        <circle cx="75" cy="86" r="1.5" />
        <path d="M 48 89 a 2 2 0 1 1 4 0 a 2 2 0 1 1 -4 0" />
    </g>
  </svg>
);
