// FIX: The file was empty, causing an import error. Added the TelegramIcon component.
import React from 'react';

export const TelegramIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    width="24"
    height="24"
    {...props}
  >
    <path fill="#229ED9" d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/>
    <path fill="white" d="m16.485 8.232-2.301 9.059c-.18 .729-.673.923-1.27.632l-2.887-2.235-1.344 1.455c-.154.154-.287.286-.558.286l.166-2.927L14.729 8.79c.33-.29-.075-.435-.481-.144L6.923 13.437 4.032 12.518c-.729-.233-.748-.76.163-1.127L15.658 7.027c.615-.241 1.091.125.827 1.205z"/>
  </svg>
);
