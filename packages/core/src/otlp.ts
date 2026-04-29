export function uuidToTraceId(uuid: string): string {
  return uuid.replace(/-/g, '').toLowerCase();
}

export function uuidToSpanId(uuid: string): string {
  return uuid.replace(/-/g, '').toLowerCase().slice(0, 16);
}

export function msToNano(ms: number): string {
  return (BigInt(Math.round(ms)) * 1_000_000n).toString();
}

type OtlpAnyValue =
  | { stringValue: string }
  | { intValue: string }
  | { doubleValue: number }
  | { boolValue: boolean };

export function mapAttributeValue(value: unknown): OtlpAnyValue {
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { boolValue: value };
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { intValue: String(value) } : { doubleValue: value };
  }
  return { stringValue: JSON.stringify(value) };
}
