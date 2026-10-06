const pad = (value: number) => String(value).padStart(2, "0");

/** Local calendar date as YYYY-MM-DD. */
export const localIsoDate = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const addLocalDays = (date: Date, days: number) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

/** The month `offset` months from `date` as YYYY-MM (0 = same month, -1 = previous). */
export function localMonth(date: Date, offset = 0): string {
  const shifted = new Date(date.getFullYear(), date.getMonth() + offset, 1);
  return `${shifted.getFullYear()}-${pad(shifted.getMonth() + 1)}`;
}
