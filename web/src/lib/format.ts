const DECIMAL_PATTERN = /^(-?)(\d+)(?:\.(\d+))?$/;

export function formatBRL(value: string): string {
  const match = DECIMAL_PATTERN.exec(value.trim());
  if (!match) return "R$ 0,00";
  const sign = match[1] ?? "";
  const integerPart = match[2] ?? "0";
  const decimalPart = match[3] ?? "";
  const integer = integerPart.replace(/^0+(?=\d)/, "");
  const fraction = `${decimalPart}00`.slice(0, 2);
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${sign ? "-" : ""}R$ ${grouped},${fraction}`;
}

export function formatDateLocal(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}
