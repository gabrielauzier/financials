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

/** Opens the DatePicker found by `trigger` (its label or an element), goes to the month and picks the day. */
export function pickDate(trigger: string | HTMLElement, isoDay: string) {
  const [year, month, day] = isoDay.split("-").map(Number) as [number, number, number];
  fireEvent.click(typeof trigger === "string" ? screen.getByLabelText(trigger) : trigger);
  fireEvent.change(screen.getByLabelText("Escolher o ano"), { target: { value: String(year) } });
  fireEvent.change(screen.getByLabelText("Escolher o mês"), {
    target: { value: String(month - 1) },
  });
  const grid = screen.getByRole("grid");
  // the full date label ("sexta-feira, 31 de dezembro de 2026") is unique even with outside days shown
  fireEvent.click(
    within(grid).getByRole("button", {
      name: new RegExp(`(^|\\s)${day} de ${MONTHS[month - 1]} de ${year}`),
    }),
  );
}
