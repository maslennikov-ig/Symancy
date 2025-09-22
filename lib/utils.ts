// A simplified version of shadcn's cn utility for merging Tailwind classes
// without external dependencies like `clsx` or `tailwind-merge`.

export function cn(...args: (string | undefined | null | false)[]) {
    return args.filter(Boolean).join(' ');
}