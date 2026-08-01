import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso + (iso.length === 10 ? "T12:00:00" : ""));
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatTons(n?: number | null) {
  if (n == null) return "—";
  return `${n.toLocaleString("en-US", { maximumFractionDigits: 1 })} tn`;
}

export function daysUntil(iso?: string | null) {
  if (!iso) return null;
  const target = new Date(iso + (iso.length === 10 ? "T12:00:00" : ""));
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}
