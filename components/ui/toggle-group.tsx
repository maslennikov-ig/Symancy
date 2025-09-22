import React, { createContext, useContext, forwardRef } from 'react';
import { cn } from '../../lib/utils';
import { Button } from './button';

interface ToggleGroupContextType {
  value: string;
  onValueChange: (value: string) => void;
}

const ToggleGroupContext = createContext<ToggleGroupContextType | null>(null);

const useToggleGroup = () => {
  const context = useContext(ToggleGroupContext);
  if (!context) {
    throw new Error("useToggleGroup must be used within a ToggleGroup");
  }
  return context;
};

interface ToggleGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  type: 'single';
  value: string;
  onValueChange: (value: string) => void;
}

const ToggleGroup = forwardRef<HTMLDivElement, ToggleGroupProps>(
  ({ className, children, type, value, onValueChange, ...props }, ref) => {
    return (
      <div ref={ref} className={cn("inline-flex items-center justify-center gap-1 rounded-md bg-muted p-1", className)} {...props}>
        <ToggleGroupContext.Provider value={{ value, onValueChange }}>
          {children}
        </ToggleGroupContext.Provider>
      </div>
    );
  }
);
ToggleGroup.displayName = "ToggleGroup";


interface ToggleGroupItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}

const ToggleGroupItem = forwardRef<HTMLButtonElement, ToggleGroupItemProps>(
  ({ className, children, value, ...props }, ref) => {
    const { value: selectedValue, onValueChange } = useToggleGroup();
    const isSelected = value === selectedValue;

    return (
      <Button
        ref={ref}
        variant={isSelected ? 'default' : 'ghost'}
        // Fix: The `cn` utility was called with an object for conditional classes, which it doesn't support.
        // Changed to a conditional expression that results in a string or a falsy value.
        className={cn("px-3 py-1.5 h-auto", isSelected && 'bg-background hover:bg-background/80 text-foreground', className)}
        onClick={() => onValueChange(value)}
        {...props}
      >
        {children}
      </Button>
    );
  }
);
ToggleGroupItem.displayName = "ToggleGroupItem";

export { ToggleGroup, ToggleGroupItem };
