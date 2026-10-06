import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { COLOR_KEYS } from "./palette";

type SchemaDoc = { properties?: { color?: { enum?: string[] } }; items?: SchemaDoc };
type OpenApi = {
  paths: Record<
    string,
    Record<
      string,
      { responses: Record<string, { content?: Record<string, { schema?: SchemaDoc }> }> }
    >
  >;
};

const doc = JSON.parse(
  readFileSync(path.resolve(__dirname, "../../../../api/openapi.json"), "utf8"),
) as OpenApi;

function colorEnum(path: string): string[] {
  const schema = doc.paths[path]?.["get"]?.responses["200"]?.content?.["application/json"]?.schema;
  const values = schema?.items?.properties?.color?.enum;
  if (!values) throw new Error(`GET ${path} 200 schema has no color enum`);
  return values;
}

/** The difference between two key lists, as text; empty when they hold the same set. */
function difference(api: readonly string[], web: readonly string[]): string {
  const missingInWeb = api.filter((key) => !web.includes(key));
  const extraInWeb = web.filter((key) => !api.includes(key));
  return [
    ...missingInWeb.map((key) => `only in the API: ${key}`),
    ...extraInWeb.map((key) => `only in the web: ${key}`),
  ].join("; ");
}

describe("palette contract with api/openapi.json", () => {
  it.each(["/accounts", "/categories"])(
    "keeps the color enum of GET %s equal to COLOR_KEYS",
    (path) => {
      const api = colorEnum(path);
      expect(api).toHaveLength(66);
      expect(new Set(api).size).toBe(66);
      expect(difference(api, COLOR_KEYS)).toBe("");
      expect([...api].sort()).toEqual([...COLOR_KEYS].sort());
    },
  );

  it("lists the difference when the lists diverge", () => {
    const mutated = [...COLOR_KEYS.slice(1), "mauve-600"];
    expect(difference(colorEnum("/accounts"), mutated)).toBe(
      "only in the API: red-400; only in the web: mauve-600",
    );
  });
});
