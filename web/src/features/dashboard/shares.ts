const toCents = (value: string) => {
  const negative = value.startsWith("-");
  const [integer = "0", fraction = ""] = value.replace("-", "").split(".");
  const cents = BigInt(integer) * 100n + BigInt(fraction.padEnd(2, "0").slice(0, 2));
  return negative ? -cents : cents;
};

/**
 * Display-only share ("12,5%") of each positive amount over the sum of the positive ones, on
 * integer cents (no floats). Negative rows (the Estorno) and an all-zero base get `null`.
 */
export function positiveShares(totals: string[]): (string | null)[] {
  const cents = totals.map(toCents);
  const base = cents.reduce((sum, value) => (value > 0n ? sum + value : sum), 0n);
  return cents.map((value) => {
    if (value <= 0n || base === 0n) return null;
    const tenths = (value * 1000n + base / 2n) / base;
    return `${tenths / 10n},${tenths % 10n}%`;
  });
}
