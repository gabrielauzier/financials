import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import { ImportStartStep } from "./ImportStartStep";

vi.mock("@/features/accounts/AccountSelect", () => ({
  AccountSelect: ({
    id,
    value,
    onChange,
  }: {
    id?: string;
    value?: string;
    onChange: (id: string) => void;
  }) => (
    <select id={id} value={value ?? ""} onChange={(event) => onChange(event.target.value)}>
      <option value="">Selecione uma conta</option>
      <option value="acc-1">Nubank pessoal</option>
    </select>
  ),
}));

afterEach(cleanup);

const csv = (size = 10, name = "extrato.csv") => {
  const file = new File(["x"], name, { type: "text/csv" });
  Object.defineProperty(file, "size", { value: size });
  return file;
};

function setup(props: Partial<React.ComponentProps<typeof ImportStartStep>> = {}) {
  const handlers = {
    onAccountChange: vi.fn(),
    onFileChange: vi.fn(),
    onSubmit: vi.fn(),
  };
  render(<ImportStartStep accountId={undefined} file={null} {...handlers} {...props} />);
  return handlers;
}

const pick = (file: File) =>
  fireEvent.change(screen.getByLabelText("Arquivo CSV"), { target: { files: [file] } });

describe("etapa conta e arquivo", () => {
  it("bloqueia arquivo acima de 5 MB com a mensagem", () => {
    const { onFileChange } = setup();
    pick(csv(5 * 1024 * 1024 + 1));
    expect(screen.getByRole("alert")).toHaveTextContent("Arquivo excede 5 MB");
    expect(onFileChange).toHaveBeenLastCalledWith(null);
  });

  it("aceita exatamente 5 MB", () => {
    const { onFileChange } = setup();
    const file = csv(5 * 1024 * 1024);
    pick(file);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(onFileChange).toHaveBeenLastCalledWith(file);
  });

  it("bloqueia extensão diferente de .csv e .tsv", () => {
    const { onFileChange } = setup();
    for (const name of ["extrato.pdf", "extrato.txt", "extrato.csv.pdf", "extrato.tsvx", "tsv"]) {
      pick(csv(10, name));
      expect(screen.getByRole("alert"), name).toHaveTextContent(
        "Selecione um arquivo .csv ou .tsv",
      );
      expect(onFileChange, name).toHaveBeenLastCalledWith(null);
    }
  });

  it("aceita .tsv e .TSV, e também .csv em maiúsculas, sem alerta", () => {
    const { onFileChange } = setup();
    for (const name of ["extrato.tsv", "EXTRATO.TSV", "extrato.Tsv", "EXTRATO.CSV"]) {
      const file = csv(10, name);
      pick(file);
      expect(screen.queryByRole("alert"), name).not.toBeInTheDocument();
      expect(onFileChange, name).toHaveBeenLastCalledWith(file);
    }
  });

  it("limpa o erro de extensão ao escolher um .tsv em seguida", () => {
    setup();
    pick(csv(10, "extrato.pdf"));
    expect(screen.getByRole("alert")).toBeInTheDocument();
    pick(csv(10, "extrato.tsv"));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("o campo aceita .csv e .tsv e o texto de ajuda cita Nubank, Sofisa Direto, Notion, CSV e TSV", () => {
    setup();
    const input = screen.getByLabelText("Arquivo CSV");
    expect(input).toHaveAttribute("accept", ".csv,.tsv,text/csv,text/tab-separated-values");
    expect(input).toHaveAccessibleDescription(
      "Nubank (extrato da conta ou fatura do cartão), Sofisa Direto (extrato da conta) ou o modelo de transações do Notion, em CSV ou TSV, até 5 MB. O modelo do Notion vale para qualquer conta.",
    );
  });

  it("mantém Gerar prévia desabilitado sem conta ou sem arquivo", () => {
    setup({ accountId: "acc-1" });
    expect(screen.getByRole("button", { name: "Gerar prévia" })).toBeDisabled();
    cleanup();
    setup({ file: csv() });
    expect(screen.getByRole("button", { name: "Gerar prévia" })).toBeDisabled();
  });

  it("habilita e dispara a prévia com conta e arquivo válidos", () => {
    const { onSubmit } = setup({ accountId: "acc-1", file: csv() });
    const button = screen.getByRole("button", { name: "Gerar prévia" });
    expect(button).toBeEnabled();
    fireEvent.click(button);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("mostra em português os erros unsupported_format e bank_mismatch do servidor", () => {
    setup({
      accountId: "acc-1",
      file: csv(),
      error: new ApiError("unsupported_format", "Unsupported file", 422),
    });
    expect(screen.getByRole("alert")).toHaveTextContent("Formato de arquivo não reconhecido");
    cleanup();
    setup({
      accountId: "acc-1",
      file: csv(),
      error: new ApiError("bank_mismatch", "Bank mismatch", 422),
    });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Formato incompatível com a conta selecionada",
    );
    expect(screen.queryByText(/mismatch/i)).not.toBeInTheDocument();
  });
});
