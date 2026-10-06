import { fireEvent, screen, within } from "@testing-library/react";

const MONTHS = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

/**
 * Opens the DatePicker found by `trigger` (its label or an element) and picks the day in the month the
 * calendar already shows. It never touches the month/year dropdowns: each dropdown change costs about
 * 1.5 s in jsdom. Put the system clock in the target month first (`vi.setSystemTime(new Date(year, month - 1, 15))`
 * with fake timers on, before the picker mounts or opens); a picker that already holds a value opens on
 * that value's month instead.
 */
export function pickDate(trigger: string | HTMLElement, isoDay: string) {
  const [year, month, day] = isoDay.split("-").map(Number) as [number, number, number];
  fireEvent.click(typeof trigger === "string" ? screen.getByLabelText(trigger) : trigger);
  const grid = screen.getByRole("grid");
  // the full date label ("sexta-feira, 31 de dezembro de 2026") is unique even with outside days shown
  fireEvent.click(
    within(grid).getByRole("button", {
      name: new RegExp(`(^|\\s)${day} de ${MONTHS[month - 1]} de ${year}`),
    }),
  );
}
