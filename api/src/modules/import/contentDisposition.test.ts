import { describe, expect, it } from 'vitest';
import { contentDisposition } from './contentDisposition.js';

const parts = (header: string) => {
  const match = /^attachment; filename="([^"]*)"; filename\*=UTF-8''(\S*)$/.exec(header);
  if (!match) throw new Error(`not a valid attachment header: ${header}`);
  return { fallback: match[1] as string, extended: match[2] as string };
};

describe('contentDisposition (IMPIMP-08)', () => {
  it('gives a plain ASCII name as both the fallback and the encoded name', () => {
    expect(contentDisposition('extrato-2026.07.csv')).toBe(
      `attachment; filename="extrato-2026.07.csv"; filename*=UTF-8''extrato-2026.07.csv`,
    );
  });

  it('keeps accents in filename* (percent-encoded UTF-8) and an ASCII fallback', () => {
    const { fallback, extended } = parts(contentDisposition('extrato março.csv'));
    expect(fallback).toBe('extrato mar_o.csv');
    expect(extended).toBe('extrato%20mar%C3%A7o.csv');
    expect(decodeURIComponent(extended)).toBe('extrato março.csv');
    expect(fallback).toMatch(/^[\x20-\x7e]*$/);
  });

  it('replaces an astral character with one underscore in the fallback', () => {
    expect(parts(contentDisposition('a😀b.csv')).fallback).toBe('a_b.csv');
  });

  it('neutralizes double quote, backslash, semicolon and slash in the fallback', () => {
    const { fallback } = parts(contentDisposition('a"b\\c;d/e.csv'));
    expect(fallback).toBe('a_b_c_d_e.csv');
    for (const char of ['"', '\\', ';', '/']) expect(fallback).not.toContain(char);
  });

  it('keeps the header a single well-formed attachment value when the name has quotes and a semicolon', () => {
    const header = contentDisposition('x"; filename="evil.exe');
    const { fallback, extended } = parts(header);
    expect(fallback).toBe('x__ filename=_evil.exe');
    expect(decodeURIComponent(extended)).toBe('x"; filename="evil.exe');
    expect(header.match(/filename=/g)).toHaveLength(2); // `filename=` and `filename*=` only
  });

  it('percent-encodes the characters encodeURIComponent leaves that RFC 5987 does not allow', () => {
    expect(parts(contentDisposition("a'b(c)d*e.csv")).extended).toBe('a%27b%28c%29d%2Ae.csv');
  });

  it('never lets CR, LF or other control characters reach the output', () => {
    const header = contentDisposition('ex\r\ntra\u0000to\u001f\u007f\u0085.csv');
    // eslint-disable-next-line no-control-regex
    expect(header).not.toMatch(/[\u0000-\u001f\u007f-\u009f]/);
    expect(header).not.toMatch(/%0[0-9A-Fa-f]|%1[0-9A-Fa-f]|%7F|%C2%85/i);
    expect(parts(header)).toEqual({ fallback: 'extrato.csv', extended: 'extrato.csv' });
  });

  it.each(['', '   ', '\r\n', '\u0000\u001f'])('falls back to a fixed ASCII name for the empty name %j', (name) => {
    expect(contentDisposition(name)).toBe(`attachment; filename="import.csv"; filename*=UTF-8''import.csv`);
  });
});
