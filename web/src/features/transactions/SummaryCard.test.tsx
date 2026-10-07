import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockRequest } from "@/lib/api/mock";
import type { Category, TransactionSummary } from "@/lib/api/types";
import { failures, requests, resetSpy, responses } from "@/test/apiSpy";
import { SummaryCard } from "./SummaryCard";
import { summaryColors } from "./summaryStyles";

vi.mock("@/lib/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/client")>()),
  apiRequest: (await import("@/test/apiSpy")).spiedApiRequest,
}));

afterEach(() => {
  cleanup();
  resetSpy();
});

const KEY = "GET /transactions/summary";
const SUMMARY: TransactionSummary = {
  count: 1234,
  income: "1234.56",
  expense: "100.00",
  investments: "50.00",
  balance: "1084.56",
};
const canned = (over: Partial<TransactionSummary> = {}) =>
  responses.set(KEY, { ...SUMMARY, ...over });
const summaryRequests = () =>
  requests.filter((request) => request.path.startsWith("/transactions"));

type Props = Parameters<typeof SummaryCard>[0];
function renderCard(initial: Partial<Props> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const props: Props = {
    filters: { sort: "date", order: "desc", page: 1 },
    onSelectType: vi.fn(),
    onSelectCategory: vi.fn(),
    ...initial,
  };
  const ui = (next: Props) => (
    <QueryClientProvider client={client}>
      <SummaryCard {...next} />
    </QueryClientProvider>
  );
  const utils = render(ui(props));
  return {
    ...utils,
    client,
    props,
    /** New props; a changed filter is a new query, so this waits until the values are back on screen. */
    update: async (next: Partial<Props>) => {
      utils.rerender(ui({ ...props, ...next }));
      await screen.findByText("1.234");
    },
  };
}
const region = () => screen.getByRole("region", { name: "Resumo do extrato" });
const toggle = (label: string) => within(region()).getByRole("button", { name: new RegExp(label) });
const categoryId = async (key: string) =>
  (await mockRequest<Category[]>({ method: "GET", path: "/categories" })).find(
    (category) => category.key === key,
  )?.id as string;
const classesOf = (tone: string) => tone.split(" ");
/** The element that holds the value text of a figure. */
const valueOf = (text: string) => within(region()).getByText(text);

describe("SummaryCard: valores da API", () => {
  it("mostra a quantidade e os quatro valores como a API devolveu, em reais, sob os rótulos", async () => {
    canned({ balance: "-50.00" });
    renderCard();
    await screen.findByText("1.234");
    for (const label of ["Receitas", "Despesas", "Investimentos", "Saldo"]) {
      expect(within(region()).getByText(label)).toBeInTheDocument();
    }
    expect(toggle("Receitas")).toHaveTextContent("R$ 1.234,56");
    expect(toggle("Despesas")).toHaveTextContent("R$ 100,00");
    expect(toggle("Investimentos")).toHaveTextContent("R$ 50,00");
    expect(within(region()).getByText("Saldo").parentElement).toHaveTextContent("-R$ 50,00");
  });

  it("cada valor leva a cor do seu tom, e o saldo a cor do seu sinal", async () => {
    canned({ balance: "1084.56" });
    renderCard();
    await screen.findByText("1.234");
    expect(valueOf("R$ 1.234,56")).toHaveClass(...classesOf(summaryColors.income));
    expect(valueOf("R$ 100,00")).toHaveClass(...classesOf(summaryColors.expense));
    expect(valueOf("R$ 50,00")).toHaveClass(...classesOf(summaryColors.investments));
    expect(valueOf("R$ 1.084,56")).toHaveClass(...classesOf(summaryColors.income));
  });

  it.each([
    ["-50.00", "-R$ 50,00", summaryColors.expense],
    ["0.00", "R$ 0,00", summaryColors.neutral],
  ])("um saldo %s aparece como %s na cor do sinal", async (balance, shown, tone) => {
    canned({ balance, income: "7.00", expense: "7.00", investments: "9.00" });
    renderCard();
    await screen.findByText("1.234");
    const balanceValue = within(region()).getByText("Saldo").nextElementSibling as HTMLElement;
    expect(balanceValue).toHaveTextContent(shown);
    expect(balanceValue).toHaveClass(...classesOf(tone));
    for (const other of [summaryColors.income, summaryColors.expense].filter((c) => c !== tone)) {
      expect(balanceValue).not.toHaveClass(classesOf(other)[0] as string);
    }
  });

  it("Investimentos negativo aparece com o sinal, em azul, e não mexe no saldo", async () => {
    canned({ income: "0.00", expense: "0.00", investments: "-15.50", balance: "0.00" });
    renderCard();
    await screen.findByText("1.234");
    expect(toggle("Investimentos")).toHaveTextContent("-R$ 15,50");
    expect(valueOf("-R$ 15,50")).toHaveClass(...classesOf(summaryColors.investments));
    const balanceValue = within(region()).getByText("Saldo").nextElementSibling as HTMLElement;
    expect(balanceValue).toHaveTextContent("R$ 0,00");
    expect(balanceValue).not.toHaveTextContent("-");
    expect(balanceValue).toHaveClass(...classesOf(summaryColors.neutral));
  });

  it("Despesas negativa (só estornos) aparece com o sinal, em vermelho, com o saldo positivo", async () => {
    canned({ income: "0.00", expense: "-30.00", investments: "0.00", balance: "30.00" });
    renderCard();
    await screen.findByText("1.234");
    expect(toggle("Despesas")).toHaveTextContent("-R$ 30,00");
    expect(valueOf("-R$ 30,00")).toHaveClass(...classesOf(summaryColors.expense));
    const balanceValue = within(region()).getByText("Saldo").nextElementSibling as HTMLElement;
    expect(balanceValue).toHaveTextContent("R$ 30,00");
    expect(balanceValue).not.toHaveTextContent("-");
    expect(balanceValue).toHaveClass(...classesOf(summaryColors.income));
  });

  it("a quantidade fica em fonte maior que a dos valores", async () => {
    canned();
    renderCard();
    expect(await screen.findByText("1.234")).toHaveClass("text-4xl");
    expect(valueOf("R$ 100,00")).toHaveClass("text-lg");
  });

  it.each([
    [1, "1", "transação"],
    [0, "0", "transações"],
    [5, "5", "transações"],
    [1234, "1.234", "transações"],
  ])("com %i linhas mostra %s e o texto %s", async (count, number, label) => {
    canned({ count });
    renderCard();
    expect(await screen.findByText(number)).toBeInTheDocument();
    expect(within(region()).getByText(label)).toBeInTheDocument();
    expect(
      within(region()).queryByText(label === "transação" ? "transações" : "transação"),
    ).toBeNull();
  });

  it("um resumo vazio mostra a quantidade 0 e quatro valores R$ 0,00", async () => {
    canned({ count: 0, income: "0.00", expense: "0.00", investments: "0.00", balance: "0.00" });
    renderCard();
    expect(await screen.findByText("0")).toBeInTheDocument();
    expect(within(region()).getAllByText("R$ 0,00")).toHaveLength(4);
  });
});

describe("SummaryCard: carregando, erro e nova tentativa", () => {
  it("enquanto carrega mostra o esqueleto 'Carregando resumo' e nenhum valor", async () => {
    responses.set(KEY, () => new Promise(() => {}));
    renderCard();
    expect(await screen.findByRole("status", { name: "Carregando resumo" })).toBeInTheDocument();
    expect(within(region()).queryByText(/R\$/)).toBeNull();
    expect(within(region()).queryByRole("button")).toBeNull();
  });

  it("quando a consulta falha mostra a mensagem e 'Tentar novamente', que repete só a consulta do resumo", async () => {
    failures.set(KEY, new Error("falhou"));
    renderCard();
    expect(await screen.findByText("Não foi possível carregar o resumo.")).toBeInTheDocument();
    expect(screen.queryByRole("status")).toBeNull();
    failures.clear();
    canned();
    const before = requests.length;
    fireEvent.click(within(region()).getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByText("R$ 1.234,56")).toBeInTheDocument();
    const added = requests.slice(before);
    expect(added.map((request) => request.path)).toEqual(["/transactions/summary"]);
    expect(screen.queryByText("Não foi possível carregar o resumo.")).toBeNull();
  });

  it("com enabled falso não consulta o resumo", async () => {
    canned();
    renderCard({ enabled: false });
    await act(async () => {});
    expect(summaryRequests()).toHaveLength(0);
    expect(within(region()).queryByText(/R\$/)).toBeNull();
  });
});

describe("SummaryCard: valores que filtram a lista", () => {
  it("Receitas, Despesas e Investimentos são botões nativos focáveis e o Saldo é texto sem botão", async () => {
    canned();
    renderCard();
    await screen.findByText("1.234");
    await waitFor(() => expect(toggle("Investimentos")).toBeInTheDocument());
    const buttons = within(region()).getAllByRole("button");
    expect(buttons.map((button) => button.textContent)).toEqual([
      "ReceitasR$ 1.234,56",
      "DespesasR$ 100,00",
      "InvestimentosR$ 50,00",
    ]);
    for (const button of buttons) {
      expect(button.tagName).toBe("BUTTON");
      expect(button).toHaveAttribute("type", "button");
      expect(button).not.toBeDisabled();
      expect(button).not.toHaveAttribute("tabindex", "-1");
      button.focus();
      expect(button).toHaveFocus();
    }
    const saldo = within(region()).getByText("Saldo");
    expect(saldo.closest("button")).toBeNull();
    expect(saldo.closest("[aria-pressed]")).toBeNull();
  });

  it("marca aria-pressed só no valor cujo filtro está aplicado", async () => {
    canned();
    const investments = await categoryId("Investments");
    const other = await categoryId("Food");
    const view = renderCard();
    await screen.findByText("1.234");
    await waitFor(() => expect(toggle("Investimentos")).toBeInTheDocument());
    const pressed = () =>
      ["Receitas", "Despesas", "Investimentos"].map((label) =>
        toggle(label).getAttribute("aria-pressed"),
      );
    expect(pressed()).toEqual(["false", "false", "false"]);
    await view.update({ filters: { type: "Income" } });
    expect(pressed()).toEqual(["true", "false", "false"]);
    await view.update({ filters: { type: "Expense" } });
    expect(pressed()).toEqual(["false", "true", "false"]);
    await view.update({ filters: { categoryId: investments } });
    expect(pressed()).toEqual(["false", "false", "true"]);
    await view.update({ filters: { categoryId: other } });
    expect(pressed()).toEqual(["false", "false", "false"]);
    await view.update({ filters: { type: "Income", categoryId: investments } });
    expect(pressed()).toEqual(["true", "false", "true"]);
  });

  it("o valor ativo ganha o anel e os inativos não", async () => {
    canned();
    const view = renderCard({ filters: { type: "Expense" } });
    await screen.findByText("1.234");
    expect(toggle("Despesas")).toHaveClass("ring-2");
    expect(toggle("Receitas")).not.toHaveClass("ring-2");
    await view.update({ filters: {} });
    expect(toggle("Despesas")).not.toHaveClass("ring-2");
  });

  it("acionar um valor inativo aplica o filtro: Receitas, Despesas e Investimentos (pelo id da chave Investments)", async () => {
    canned();
    const investments = await categoryId("Investments");
    const { props } = renderCard();
    await screen.findByText("1.234");
    await waitFor(() => expect(toggle("Investimentos")).toBeInTheDocument());
    fireEvent.click(toggle("Receitas"));
    expect(props.onSelectType).toHaveBeenLastCalledWith("Income");
    fireEvent.click(toggle("Despesas"));
    expect(props.onSelectType).toHaveBeenLastCalledWith("Expense");
    fireEvent.click(toggle("Investimentos"));
    expect(props.onSelectCategory).toHaveBeenLastCalledWith(investments);
    expect(props.onSelectType).toHaveBeenCalledTimes(2);
    expect(props.onSelectCategory).toHaveBeenCalledTimes(1);
  });

  it("acionar um valor ativo remove só o filtro dele", async () => {
    canned();
    const investments = await categoryId("Investments");
    const type = renderCard({ filters: { type: "Income" } });
    await screen.findByText("1.234");
    fireEvent.click(toggle("Receitas"));
    expect(type.props.onSelectType).toHaveBeenCalledExactlyOnceWith(undefined);
    expect(type.props.onSelectCategory).not.toHaveBeenCalled();
    cleanup();

    const expense = renderCard({ filters: { type: "Expense" } });
    await screen.findByText("1.234");
    fireEvent.click(toggle("Despesas"));
    expect(expense.props.onSelectType).toHaveBeenCalledExactlyOnceWith(undefined);
    cleanup();

    const category = renderCard({ filters: { categoryId: investments } });
    await screen.findByText("1.234");
    await waitFor(() => expect(toggle("Investimentos")).toHaveAttribute("aria-pressed", "true"));
    fireEvent.click(toggle("Investimentos"));
    expect(category.props.onSelectCategory).toHaveBeenCalledExactlyOnceWith(undefined);
    expect(category.props.onSelectType).not.toHaveBeenCalled();
  });

  it("com Despesa aplicada, Receitas troca o tipo; com outra categoria aplicada, Investimentos troca a categoria", async () => {
    canned();
    const investments = await categoryId("Investments");
    const type = renderCard({ filters: { type: "Expense" } });
    await screen.findByText("1.234");
    fireEvent.click(toggle("Receitas"));
    expect(type.props.onSelectType).toHaveBeenCalledExactlyOnceWith("Income");
    cleanup();

    const category = renderCard({ filters: { categoryId: await categoryId("Food") } });
    await screen.findByText("1.234");
    await waitFor(() => expect(toggle("Investimentos")).toBeInTheDocument());
    fireEvent.click(toggle("Investimentos"));
    expect(category.props.onSelectCategory).toHaveBeenCalledExactlyOnceWith(investments);
  });
});

describe("SummaryCard: a categoria Investments é resolvida pela chave", () => {
  const category = (over: Partial<Category>): Category => ({
    id: "x",
    key: null,
    name: "Qualquer",
    isSystem: false,
    color: "slate-400",
    ...over,
  });

  it("aplica o id da categoria de chave Investments mesmo com outro nome e com uma categoria do usuário chamada 'Investments'", async () => {
    canned();
    responses.set("GET /categories", [
      category({ id: "decoy", key: null, name: "Investments" }),
      category({ id: "system", key: "Investments", name: "Poupança", isSystem: true }),
    ]);
    const { props } = renderCard();
    await screen.findByText("1.234");
    await waitFor(() => expect(toggle("Investimentos")).toBeInTheDocument());
    fireEvent.click(toggle("Investimentos"));
    expect(props.onSelectCategory).toHaveBeenCalledExactlyOnceWith("system");
  });

  it("o nome da categoria de sistema da lista real não é a chave, e o clique usa o id dela", async () => {
    canned();
    const real = (await mockRequest<Category[]>({ method: "GET", path: "/categories" })).find(
      (item) => item.key === "Investments",
    ) as Category;
    expect(real.name).not.toBe("Investments");
    const { props } = renderCard();
    await screen.findByText("1.234");
    await waitFor(() => expect(toggle("Investimentos")).toBeInTheDocument());
    fireEvent.click(toggle("Investimentos"));
    expect(props.onSelectCategory).toHaveBeenCalledExactlyOnceWith(real.id);
  });

  it.each([
    [
      "a lista não tem a chave Investments",
      () => responses.set("GET /categories", [category({ id: "d", name: "Investments" })]),
    ],
    ["a lista de categorias falhou", () => failures.set("GET /categories", new Error("falhou"))],
  ])("quando %s, Investimentos é só texto, sem botão", async (_label, arrange) => {
    canned();
    arrange();
    const view = renderCard();
    await screen.findByText("1.234");
    await waitFor(() =>
      expect(view.client.getQueryState(["categories"])?.status).not.toBe("pending"),
    );
    expect(within(region()).getByText("Investimentos")).toBeInTheDocument();
    expect(within(region()).getByText("R$ 50,00")).toBeInTheDocument();
    expect(within(region()).queryByRole("button", { name: /Investimentos/ })).toBeNull();
    expect(
      within(region())
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual(["ReceitasR$ 1.234,56", "DespesasR$ 100,00"]);
  });

  it("enquanto a lista de categorias carrega, Investimentos é só texto", async () => {
    canned();
    responses.set("GET /categories", () => new Promise(() => {}));
    renderCard();
    await screen.findByText("1.234");
    expect(within(region()).getByText("Investimentos")).toBeInTheDocument();
    expect(within(region()).queryByRole("button", { name: /Investimentos/ })).toBeNull();
  });
});

describe("SummaryCard: o card usa as classes do tema", () => {
  it("fica sobre bg-card", async () => {
    canned();
    renderCard();
    await screen.findByText("1.234");
    expect(region().firstElementChild).toHaveClass("bg-card");
  });
});
