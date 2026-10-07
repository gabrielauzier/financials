/**
 * Colors of the summary card, in one place so the component and the contrast test read the same classes.
 * Each tone is a light class and its `dark:` pair; the card sits on `bg-card`. Income is green, expense red and
 * investments blue (three distinct hues); the balance takes the income or the expense tone by its sign.
 */
export const summaryColors = {
  income: "text-emerald-700 dark:text-emerald-400",
  expense: "text-red-700 dark:text-red-400",
  investments: "text-blue-700 dark:text-blue-400",
  /** A zero balance: the plain text color of the theme. */
  neutral: "text-foreground",
} as const;

/**
 * Ring of a value whose filter is applied; it adds no text or background color, so the text contrast does not
 * change. A visible state indicator needs 3:1 against the card (WCAG 1.4.11), which the shared `--ring` token does
 * not reach on the light card (2.6:1): `slate-500` has 4.8:1 on the light card and 3.7:1 on the dark one.
 */
export const summaryActiveRing = "ring-2 ring-slate-500";

const ZERO = /^-?0+(?:\.0+)?$/;

/**
 * Tone of the balance, from the decimal string the API sent: green when positive, red when negative and plain at
 * zero. Only the text is read (a leading "-" and zeros): the amount is never turned into a number.
 */
export function balanceClassName(balance: string): string {
  const text = balance.trim();
  if (ZERO.test(text)) return summaryColors.neutral;
  return text.startsWith("-") ? summaryColors.expense : summaryColors.income;
}
