/** Test-only color math: OKLCH (as written in the Tailwind theme and styles.css) to sRGB luminance and WCAG contrast. */
export type Oklch = { l: number; c: number; h: number };

/** Parses `oklch(97.9% 0.021 166.113)` and `oklch(0.985 0.004 90)`; throws on anything else (an alpha part included). */
export function parseOklch(text: string): Oklch {
  const match = /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)\s*\)$/.exec(text.trim());
  if (!match) throw new Error(`Not an opaque oklch() color: ${text}`);
  const lightness = Number(match[1]);
  return {
    l: match[2] === "%" ? lightness / 100 : lightness,
    c: Number(match[3]),
    h: Number(match[4]),
  };
}

/** Linear-light sRGB channels (each clamped to 0..1) of an OKLCH color. */
export function toLinearRgb({ l, c, h }: Oklch): [number, number, number] {
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);
  const l1 = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m1 = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s1 = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const clamp = (value: number) => Math.min(1, Math.max(0, value));
  return [
    clamp(4.0767416621 * l1 - 3.3077115913 * m1 + 0.2309699292 * s1),
    clamp(-1.2684380046 * l1 + 2.6097574011 * m1 - 0.3413193965 * s1),
    clamp(-0.0041960863 * l1 - 0.7034186147 * m1 + 1.707614701 * s1),
  ];
}

/** WCAG 2.x relative luminance. */
export function luminance(color: Oklch): number {
  const [r, g, b] = toLinearRgb(color);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.x contrast ratio, from 1 to 21. */
export function contrastRatio(first: Oklch, second: Oklch): number {
  const [high, low] = [luminance(first), luminance(second)].sort((x, y) => y - x) as [
    number,
    number,
  ];
  return (high + 0.05) / (low + 0.05);
}
