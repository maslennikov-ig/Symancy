// A simplified version of shadcn's cn utility for merging Tailwind classes
// without external dependencies like `clsx` or `tailwind-merge`.

// FIX: Updated `cn` to support object and array class definitions to resolve type errors.
type ClassValue = ClassArray | ClassDictionary | string | number | null | boolean | undefined;

interface ClassDictionary {
  [id: string]: any;
}

interface ClassArray extends Array<ClassValue> {}

export function cn(...args: ClassValue[]): string {
    const classes: string[] = [];

    for (const arg of args) {
        if (!arg) continue;

        if (typeof arg === 'string' || typeof arg === 'number') {
            classes.push(String(arg));
        } else if (Array.isArray(arg)) {
            const nested = cn(...arg);
            if (nested) {
                classes.push(nested);
            }
        } else if (typeof arg === 'object') {
            Object.keys(arg).forEach(key => {
                if ((arg as ClassDictionary)[key]) {
                    classes.push(key);
                }
            });
        }
    }

    return classes.join(' ');
}
