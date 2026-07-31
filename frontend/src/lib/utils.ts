import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getAvatarUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('http')) return url;

  // Use VITE_API_URL and strip /api to get to the root static folder
  const baseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api').replace(/\/api$/, '');
  return `${baseUrl}${url}`;
}

// Get initials from full name — uses first letter of each word (e.g. "yasir dev" → "YD")
export function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map(w => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}
