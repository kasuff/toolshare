export function toLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function toLocalTimeKey(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function parseLocalDateKey(value: string): Date | null {
  if (!value.trim()) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function parseLocalTimeKey(value: string, baseDate?: string): Date {
  const [hours, minutes] = value.split(':').map(Number);
  const base = baseDate ? parseLocalDateKey(baseDate) : null;
  const date = base ? new Date(base) : new Date();
  date.setHours(Number.isNaN(hours) ? 0 : hours, Number.isNaN(minutes) ? 0 : minutes, 0, 0);
  return date;
}

export function formatDateLabel(value: string, placeholder = 'Datum wählen'): string {
  if (!value.trim()) return placeholder;
  const date = parseLocalDateKey(value);
  if (!date) return value;
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatTimeLabel(value: string, placeholder = 'Uhrzeit wählen'): string {
  if (!value.trim()) return placeholder;
  const date = parseLocalTimeKey(value);
  return date.toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getDefaultDateRange() {
  const start = new Date();
  start.setDate(start.getDate() + 1);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { startDate: toLocalDateKey(start), endDate: toLocalDateKey(end) };
}
