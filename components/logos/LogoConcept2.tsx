import React from 'react';

export const LogoConcept2: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
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

      {/* Rorschach Steam */}
      <path
        d="M 50 40 
           C 40 30, 40 15, 50 10 
           S 60 30, 50 40 
           C 60 30, 60 15, 50 10"
        strokeWidth="2.5"
      />
    </g>
  </svg>
);
