import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(date));
}

export function formatRelativeTime(date: Date | string): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const diff = now - then;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + "…";
}

export function getDomainFromUrl(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export function getFaviconUrl(url: string, size = 64): string {
  const domain = getDomainFromUrl(url);
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=${size}`;
}

export function formatUpcomingTime(date: Date | string | null): string {
  if (!date) return "—";
  const diff = new Date(date).getTime() - Date.now();
  if (diff <= 0) return "due now";
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  if (minutes < 60) return `in ${minutes}m`;
  if (hours < 24) return `in ${hours}h`;
  const days = Math.floor(diff / 86400000);
  return `in ${days}d`;
}
