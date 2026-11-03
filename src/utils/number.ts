export function toPersianDigits(n: number | string | null | undefined): string {
  if (n === null || n === undefined) return "";
  return String(n);
}

export function formatTimeSpan(timeStr?: string): string {
  if (!timeStr) return "00:00";
  // Usually returned as "HH:mm:ss" or "d.HH:mm:ss"
  const parts = timeStr.split(":");
  if (parts.length >= 2) {
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const s = parts[2] ? parseInt(parts[2].split(".")[0], 10) : 0;
    
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    }
    return `${m}:${s.toString().padStart(2, "0")}`;
  }
  return timeStr;
}
