export function money(value: string | number | null | undefined): number {
  return Number(Number(value ?? 0).toFixed(2));
}

export function iso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export function requiredIso(value: Date | string): string {
  return iso(value) ?? new Date(0).toISOString();
}