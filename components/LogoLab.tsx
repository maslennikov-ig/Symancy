import React, { useState, useEffect } from 'react';
import { generateLogo } from '../services/geminiService';
import { LoaderIcon } from './LoaderIcon';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

interface LogoLabProps {
  onBack: () => void;
}

const logoPrompts = [
  "Minimalist logo for 'Coffee Psychologist'. A simple line art of a coffee cup with a subtle eye shape in the coffee. Elegant, modern, clean. On a white background, vector style.",
  "Logo design for 'Coffee Psychologist'. A Rorschach inkblot test pattern made of steam rising from a coffee cup. Monochromatic, mysterious, intellectual. Vector style.",
  "A logo featuring a celestial theme for 'Coffee Psychologist'. A crescent moon dipping into a coffee cup like a biscuit, with small stars as steam. Whimsical, insightful, dark blue and gold colors.",
  "Geometric logo for 'Coffee Psychologist'. A stylized coffee bean split in two, with one half forming a question mark. Abstract, clever, professional. Earthy tones, vector.",
  "Art deco logo for 'Coffee Psychologist'. A stylized, symmetrical design with a coffee cup at the center, surrounded by sunburst patterns resembling a brain. Gold and black, luxurious, sophisticated.",
  "Hand-drawn, friendly logo for 'Coffee Psychologist'. A circular emblem with a smiling coffee cup. A speech bubble rises from it containing a small, simple star. Approachable, warm, and inviting."
];


const LogoLab: React.FC<LogoLabProps> = ({ onBack }) => {
  const [logos, setLogos] = useState<(string | null)[]>(new Array(6).fill(null));
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAllLogos = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const results = await Promise.all(
          logoPrompts.map(prompt => generateLogo(prompt).catch(err => {
            console.error(`Failed to generate logo for prompt: "${prompt}"`, err);
            return null; // Return null on failure for one image
          }))
        );
        setLogos(results);
        if (results.every(r => r === null)) {
            throw new Error("All logo generation requests failed. Please check the API key and console for details.");
        }
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : 'An unknown error occurred during logo generation.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllLogos();
  }, []);

  const renderGrid = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center text-center p-8 h-96">
          <LoaderIcon className="w-12 h-12 animate-spin text-primary" />
          <p className="mt-4 text-muted-foreground animate-pulse">Generating creative logo concepts... this may take a moment.</p>
        </div>
      );
    }

    if (error) {
       return (
        <div className="text-center text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/50 p-4 rounded-lg border border-red-300 dark:border-red-700">
          <p className="font-semibold">Generation Failed</p>
          <p className="text-sm">{error}</p>
        </div>
      );
    }
    
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {logos.map((logoUrl, index) => (
                <div key={index} className="flex flex-col items-center gap-4 p-4 border rounded-lg bg-background/50">
                    <div className="w-full aspect-square bg-muted rounded-md flex items-center justify-center overflow-hidden">
                        {logoUrl ? (
                            <img src={logoUrl} alt={`Generated Logo ${index + 1}`} className="w-full h-full object-cover" />
                        ) : (
                            <div className="text-center text-destructive p-2">
                                <p className="font-semibold text-sm">Failed to generate</p>
                            </div>
                        )}
                    </div>
                    <p className="text-xs text-muted-foreground text-center px-2">{`"${logoPrompts[index]}"`}</p>
                </div>
            ))}
        </div>
    );
  };
  
  return (
    <Card className="w-full shadow-2xl transition-all duration-500 backdrop-blur-xl bg-card/70">
        <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-2xl font-display">Logo Generation Lab</CardTitle>
            <Button onClick={onBack} variant="outline">Back to App</Button>
        </CardHeader>
        <CardContent>
            {renderGrid()}
        </CardContent>
    </Card>
  );
};

export default LogoLab;
