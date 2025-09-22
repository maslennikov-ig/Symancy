import React from 'react';

export const OfficialLogo: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 100 100"
    aria-label="Coffee Psychologist Logo"
    {...props}
  >
    <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      {/* Cup body */}
      <path d="M19.3,47.3c0,0,1.3,27.3,30.3,27.3s31.6-27.3,31.6-27.3" />
      {/* Cup top ellipse */}
      <path d="M82.1,47.4c0,5.2-14.3,9.4-32,9.4s-32-4.2-32-9.4c0-5.2,14.3-9.4,32-9.4S82.1,42.2,82.1,47.4z" />
      {/* Handle */}
      <path d="M81.5,53.5c4.7,2.5,7.8,7.3,7.8,12.9c0,8.2-6.7,14.9-14.9,14.9c-2.4,0-4.7-0.6-6.7-1.6" />
      {/* Coffee inside */}
      <path d="M75.1,47.5c0,3.1-11.2,5.6-25,5.6s-25-2.5-25-5.6c0-0.3,0.2-0.6,0.5-0.9c2,1.2,12.7,4.3,24.5,4.3s22.5-3.1,24.5-4.3 C74.9,46.9,75.1,47.2,75.1,47.5z" />
      <path d="M37,45.3c3.9-0.8,9.7-1.3,13.9-1.3c3.2,0,7.9,0.3,12.8,1" />

      {/* Eye */}
      <g>
        <path d="M60,59.2c-5.7,2.9-13.6,2.9-19.3,0c-1-0.5-1.9,0.6-1.3,1.5c2.1,3.4,6.2,5.6,10.9,5.6s8.9-2.2,10.9-5.6 C61.8,59.8,61,58.7,60,59.2z" />
        <circle cx="50.3" cy="62" r="1.3" />
        <circle cx="54.4" cy="62.4" r="0.7" />
        <circle cx="46.2" cy="62.4" r="0.7" />
      </g>
    </g>
  </svg>
);
