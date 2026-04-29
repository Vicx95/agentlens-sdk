export function uuidToTraceId(uuid: string): string {
  return uuid.replace(/-/g, '');
}

export function uuidToSpanId(uuid: string): string {
  return uuid.replace(/-/g, '').slice(0, 16);
}

export function msToNano(ms: number): string {
  return String(ms * 1_000_000);
}
