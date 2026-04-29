import { describe, it, expect } from 'vitest';
import { uuidToTraceId, uuidToSpanId, msToNano } from '../src/otlp.js';

describe('uuidToTraceId', () => {
  it('strips dashes to produce a 32-char hex string', () => {
    expect(uuidToTraceId('550e8400-e29b-41d4-a716-446655440000'))
      .toBe('550e8400e29b41d4a716446655440000');
  });
});

describe('uuidToSpanId', () => {
  it('takes the first 16 hex chars of the UUID to produce an 8-byte span ID', () => {
    expect(uuidToSpanId('550e8400-e29b-41d4-a716-446655440000'))
      .toBe('550e8400e29b41d4');
  });
});

describe('msToNano', () => {
  it('converts milliseconds to nanosecond string', () => {
    expect(msToNano(1_000)).toBe('1000000000');
    expect(msToNano(1_234_567_890_123)).toBe('1234567890123000000');
  });
});
