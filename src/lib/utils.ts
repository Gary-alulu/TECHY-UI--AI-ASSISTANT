import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Auto-scales a transfer rate (MB/s) to B/s, KB/s or MB/s. */
export function formatTransferRate(megabytesPerSecond: number): string {
  if (!Number.isFinite(megabytesPerSecond) || megabytesPerSecond <= 0) {
    return "0 B/s";
  }
  if (megabytesPerSecond >= 1) {
    return `${megabytesPerSecond.toFixed(2)} MB/s`;
  }
  const kilobytesPerSecond = megabytesPerSecond * 1024;
  if (kilobytesPerSecond >= 1) {
    return `${kilobytesPerSecond.toFixed(0)} KB/s`;
  }
  return `${Math.round(kilobytesPerSecond * 1024)} B/s`;
}

/** Formats a cumulative byte count to MB or GB for display. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 MB";
  const gigabytes = bytes / (1024 * 1024 * 1024);
  if (gigabytes >= 1) return `${gigabytes.toFixed(2)} GB`;
  const megabytes = bytes / (1024 * 1024);
  if (megabytes >= 1) return `${megabytes.toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}
