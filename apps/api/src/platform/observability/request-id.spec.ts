import { REQUEST_ID_PATTERN, resolveRequestId } from './request-id';

const GENERATED = 'generated-id';
const generate = () => GENERATED;

describe('resolveRequestId', () => {
  it('reuses a valid inbound identifier', () => {
    expect(resolveRequestId('abc-123.X_y', generate)).toBe('abc-123.X_y');
  });

  it('accepts values up to 128 characters', () => {
    const value = 'a'.repeat(128);
    expect(REQUEST_ID_PATTERN.test(value)).toBe(true);
    expect(resolveRequestId(value, generate)).toBe(value);
  });

  it('generates an identifier when the header is missing', () => {
    expect(resolveRequestId(undefined, generate)).toBe(GENERATED);
    expect(resolveRequestId(null, generate)).toBe(GENERATED);
    expect(resolveRequestId('', generate)).toBe(GENERATED);
  });

  it('generates an identifier for repeated header values', () => {
    expect(resolveRequestId(['one', 'two'], generate)).toBe(GENERATED);
  });

  it('generates an identifier for malformed values', () => {
    expect(resolveRequestId('has space', generate)).toBe(GENERATED);
    expect(resolveRequestId('has/slash', generate)).toBe(GENERATED);
    expect(resolveRequestId('emoji-😀', generate)).toBe(GENERATED);
  });

  it('generates an identifier for oversized values', () => {
    expect(resolveRequestId('a'.repeat(129), generate)).toBe(GENERATED);
  });
});
