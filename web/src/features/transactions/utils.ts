export function parseBRLToDecimal(value: string): string | null {
  const clean = value.trim().replace(/\s/g, "");
  if (!/^\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?$|^\d+(?:,\d{1,2})?$/.test(clean)) return null;
  const decimal = clean.replace(/\./g, "").replace(",", ".");
  if (/^0+(?:\.0{1,2})?$/.test(decimal)) return null;
  const [integer = "0", fraction] = decimal.split(".");
  return `${integer.replace(/^0+(?=\d)/, "")}${fraction === undefined ? "" : `.${fraction.padEnd(2, "0")}`}`;
}

export function toLocalDateInput(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
