import { describe, it, expect } from 'vitest';
import { uuidToTraceId, uuidToSpanId, msToNano, mapAttributeValue } from '../src/otlp.js';

describe('uuidToTraceId', () => {
  it('strips dashes to produce a 32-char hex string', () => {
    expect(uuidToTraceId('550e8400-e29b-41d4-a716-446655440000'))
      .toBe('550e8400e29b41d4a716446655440000');
  });

  it('lowercases uppercase hex digits', () => {
    expect(uuidToTraceId('550E8400-E29B-41D4-A716-446655440000'))
      .toBe('550e8400e29b41d4a716446655440000');
  });
});

describe('uuidToSpanId', () => {
  it('takes the first 16 hex chars of the UUID to produce an 8-byte span ID', () => {
    expect(uuidToSpanId('550e8400-e29b-41d4-a716-446655440000'))
      .toBe('550e8400e29b41d4');
  });

  it('lowercases and always returns exactly 16 chars', () => {
    const result = uuidToSpanId('AAAABBBB-CCCC-DDDD-EEEE-FFFF00001111');
    expect(result).toBe('aaaabbbbccccdddd');
    expect(result).toHaveLength(16);
  });
});

describe('msToNano', () => {
  it('converts milliseconds to nanosecond string', () => {
    expect(msToNano(1_000)).toBe('1000000000');
    expect(msToNano(1_234_567_890_123)).toBe('1234567890123000000');
  });

  it('handles zero', () => {
    expect(msToNano(0)).toBe('0');
  });

  it('rounds float milliseconds without precision loss', () => {
    expect(msToNano(1000.5)).toBe('1001000000');
  });
});

describe('mapAttributeValue', () => {
  it('maps string to stringValue', () => {
    expect(mapAttributeValue('hello')).toEqual({ stringValue: 'hello' });
  });

  it('maps integer number to intValue string', () => {
    expect(mapAttributeValue(42)).toEqual({ intValue: '42' });
  });

  it('maps float number to doubleValue', () => {
    expect(mapAttributeValue(3.14)).toEqual({ doubleValue: 3.14 });
  });

  it('maps boolean to boolValue', () => {
    expect(mapAttributeValue(true)).toEqual({ boolValue: true });
    expect(mapAttributeValue(false)).toEqual({ boolValue: false });
  });

  it('maps object to stringValue via JSON.stringify', () => {
    expect(mapAttributeValue({ a: 1 })).toEqual({ stringValue: '{"a":1}' });
  });

  it('maps null to stringValue "null"', () => {
    expect(mapAttributeValue(null)).toEqual({ stringValue: 'null' });
  });
});
