export function uuidToTraceId(uuid: string): string {
  return uuid.replace(/-/g, '').toLowerCase();
}

export function uuidToSpanId(uuid: string): string {
  return uuid.replace(/-/g, '').toLowerCase().slice(0, 16);
}

export function msToNano(ms: number): string {
  return (BigInt(Math.round(ms)) * 1_000_000n).toString();
}
