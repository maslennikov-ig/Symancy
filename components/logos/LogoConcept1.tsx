import React from 'react';

export const LogoConcept1: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 100 100"
    aria-hidden="true"
    {...props}
  >
    <g fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      {/* Saucer */}
      <circle cx="50" cy="50" r="45" opacity="0.5" />
      
      {/* Cup Rim */}
      <circle cx="50" cy="50" r="38" />

      {/* Coffee forming an eye shape */}
      <path
        fill="currentColor"
        stroke="none"
        d="M 25 50 C 35 35, 65 35, 75 50 C 65 65, 35 65, 25 50 Z"
        opacity="0.9"
      />
      
      {/* Pupil/Star */}
      <g fill="currentColor" stroke="none" transform="translate(50 50) scale(0.6)">
         <path d="M 0 -8 L 2 -2 L 8 0 L 2 2 L 0 8 L -2 2 L -8 0 L -2 -2 Z" />
      </g>
    </g>
  </svg>
);
