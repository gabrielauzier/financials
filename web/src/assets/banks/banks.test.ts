import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const dir = join(process.cwd(), "src/assets/banks");
const FILES = ["nubank.svg", "sofisa-direto.svg", "neon.svg", "xp.svg"];
const SOURCES = [
  "Nu Pagamentos S.A/nubank-logo-fundo-roxo2021.svg",
  "Banco Sofisa/logo-sofisa.svg",
  "Neon/header-logo-neon.svg",
  "XP Investimentos/xp-investimentos-logo.svg",
];
const MAX_FILE = 12 * 1024;
const MAX_TOTAL = 40 * 1024;

/** Returns the list of violations of the sanitize rule (empty when the SVG is acceptable). */
function violations(svg: string): string[] {
  const found: string[] = [];
  const root = /<svg\b[^>]*>/i.exec(svg)?.[0] ?? "";
  if (!/\sviewBox\s*=/.test(root)) found.push("root <svg> without viewBox");
  for (const tag of ["script", "foreignObject", "image", "iframe"]) {
    if (new RegExp(`<${tag}\\b`, "i").test(svg)) found.push(`<${tag}`);
  }
  if (/\son[a-z]+\s*=/i.test(svg)) found.push("on* attribute");
  for (const match of svg.matchAll(/(?:xlink:)?href\s*=\s*["']([^"']*)["']/gi)) {
    if (!(match[1] ?? "").startsWith("#")) found.push(`href ${match[1]}`);
  }
  if (/url\(\s*["']?\s*(?:https?:|\/\/)/i.test(svg)) found.push("url( with external target");
  if (/@import/i.test(svg)) found.push("@import");
  return found;
}

describe("bank SVG assets (ICON-01)", () => {
  it("has exactly the four bank files and no other svg", () => {
    const svgs = readdirSync(dir).filter((name) => name.endsWith(".svg"));
    expect(svgs.sort()).toEqual([...FILES].sort());
  });

  it.each(FILES)("%s passes the sanitize rule and the 12 KB budget", (file) => {
    const path = join(dir, file);
    expect(statSync(path).size).toBeLessThanOrEqual(MAX_FILE);
    expect(violations(readFileSync(path, "utf8"))).toEqual([]);
  });

  it.each(FILES)(
    "%s is a square 0 0 2500 2500 with a full-bleed first rect and no own rounding",
    (file) => {
      const svg = readFileSync(join(dir, file), "utf8");
      expect(/<svg\b[^>]*\sviewBox="0 0 2500 2500"/.test(svg)).toBe(true);
      const background = /<rect\b[^>]*>/.exec(svg)?.[0] ?? "";
      expect(background).toMatch(/\swidth="2500"/);
      expect(background).toMatch(/\sheight="2500"/);
      expect(background).not.toMatch(/\s(?:x|y)="[^0"]/);
      expect(background).not.toMatch(/\sr[xy]=/);
      expect(background).toMatch(/\sfill="#[0-9a-f]{3,6}"/i);
      expect(svg).not.toMatch(/<rect\b[^>]*\sr[xy]=/);
      expect(svg).not.toMatch(/<circle\b[^>]*r="1250"/);
    },
  );

  it("the four files together stay within 40 KB", () => {
    const total = FILES.reduce((sum, file) => sum + statSync(join(dir, file)).size, 0);
    expect(total).toBeLessThanOrEqual(MAX_TOTAL);
  });

  it("the predicate flags the forbidden content (negative cases)", () => {
    const ok = '<svg viewBox="0 0 1 1"><path d="M0 0"/></svg>';
    expect(violations(ok)).toEqual([]);
    expect(violations('<svg viewBox="0 0 1 1"><script>alert(1)</script></svg>')).not.toEqual([]);
    expect(violations('<svg viewBox="0 0 1 1"><use href="https://x"/></svg>')).not.toEqual([]);
    expect(violations('<svg viewBox="0 0 1 1"><use xlink:href="#a"/></svg>')).toEqual([]);
    expect(violations('<svg><path d="M0 0"/></svg>')).not.toEqual([]);
    expect(violations('<svg viewBox="0 0 1 1"><foreignObject/></svg>')).not.toEqual([]);
    expect(violations('<svg viewBox="0 0 1 1"><image href="#a"/></svg>')).not.toEqual([]);
    expect(violations('<svg viewBox="0 0 1 1"><iframe/></svg>')).not.toEqual([]);
    expect(violations('<svg viewBox="0 0 1 1" onload="x()"/>')).not.toEqual([]);
    expect(violations('<svg viewBox="0 0 1 1"><path fill="url(https://x/a)"/></svg>')).not.toEqual(
      [],
    );
    expect(violations('<svg viewBox="0 0 1 1"><path fill="url(//x/a)"/></svg>')).not.toEqual([]);
    expect(violations('<svg viewBox="0 0 1 1"><path fill="url(#a)"/></svg>')).toEqual([]);
    expect(violations('<svg viewBox="0 0 1 1"><style>@import "x";</style></svg>')).not.toEqual([]);
  });
});

describe("NOTICE (ICON-01 AC 2 and 4)", () => {
  const notice = readFileSync(join(dir, "NOTICE"), "utf8");

  it("names the repository, the four sources and the four vendored files", () => {
    expect(notice).toContain("https://github.com/Tgentil/Bancos-em-SVG");
    expect(notice).toContain("fe1d43f0cf379135bd01c987bc147a04fdf48c6d");
    for (const source of SOURCES) expect(notice).toContain(source);
    for (const file of FILES) expect(notice).toContain(file);
  });

  it("records the owner's confirmation, the edits and the non-personal-use warning", () => {
    expect(notice).toMatch(/owner confirmed/i);
    expect(notice).toMatch(/personal use/i);
    expect(notice).toMatch(/viewBox/);
    expect(notice).toMatch(/full-bleed/i);
    expect(notice).toMatch(/recompos/i);
    expect(notice).toMatch(/metadata/i);
    expect(notice).toMatch(/beyond the personal use/i);
    expect(notice).toMatch(/belong to\s+their respective banks/i);
  });
});
