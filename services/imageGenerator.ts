import type { AnalysisSection } from '../components/ResultDisplay';

type Theme = 'light' | 'dark';

interface ShareableImageTranslations {
  title: string;
  footer: string;
}

// Helper to escape characters for SVG text
const escapeSVG = (text: string): string => {
  return text.replace(/&/g, '&amp;')
             .replace(/</g, '&lt;')
             .replace(/>/g, '&gt;')
             .replace(/"/g, '&quot;')
             .replace(/'/g, '&apos;');
};

// Simple text wrapper for SVG.
// This is an approximation and might not be perfect for all fonts.
function wrapText(text: string, maxWidth: number, charWidth: number): string[] {
    const lines: string[] = [];
    const words = text.replace(/[\*\-]/g, '').trim().split(/\s+/);
    let currentLine = '';

    words.forEach(word => {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        if (testLine.length * charWidth > maxWidth) {
            lines.push(currentLine);
            currentLine = word;
        } else {
            currentLine = testLine;
        }
    });

    if (currentLine) {
        lines.push(currentLine);
    }
    return lines;
}


function generateSVGString(section: AnalysisSection, theme: Theme, translations: ShareableImageTranslations): string {
    const themeConfig = {
        light: {
            bg: '#F5F5F4', // stone-100
            text: '#292524', // stone-800
            accent: '#A8A29E', // stone-400
            title: '#1C1917', // stone-900
        },
        dark: {
            bg: '#1C1917', // stone-900
            text: '#D6D3D1', // stone-300
            accent: '#78716C', // stone-500
            title: '#F5F5F4', // stone-100
        }
    };
    const colors = themeConfig[theme];

    const lines = wrapText(section.content, 680, 11);

    const tSpans = lines.map((line, index) => 
        `<tspan x="60" dy="${index === 0 ? 0 : '1.4em'}">${escapeSVG(line)}</tspan>`
    ).join('');

    return `
    <svg width="800" height="450" viewBox="0 0 800 450" xmlns="http://www.w3.org/2000/svg">
       <style>
            .title { font-family: 'Playfair Display', serif; font-size: 32px; font-weight: 700; }
            .subtitle { font-family: 'Inter', sans-serif; font-size: 20px; font-weight: 600; }
            .body { font-family: 'Inter', sans-serif; font-size: 18px; }
       </style>
        <rect width="100%" height="100%" fill="${colors.bg}" />
        
        <!-- Header -->
        <g transform="translate(60, 60)">
             <g transform="scale(0.6)">
                <g stroke="${colors.accent}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none">
                    <path d="M 20 45 C 20 65, 80 65, 80 45" />
                    <path d="M 80 50 C 90 55, 90 70, 80 75" />
                    <path d="M 15 82 C 15 88, 85 88, 85 82" />
                </g>
                <g fill="${colors.accent}">
                    <path d="M 50 50 A 15 15 0 1 1 50 49.9 A 12 12 0 1 0 50 50 Z" opacity="0.8" />
                    <path d="M 35 60 L 36 62 L 38 62.5 L 36 63.5 L 35 65.5 L 34 63.5 L 32 62.5 L 34 62 Z" opacity="0.6" />
                    <path d="M 65 65 L 66 67 L 68 67.5 L 66 68.5 L 65 70.5 L 64 68.5 L 62 67.5 L 64 67 Z" opacity="0.7" />
                </g>
            </g>
            <text x="70" y="45" class="title" fill="${colors.title}">${escapeSVG(translations.title)}</text>
        </g>

        <!-- Content -->
        <line x1="60" y1="120" x2="740" y2="120" stroke="${colors.accent}" stroke-width="1"/>
        <text x="60" y="160" class="subtitle" fill="${colors.title}">${escapeSVG(section.title)}</text>
        <text y="200" class="body" fill="${colors.text}">
            ${tSpans}
        </text>

        <!-- Footer -->
        <text x="400" y="420" text-anchor="middle" class="body" font-size="14" fill="${colors.accent}" opacity="0.8">
            ${escapeSVG(translations.footer)}
        </text>
    </svg>
    `;
}

export function generateShareableImage(section: AnalysisSection, theme: Theme, translations: ShareableImageTranslations): Promise<Blob | null> {
    return new Promise((resolve, reject) => {
        const svgString = generateSVGString(section, theme, translations);
        const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);

        const image = new Image();
        image.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = image.width;
            canvas.height = image.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                URL.revokeObjectURL(url);
                return reject(new Error('Could not get canvas context'));
            }
            ctx.drawImage(image, 0, 0);
            canvas.toBlob((blob) => {
                resolve(blob);
                URL.revokeObjectURL(url);
            }, 'image/png');
        };
        image.onerror = () => {
            reject(new Error('Failed to load SVG image.'));
            URL.revokeObjectURL(url);
        };
        image.src = url;
    });
}