import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateStr: string | null, locale?: string): string {
  if (!dateStr) return '-';
  const loc = locale === 'zh' ? 'zh-CN' : locale || undefined;
  return new Date(dateStr).toLocaleDateString(loc, { year: 'numeric', month: 'short', day: 'numeric' });
}
