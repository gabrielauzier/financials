import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import { mockRequest } from "@/lib/api/mock";
import type { Category, ImportPreview, ImportRowStatus, PreviewRow } from "@/lib/api/types";
import { failures, renderWithQuery, resetSpy, responses } from "@/test/apiSpy";
import { ImportPreviewTable } from "./ImportPreviewTable";
import { initialSelection, selectedPayload, type PreviewSelection } from "./previewSelection";
import { formatLocalDate } from "./labels";

vi.mock("@/lib/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/client")>()),
  apiRequest: (await import("@/test/apiSpy")).spiedApiRequest,
}));

afterEach(() => {
  cleanup();
  resetSpy();
});

const UNCATEGORIZED = "30000000-0000-4000-8000-000000000012";
const FOOD = "30000000-0000-4000-8000-000000000002";
const TRANSPORT = "30000000-0000-4000-8000-000000000007";

const row = (
  index: number,
  status: ImportRowStatus,
  extra: Partial<PreviewRow> = {},
): PreviewRow => ({
  index,
  localDate: "2026-03-05",
  type: "Expense",
  amount: "1234.50",
  name: `Linha ${index}`,
  paymentMethod: "PIX",
  categoryId: UNCATEGORIZED,
  categoryName: "Sem categoria",
  status,
  neutral: false,
  counterpartyDocument: null,
  counterpartyBank: null,
  ...extra,
});

const rows: PreviewRow[] = [
  row(0, "new"),
  row(1, "duplicate"),
  row(2, "ignored", { reason: "Pagamento recebido" }),
  row(3, "unrecognized"),
  row(4, "invalid", { reason: "Valor inválido" }),
  row(5, "new", { neutral: true, type: "Income", amount: "10.00", paymentMethod: "BankTransfer" }),
];
const preview: ImportPreview = {
  rows,
  totals: { new: 2, duplicate: 1, ignored: 1, unrecognized: 1, invalid: 1 },
};

function Harness({
  onChange,
}: {
  onChange: (payload: ReturnType<typeof selectedPayload>) => void;
}) {
  const [selection, setSelection] = useState<PreviewSelection>(() => initialSelection(rows));
  const change = (next: PreviewSelection) => {
    setSelection(next);
    onChange(selectedPayload(rows, next));
  };
  return <ImportPreviewTable preview={preview} selection={selection} onSelectionChange={change} />;
}

describe("tabela da prévia", () => {
  it("mostra as contagens, o contador e os badges em português", () => {
    renderWithQuery(<Harness onChange={vi.fn()} />);
    const totals = within(screen.getByRole("list", { name: "Resumo da prévia" }));
    expect(totals.getByText(/novas/)).toHaveTextContent("2 novas");
    expect(totals.getByText(/duplicadas/)).toHaveTextContent("1 duplicadas");
    expect(totals.getByText(/ignoradas/)).toHaveTextContent("1 ignoradas");
    expect(totals.getByText(/não reconhecidas/)).toHaveTextContent("1 não reconhecidas");
    expect(totals.getByText(/inválidas/)).toHaveTextContent("1 inválidas");
    expect(screen.getByText("3 linhas selecionadas")).toBeInTheDocument();
    for (const label of ["Nova", "Duplicada", "Ignorada", "Não reconhecida", "Inválida"]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    expect(screen.getByText("Ignorada")).toHaveAttribute("title", "Pagamento recebido");
  });

  it("formata data sem deslocar o dia, valor com sinal e rótulo de método", () => {
    renderWithQuery(<Harness onChange={vi.fn()} />);
    expect(formatLocalDate("2026-03-05")).toBe("05/03/2026");
    const first = within(screen.getByText("Linha 0").closest("tr")!);
    expect(first.getByText("05/03/2026")).toBeInTheDocument();
    expect(first.getByText("-R$ 1.234,50")).toBeInTheDocument();
    expect(first.getByText("PIX")).toBeInTheDocument();
    const income = within(screen.getByText("Linha 5").closest("tr")!);
    expect(income.getByText("R$ 10,00")).toBeInTheDocument();
    expect(income.getByText("Transferência bancária")).toBeInTheDocument();
  });

  it("duplicadas começam desmarcadas e podem ser marcadas e desmarcadas", () => {
    const onChange = vi.fn();
    renderWithQuery(<Harness onChange={onChange} />);
    const box = screen.getByRole("checkbox", { name: "Selecionar Linha 1" });
    expect(box).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Selecionar Linha 0" })).toBeChecked();
    fireEvent.click(box);
    expect(box).toBeChecked();
    expect(onChange).toHaveBeenLastCalledWith(
      expect.arrayContaining([{ index: 1, neutral: false, categoryId: UNCATEGORIZED }]),
    );
    expect(screen.getByText("4 linhas selecionadas")).toBeInTheDocument();
    fireEvent.click(box);
    expect(onChange).toHaveBeenLastCalledWith(
      expect.not.arrayContaining([{ index: 1, neutral: false, categoryId: UNCATEGORIZED }]),
    );
  });

  it("linhas ignoradas e inválidas não têm checkbox e nunca entram no payload", () => {
    const onChange = vi.fn();
    renderWithQuery(<Harness onChange={onChange} />);
    expect(screen.queryByRole("checkbox", { name: "Selecionar Linha 2" })).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "Selecionar Linha 4" })).not.toBeInTheDocument();
    // The header "select all" checkbox plus one per selectable row.
    expect(screen.getAllByRole("checkbox")).toHaveLength(5);
    fireEvent.click(screen.getByRole("checkbox", { name: "Selecionar Linha 1" }));
    const indexes = onChange.mock.calls.at(-1)![0].map((s: { index: number }) => s.index);
    expect(indexes).toEqual([0, 1, 3, 5]);
  });

  it("neutra começa na sugestão do servidor e a troca muda o payload", () => {
    const onChange = vi.fn();
    renderWithQuery(<Harness onChange={onChange} />);
    const suggested = screen.getByRole("switch", { name: "Marcar Linha 5 como neutra" });
    const other = screen.getByRole("switch", { name: "Marcar Linha 0 como neutra" });
    expect(suggested).toBeChecked();
    expect(other).not.toBeChecked();
    fireEvent.click(other);
    fireEvent.click(suggested);
    expect(onChange).toHaveBeenLastCalledWith(
      expect.arrayContaining([
        { index: 0, neutral: true, categoryId: UNCATEGORIZED },
        { index: 5, neutral: false, categoryId: UNCATEGORIZED },
      ]),
    );
  });

  it("destaca linhas não reconhecidas para revisão", () => {
    renderWithQuery(<Harness onChange={vi.fn()} />);
    expect(screen.getAllByText("Revise esta linha")).toHaveLength(1);
    expect(screen.getByText("Linha 3").closest("tr")).toHaveAttribute(
      "data-status",
      "unrecognized",
    );
    expect(screen.getByRole("checkbox", { name: "Selecionar Linha 3" })).toBeChecked();
  });

  it("o contador vai a zero ao desmarcar tudo", () => {
    renderWithQuery(<Harness onChange={vi.fn()} />);
    for (const name of ["Linha 0", "Linha 3", "Linha 5"]) {
      fireEvent.click(screen.getByRole("checkbox", { name: `Selecionar ${name}` }));
    }
    expect(screen.getByText("0 linhas selecionadas")).toBeInTheDocument();
  });
});

describe("Valor colorido e sem a coluna Tipo (IMPIMP-05)", () => {
  const valueRows: PreviewRow[] = [
    row(0, "new", { name: "Despesa sem sinal", type: "Expense", amount: "1234.56" }),
    row(1, "new", { name: "Despesa com sinal", type: "Expense", amount: "-1234.56" }),
    row(2, "new", { name: "Salário março", type: "Income", amount: "99.90" }),
  ];
  const valuePreview: ImportPreview = {
    rows: valueRows,
    totals: { new: 3, duplicate: 0, ignored: 0, unrecognized: 0, invalid: 0 },
  };
  const renderValues = () =>
    renderWithQuery(
      <ImportPreviewTable
        preview={valuePreview}
        selection={initialSelection(valueRows)}
        onSelectionChange={vi.fn()}
      />,
    );

  it("não tem a coluna Tipo nem células Receita ou Despesa", () => {
    renderValues();
    expect(screen.queryByRole("columnheader", { name: "Tipo" })).not.toBeInTheDocument();
    expect(screen.queryByText("Receita", { selector: "td" })).not.toBeInTheDocument();
    expect(screen.queryByText("Despesa", { selector: "td" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("columnheader")).toHaveLength(8);
  });

  it("receita aparece em verde e sem sinal", () => {
    renderValues();
    const cell = screen.getByText("R$ 99,90");
    expect(cell).toHaveClass("text-emerald-700", "dark:text-emerald-400", "font-semibold");
    expect(cell).not.toHaveClass("text-destructive");
  });

  it("despesa aparece em vermelho com um único sinal, com ou sem sinal no valor do preview", () => {
    renderValues();
    for (const name of ["Despesa sem sinal", "Despesa com sinal"]) {
      const cell = within(screen.getByText(name).closest("tr")!).getByText("-R$ 1.234,56");
      expect(cell).toHaveClass("text-destructive", "font-semibold");
      expect(cell).not.toHaveClass("text-emerald-700");
    }
  });
});

describe("selecionar todas as linhas (IMPIMP-04)", () => {
  const selectAll = () => screen.getByRole("checkbox", { name: "Selecionar todas as linhas" });
  const rowBox = (index: number) =>
    screen.getByRole("checkbox", { name: `Selecionar Linha ${index}` });

  it("seleciona todas as linhas selecionáveis, atualiza o contador e deixa ignoradas e inválidas de fora", () => {
    const onChange = vi.fn();
    renderWithQuery(<Harness onChange={onChange} />);
    fireEvent.click(selectAll());
    for (const index of [0, 1, 3, 5]) expect(rowBox(index)).toBeChecked();
    expect(screen.getByText("4 linhas selecionadas")).toBeInTheDocument();
    const indexes = onChange.mock.calls.at(-1)![0].map((s: { index: number }) => s.index);
    expect(indexes).toEqual([0, 1, 3, 5]);
    expect(screen.queryByRole("checkbox", { name: "Selecionar Linha 2" })).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "Selecionar Linha 4" })).not.toBeInTheDocument();
  });

  it("aparece indeterminado com seleção parcial, marcado com todas e desmarcado com nenhuma", () => {
    renderWithQuery(<Harness onChange={vi.fn()} />);
    // Initial selection: new and unrecognized rows only, the duplicate is out.
    expect(selectAll()).toHaveAttribute("aria-checked", "mixed");
    fireEvent.click(rowBox(1));
    expect(selectAll()).toHaveAttribute("aria-checked", "true");
    for (const index of [0, 1, 3, 5]) fireEvent.click(rowBox(index));
    expect(selectAll()).toHaveAttribute("aria-checked", "false");
  });

  it("clicar no indeterminado seleciona todas e clicar no marcado limpa todas", () => {
    renderWithQuery(<Harness onChange={vi.fn()} />);
    expect(selectAll()).toHaveAttribute("aria-checked", "mixed");
    fireEvent.click(selectAll());
    expect(selectAll()).toHaveAttribute("aria-checked", "true");
    expect(rowBox(1)).toBeChecked();
    fireEvent.click(selectAll());
    expect(selectAll()).toHaveAttribute("aria-checked", "false");
    for (const index of [0, 1, 3, 5]) expect(rowBox(index)).not.toBeChecked();
    expect(screen.getByText("0 linhas selecionadas")).toBeInTheDocument();
  });

  it("mantém a chave Neutra de cada linha ao usar o checkbox do cabeçalho", () => {
    renderWithQuery(<Harness onChange={vi.fn()} />);
    const suggested = screen.getByRole("switch", { name: "Marcar Linha 5 como neutra" });
    const other = screen.getByRole("switch", { name: "Marcar Linha 0 como neutra" });
    fireEvent.click(other);
    fireEvent.click(selectAll());
    fireEvent.click(selectAll());
    fireEvent.click(selectAll());
    expect(other).toBeChecked();
    expect(suggested).toBeChecked();
    expect(screen.getByRole("switch", { name: "Marcar Linha 1 como neutra" })).not.toBeChecked();
  });

  it("fica desabilitado e desmarcado quando só há linhas ignoradas e inválidas", () => {
    const blocked = [row(0, "ignored"), row(1, "invalid")];
    renderWithQuery(
      <ImportPreviewTable
        preview={{
          rows: blocked,
          totals: { new: 0, duplicate: 0, ignored: 1, unrecognized: 0, invalid: 1 },
        }}
        selection={initialSelection(blocked)}
        onSelectionChange={vi.fn()}
      />,
    );
    expect(selectAll()).toBeDisabled();
    expect(selectAll()).toHaveAttribute("aria-checked", "false");
  });

  it("a seleção inicial continua com novas e não reconhecidas marcadas e duplicadas desmarcadas", () => {
    renderWithQuery(<Harness onChange={vi.fn()} />);
    expect(rowBox(0)).toBeChecked();
    expect(rowBox(3)).toBeChecked();
    expect(rowBox(1)).not.toBeChecked();
  });
});

describe("categoria por linha (IMPIMP-03)", () => {
  const catRows: PreviewRow[] = [
    row(0, "new", { categoryId: FOOD, categoryName: "Alimentação" }),
    row(1, "duplicate"),
    row(2, "ignored", { categoryName: "Transporte" }),
    row(3, "unrecognized", { categoryId: TRANSPORT, categoryName: "Transporte" }),
    row(4, "invalid", { categoryName: "Desconhecida" }),
    row(5, "new", { neutral: true }),
  ];
  const catPreview: ImportPreview = {
    rows: catRows,
    totals: { new: 2, duplicate: 1, ignored: 1, unrecognized: 1, invalid: 1 },
  };
  function CatHarness({
    onChange,
  }: {
    onChange: (payload: ReturnType<typeof selectedPayload>) => void;
  }) {
    const [selection, setSelection] = useState<PreviewSelection>(() => initialSelection(catRows));
    return (
      <ImportPreviewTable
        preview={catPreview}
        selection={selection}
        onSelectionChange={(next) => {
          setSelection(next);
          onChange(selectedPayload(catRows, next));
        }}
      />
    );
  }
  const select = (name: string) => screen.getByRole("combobox", { name: `Categoria de ${name}` });
  const pick = async (name: string, category: string) => {
    fireEvent.click(select(name));
    fireEvent.click(await screen.findByRole("option", { name: category }));
  };

  it("mostra um select pré-selecionado na categoria de cada linha nova, duplicada e não reconhecida", async () => {
    renderWithQuery(<CatHarness onChange={vi.fn()} />);
    await waitFor(() => expect(select("Linha 0")).toHaveTextContent("Alimentação"));
    expect(select("Linha 1")).toHaveTextContent("Sem categoria");
    expect(select("Linha 3")).toHaveTextContent("Transporte");
    expect(select("Linha 5")).toHaveTextContent("Sem categoria");
    expect(screen.getAllByRole("combobox")).toHaveLength(4);
  });

  it("lista exatamente as categorias do usuário nas opções", async () => {
    renderWithQuery(<CatHarness onChange={vi.fn()} />);
    await waitFor(() => expect(select("Linha 0")).toHaveTextContent("Alimentação"));
    const expected = (await mockRequest<Category[]>({ method: "GET", path: "/categories" })).map(
      (category) => category.name,
    );
    fireEvent.click(select("Linha 0"));
    const options = await screen.findAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual(expected);
  });

  it("mostra o nome em texto, sem select, nas linhas ignoradas e inválidas", async () => {
    renderWithQuery(<CatHarness onChange={vi.fn()} />);
    await waitFor(() => expect(select("Linha 0")).toHaveTextContent("Alimentação"));
    for (const [name, text] of [
      ["Linha 2", "Transporte"],
      ["Linha 4", "Desconhecida"],
    ] as const) {
      const cells = within(screen.getByText(name).closest("tr")!);
      expect(cells.queryByRole("combobox")).not.toBeInTheDocument();
      expect(cells.getByText(text)).toBeInTheDocument();
    }
  });

  it("escolher outra categoria muda só essa linha, sem alterar seleção nem Neutra", async () => {
    const onChange = vi.fn();
    renderWithQuery(<CatHarness onChange={onChange} />);
    await waitFor(() => expect(select("Linha 0")).toHaveTextContent("Alimentação"));
    await pick("Linha 5", "Transporte");
    await waitFor(() => expect(select("Linha 5")).toHaveTextContent("Transporte"));
    expect(select("Linha 0")).toHaveTextContent("Alimentação");
    expect(select("Linha 1")).toHaveTextContent("Sem categoria");
    expect(select("Linha 3")).toHaveTextContent("Transporte");
    expect(onChange).toHaveBeenLastCalledWith([
      { index: 0, neutral: false, categoryId: FOOD },
      { index: 3, neutral: false, categoryId: TRANSPORT },
      { index: 5, neutral: true, categoryId: TRANSPORT },
    ]);
    expect(screen.getByRole("checkbox", { name: "Selecionar Linha 1" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Selecionar Linha 5" })).toBeChecked();
    expect(screen.getByRole("switch", { name: "Marcar Linha 5 como neutra" })).toBeChecked();
    expect(screen.getByText("3 linhas selecionadas")).toBeInTheDocument();
  });

  it("a categoria escolhida sobrevive a desmarcar e marcar de novo a linha", async () => {
    const onChange = vi.fn();
    renderWithQuery(<CatHarness onChange={onChange} />);
    await waitFor(() => expect(select("Linha 0")).toHaveTextContent("Alimentação"));
    await pick("Linha 1", "Transporte");
    fireEvent.click(screen.getByRole("checkbox", { name: "Selecionar Linha 1" }));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.arrayContaining([{ index: 1, neutral: false, categoryId: TRANSPORT }]),
    );
  });

  it("editar a chave Neutra de uma linha ausente da seleção mantém a categoryId do preview", async () => {
    const onChange = vi.fn();
    renderWithQuery(
      <ImportPreviewTable
        preview={{ ...catPreview, rows: [row(0, "new", { categoryId: FOOD })] }}
        selection={{}}
        onSelectionChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole("switch", { name: "Marcar Linha 0 como neutra" }));
    expect(onChange).toHaveBeenLastCalledWith({
      0: { selected: false, neutral: true, categoryId: FOOD },
    });
  });

  it("enquanto as categorias carregam o select fica desabilitado com Carregando categorias…", async () => {
    responses.set("GET /categories", () => new Promise(() => {}));
    renderWithQuery(<CatHarness onChange={vi.fn()} />);
    const trigger = select("Linha 0");
    expect(trigger).toBeDisabled();
    expect(trigger).toHaveTextContent("Carregando categorias…");
  });

  it("se as categorias falham a coluna mostra o nome em texto e o payload mantém as categoryId do preview", async () => {
    failures.set("GET /categories", new ApiError("internal_error", "boom", 500));
    const onChange = vi.fn();
    renderWithQuery(<CatHarness onChange={onChange} />);
    await waitFor(() => expect(screen.queryAllByRole("combobox")).toHaveLength(0));
    const first = within(screen.getByText("Linha 0").closest("tr")!);
    expect(first.getByText("Alimentação", { selector: "td" })).toBeInTheDocument();
    expect(screen.getByText("Linha 1").closest("tr")).toHaveTextContent("Sem categoria");
    fireEvent.click(screen.getByRole("checkbox", { name: "Selecionar Linha 1" }));
    expect(onChange).toHaveBeenLastCalledWith([
      { index: 0, neutral: false, categoryId: FOOD },
      { index: 1, neutral: false, categoryId: UNCATEGORIZED },
      { index: 3, neutral: false, categoryId: TRANSPORT },
      { index: 5, neutral: true, categoryId: UNCATEGORIZED },
    ]);
  });
});

describe("rótulos de método da prévia", () => {
  it("mostra o rótulo em português dos 8 métodos, incluindo Boleto, NuPay e Outro", () => {
    const methods = [
      ["BankTransfer", "Transferência bancária"],
      ["Boleto", "Boleto"],
      ["Cash", "Dinheiro"],
      ["CreditCard", "Cartão de crédito"],
      ["DebitCard", "Cartão de débito"],
      ["NuPay", "NuPay"],
      ["PIX", "PIX"],
      ["Other", "Outro"],
    ] as const;
    const methodRows = methods.map(([method], index) =>
      row(index, "new", { name: `Método ${method}`, paymentMethod: method }),
    );
    renderWithQuery(
      <ImportPreviewTable
        preview={{
          rows: methodRows,
          totals: { new: 8, duplicate: 0, ignored: 0, unrecognized: 0, invalid: 0 },
        }}
        selection={initialSelection(methodRows)}
        onSelectionChange={vi.fn()}
      />,
    );
    for (const [method, label] of methods) {
      const tableRow = screen.getByText(`Método ${method}`).closest("tr") as HTMLElement;
      expect(within(tableRow).getByText(label, { selector: "td" })).toBeInTheDocument();
    }
  });
});

describe("chave Neutra das transferências próprias (IMPFIX-10)", () => {
  const neutralRows: PreviewRow[] = [
    row(0, "new", { name: "Maria Souza Lima", neutral: true, type: "Expense" }),
    row(1, "duplicate", { name: "MARIA SOUZA LIMA LTDA", neutral: true, type: "Income" }),
    row(2, "unrecognized", { name: "Maria Souza Lima", neutral: true }),
    row(3, "new", { name: "Maria Souza Lima Santos" }),
  ];
  const neutralPreview: ImportPreview = {
    rows: neutralRows,
    totals: { new: 2, duplicate: 1, ignored: 0, unrecognized: 1, invalid: 0 },
  };

  function NeutralHarness({ onChange }: { onChange: (payload: PreviewSelection) => void }) {
    const [selection, setSelection] = useState<PreviewSelection>(() =>
      initialSelection(neutralRows),
    );
    return (
      <ImportPreviewTable
        preview={neutralPreview}
        selection={selection}
        onSelectionChange={(next) => {
          setSelection(next);
          onChange(next);
        }}
      />
    );
  }
  const neutralSwitch = (name: string, position = 0) =>
    screen.getAllByRole("switch", { name: `Marcar ${name} como neutra` })[position] as HTMLElement;

  it("mostra a chave Neutra ligada nas linhas neutras do preview, selecionadas ou não, antes e depois de marcar e desmarcar", () => {
    renderWithQuery(<NeutralHarness onChange={vi.fn()} />);
    const neutralSwitches = [
      neutralSwitch("Maria Souza Lima", 0),
      neutralSwitch("MARIA SOUZA LIMA LTDA"),
      neutralSwitch("Maria Souza Lima", 1),
    ];
    for (const item of neutralSwitches) expect(item).toBeChecked();
    expect(neutralSwitch("Maria Souza Lima Santos")).not.toBeChecked();

    // The duplicate starts unselected: select it, then unselect it again.
    const duplicateBox = screen.getByRole("checkbox", { name: "Selecionar MARIA SOUZA LIMA LTDA" });
    expect(duplicateBox).not.toBeChecked();
    fireEvent.click(duplicateBox);
    expect(duplicateBox).toBeChecked();
    for (const item of neutralSwitches) expect(item).toBeChecked();
    fireEvent.click(duplicateBox);
    expect(duplicateBox).not.toBeChecked();
    for (const item of neutralSwitches) expect(item).toBeChecked();

    // Unselect and reselect a selected neutral row.
    const newBox = screen.getAllByRole("checkbox", {
      name: "Selecionar Maria Souza Lima",
    })[0] as HTMLElement;
    fireEvent.click(newBox);
    expect(neutralSwitches[0]).toBeChecked();
    fireEvent.click(newBox);
    expect(neutralSwitches[0]).toBeChecked();
    expect(neutralSwitch("Maria Souza Lima Santos")).not.toBeChecked();
  });

  it("não perde a marca neutra do preview quando a linha ainda não está no estado de seleção", () => {
    const onChange = vi.fn();
    renderWithQuery(
      <ImportPreviewTable preview={neutralPreview} selection={{}} onSelectionChange={onChange} />,
    );
    // The switch is rendered on from the preview value, so the first click on the checkbox must keep it.
    expect(neutralSwitch("MARIA SOUZA LIMA LTDA")).toBeChecked();
    fireEvent.click(screen.getByRole("checkbox", { name: "Selecionar MARIA SOUZA LIMA LTDA" }));
    expect(onChange).toHaveBeenLastCalledWith({
      1: { selected: true, neutral: true, categoryId: UNCATEGORIZED },
    });
  });
});
