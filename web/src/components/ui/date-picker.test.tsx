import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DatePicker } from "./date-picker";
import { formatLocalDate, parseLocalDate } from "./date-picker-utils";

const originalTZ = process.env["TZ"];
afterEach(() => {
  cleanup();
  if (originalTZ === undefined) delete process.env["TZ"];
  else process.env["TZ"] = originalTZ;
});

// One zone west of UTC and one far east: a `toISOString().slice(0, 10)` implementation breaks in the east.
const ZONES = ["America/Sao_Paulo", "Pacific/Kiritimati"];

const open = () =>
  fireEvent.click(screen.getByRole("button", { name: /Selecione a data|\d{2}\/\d{2}\/\d{4}/ }));
const pickDay = (label: RegExp) => fireEvent.click(screen.getByRole("button", { name: label }));

describe("DatePicker", () => {
  it("chama onChange com o YYYY-MM-DD exato do dia escolhido, em qualquer fuso (31/12/2026)", () => {
    for (const zone of ZONES) {
      process.env["TZ"] = zone;
      const onChange = vi.fn();
      render(<DatePicker value="2026-12-15" onChange={onChange} />);
      open();
      pickDay(/(^|\s)31 de dezembro de 2026/);
      expect(onChange).toHaveBeenCalledExactlyOnceWith("2026-12-31");
      cleanup();
    }
  });

  it("entrega 2027-01-01 ao escolher o primeiro dia do ano, em qualquer fuso", () => {
    for (const zone of ZONES) {
      process.env["TZ"] = zone;
      const onChange = vi.fn();
      render(<DatePicker value="2027-01-15" onChange={onChange} />);
      open();
      pickDay(/(^|\s)1 de janeiro de 2027/);
      expect(onChange).toHaveBeenCalledExactlyOnceWith("2027-01-01");
      cleanup();
    }
  });

  it("'Limpar' chama onChange('') e só aparece quando há valor", () => {
    const onChange = vi.fn();
    render(<DatePicker value="" onChange={onChange} />);
    open();
    expect(screen.queryByRole("button", { name: "Limpar" })).not.toBeInTheDocument();
    cleanup();
    render(<DatePicker value="2026-10-05" onChange={onChange} />);
    open();
    fireEvent.click(screen.getByRole("button", { name: "Limpar" }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith("");
  });

  it("desabilitado não abre o calendário e mostra o valor recebido", () => {
    render(<DatePicker value="2026-10-05" onChange={vi.fn()} disabled />);
    const trigger = screen.getByRole("button", { name: "05/10/2026" });
    expect(trigger).toBeDisabled();
    fireEvent.click(trigger);
    expect(screen.queryByRole("grid")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Limpar" })).not.toBeInTheDocument();
  });

  it("valor vazio mostra 'Selecione a data'; com valor mostra dd/MM/yyyy", () => {
    const { rerender } = render(<DatePicker value="" onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Selecione a data" })).toBeInTheDocument();
    rerender(<DatePicker value="2028-02-29" onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "29/02/2028" })).toBeInTheDocument();
    expect(screen.queryByText("Selecione a data")).not.toBeInTheDocument();
  });

  it("string inválida é tratada como vazia: placeholder e nenhum 'Limpar'", () => {
    for (const invalid of ["abc", "2026-13-01", "2027-02-29", "2026-1-5", "05/10/2026"]) {
      render(<DatePicker value={invalid} onChange={vi.fn()} />);
      expect(screen.getByRole("button", { name: "Selecione a data" })).toBeInTheDocument();
      open();
      expect(screen.queryByRole("button", { name: "Limpar" })).not.toBeInTheDocument();
      cleanup();
    }
  });

  it("o gatilho mantém o id, então o rótulo encontra o campo", () => {
    render(
      <>
        <label htmlFor="filter-from">De</label>
        <DatePicker id="filter-from" value="" onChange={vi.fn()} />
      </>,
    );
    const field = screen.getByLabelText("De");
    expect(field).toHaveAttribute("id", "filter-from");
    expect(field).toHaveTextContent("Selecione a data");
  });

  it("escolher um dia fecha o calendário", () => {
    render(<DatePicker value="2026-10-05" onChange={vi.fn()} />);
    open();
    expect(screen.getByRole("grid")).toBeInTheDocument();
    pickDay(/(^|\s)10 de outubro de 2026/);
    expect(screen.queryByRole("grid")).not.toBeInTheDocument();
  });

  it("a navegação do calendário tem nomes em português e anda um mês por clique", () => {
    render(<DatePicker value="2026-10-05" onChange={vi.fn()} />);
    open();
    expect(screen.queryByRole("button", { name: /Go to/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Próximo mês" }));
    expect(screen.getByRole("button", { name: /(^|\s)1 de novembro de 2026/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mês anterior" }));
    fireEvent.click(screen.getByRole("button", { name: "Mês anterior" }));
    expect(screen.getByRole("button", { name: /(^|\s)1 de setembro de 2026/ })).toBeInTheDocument();
  });

  // The only test that drives the month and year dropdowns: each change re-renders the whole
  // Calendar (about 1.5 s in jsdom), so every other test picks the day in the month already shown.
  it("os seletores de mês e de ano levam o calendário a outro mês e o dia escolhido sai como YYYY-MM-DD", () => {
    const onChange = vi.fn();
    render(<DatePicker value="2026-10-05" onChange={onChange} />);
    open();
    fireEvent.change(screen.getByLabelText("Escolher o ano"), { target: { value: "2028" } });
    fireEvent.change(screen.getByLabelText("Escolher o mês"), { target: { value: "1" } });
    pickDay(/(^|\s)29 de fevereiro de 2028/);
    expect(onChange).toHaveBeenCalledExactlyOnceWith("2028-02-29");
  });

  it("parseLocalDate e formatLocalDate usam o dia local e rejeitam dias que não existem (bissexto incluso)", () => {
    for (const zone of ZONES) {
      process.env["TZ"] = zone;
      const leap = parseLocalDate("2028-02-29") as Date;
      expect([leap.getFullYear(), leap.getMonth(), leap.getDate()]).toEqual([2028, 1, 29]);
      expect(parseLocalDate("2027-02-29")).toBeUndefined();
      expect(parseLocalDate("2026-04-31")).toBeUndefined();
      expect(parseLocalDate("")).toBeUndefined();
      expect(formatLocalDate(new Date(2026, 11, 31, 23, 59, 59))).toBe("2026-12-31");
      expect(formatLocalDate(new Date(2027, 0, 1, 0, 0, 0))).toBe("2027-01-01");
      expect(formatLocalDate(parseLocalDate("2026-03-09") as Date)).toBe("2026-03-09");
    }
  });
});
