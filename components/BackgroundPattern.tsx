import React from 'react';

export const BackgroundPattern: React.FC = () => {
    return (
        <div className="absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
            <svg width="100%" height="100%" className="text-stone-300/50 dark:text-stone-700/50">
                <defs>
                    <pattern id="coffee-pattern" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                        {/* Coffee Bean */}
                        <path d="M 10 20 C 15 15, 25 15, 30 20 C 35 25, 35 35, 30 40 C 25 45, 15 45, 10 40 C 5 35, 5 25, 10 20 Z" fill="currentColor" opacity="0.3" />
                        <path d="M 20 18 C 22 25, 22 35, 20 42" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.2" />

                         {/* Star */}
                        <path d="M 60 60 L 61 62 L 63 62.5 L 61 63 L 60 65 L 59 63 L 57 62.5 L 59 62 Z" fill="currentColor" opacity="0.4" />

                        {/* Another bean */}
                        <path d="M 50 10 C 55 5, 65 5, 70 10 C 75 15, 75 25, 70 30 C 65 35, 55 35, 50 30 C 45 25, 45 15, 50 10 Z" fill="currentColor" opacity="0.2" />
                        <path d="M 60 8 C 62 15, 62 25, 60 32" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.15" />
                    </pattern>
                </defs>
                <rect x="0" y="0" width="100%" height="100%" fill="url(#coffee-pattern)" />
            </svg>
        </div>
    );
};
