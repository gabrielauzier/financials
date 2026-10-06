const FALLBACK_NAME = 'import.csv';

// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001f\u007f-\u009f]/g;

/** RFC 5987 `attr-char` is what `encodeURIComponent` leaves minus these. */
const extendedEncode = (value: string): string =>
  encodeURIComponent(value).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

/**
 * `Content-Disposition: attachment` for a file name that came from a client: the `filename` fallback
 * holds printable ASCII only (everything else, quotes, backslashes, slashes and `;` included, becomes
 * `_`) and `filename*` carries the real name UTF-8 percent-encoded. Control characters (CR and LF
 * included) are dropped first, so they never reach the header. An empty name becomes `import.csv`.
 */
export function contentDisposition(filename: string): string {
  const name = filename.replace(CONTROL, '').trim() || FALLBACK_NAME;
  const fallback = Array.from(name, (char) => (/[\x20-\x7e]/.test(char) && !/["\\/;]/.test(char) ? char : '_')).join('');
  return `attachment; filename="${fallback}"; filename*=UTF-8''${extendedEncode(name)}`;
}
