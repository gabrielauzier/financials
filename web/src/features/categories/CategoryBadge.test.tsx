import {
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BADGE_CLASSES, COLOR_KEYS } from "@/features/colors/palette";
import { mockRequest } from "@/lib/api/mock";
import type { Category } from "@/lib/api/types";
import { renderWithQuery, resetSpy, responses, failures } from "@/test/apiSpy";
import { CategoryBadge } from "./CategoryBadge";
import { CategorySelect } from "./CategorySelect";
import { useCategories, useCategoryLookup } from "./hooks";

vi.mock("@/lib/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/client")>()),
  apiRequest: (await import("@/test/apiSpy")).spiedApiRequest,
}));

afterEach(() => {
  cleanup();
  resetSpy();
});

const RING = ["ring-1", "ring-inset", "ring-black/10", "dark:ring-white/25"];

describe("CategoryBadge (COLOR-09)", () => {
  it("renders the name with the bg and text classes of each of the 22 keys plus the ring (AC 4)", () => {
    for (const key of COLOR_KEYS) {
      const { unmount } = render(<CategoryBadge name={`Cat ${key}`} color={key} />);
      const badge = screen.getByText(`Cat ${key}`);
      expect(badge).toHaveClass(BADGE_CLASSES[key].bg, BADGE_CLASSES[key].text, ...RING);
      unmount();
    }
  });

  it("falls back to the slate badge classes for a color outside the palette (AC 5)", () => {
    for (const color of ["banana", "", undefined, "Blue-400", "blue-600"]) {
      const { unmount } = render(<CategoryBadge name="Mercado" color={color} />);
      expect(screen.getByText("Mercado")).toHaveClass(
        BADGE_CLASSES["slate-400"].bg,
        BADGE_CLASSES["slate-400"].text,
      );
      unmount();
    }
  });

  it("truncates a long name and keeps the full name in the title (AC 6)", () => {
    const name = "Uma categoria com um nome realmente muito longo para caber no select";
    render(<CategoryBadge name={name} color="rose-400" />);
    const badge = screen.getByText(name);
    expect(badge).toHaveClass("truncate", "max-w-full");
    expect(badge).toHaveAttribute("title", name);
  });

  it("two categories with the same color look the same and differ by name", () => {
    render(
      <>
        <CategoryBadge name="A" color="teal-400" />
        <CategoryBadge name="B" color="teal-400" />
      </>,
    );
    expect(screen.getByText("A").className).toBe(screen.getByText("B").className);
  });
});

describe("CategorySelect with badges (COLOR-10 AC 1, 2, 8)", () => {
  it("renders every item as a badge with its color and keeps the name as option name", async () => {
    const categories = await mockRequest<Category[]>({ method: "GET", path: "/categories" });
    renderWithQuery(<CategorySelect onChange={vi.fn()} />);
    const trigger = await screen.findByRole("combobox");
    await waitFor(() => expect(trigger).toBeEnabled());
    fireEvent.click(trigger);
    const options = await screen.findAllByRole("option");
    expect(options).toHaveLength(categories.length);
    for (const category of categories) {
      const option = screen.getByRole("option", { name: category.name });
      const badge = within(option).getByText(category.name);
      expect(badge).toHaveClass(
        BADGE_CLASSES[category.color].bg,
        BADGE_CLASSES[category.color].text,
      );
    }
  });

  it("the trigger shows the badge of the selected category", async () => {
    const categories = await mockRequest<Category[]>({ method: "GET", path: "/categories" });
    const category = categories.find((item) => item.key === "Food");
    if (!category) throw new Error("seed");
    renderWithQuery(<CategorySelect value={category.id} onChange={vi.fn()} />);
    const trigger = await screen.findByRole("combobox");
    await waitFor(() => expect(trigger).toHaveTextContent(category.name));
    const badge = within(trigger).getByText(category.name);
    expect(badge).toHaveClass(BADGE_CLASSES[category.color].bg);
  });

  it("shows Carregando categorias… and stays disabled while pending", () => {
    responses.set("GET /categories", () => new Promise(() => {}));
    renderWithQuery(<CategorySelect onChange={vi.fn()} />);
    const trigger = screen.getByRole("combobox");
    expect(trigger).toBeDisabled();
    expect(trigger).toHaveTextContent("Carregando categorias…");
  });
});

describe("useCategoryLookup", () => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      {children}
    </QueryClientProvider>
  );

  it("is not ready with an empty map while loading", () => {
    responses.set("GET /categories", () => new Promise(() => {}));
    const { result } = renderHook(() => useCategoryLookup(), { wrapper });
    expect(result.current.ready).toBe(false);
    expect(result.current.byId.size).toBe(0);
  });

  it("is not ready with an empty map when the list fails", async () => {
    failures.set("GET /categories", new Error("boom"));
    const { result } = renderHook(() => ({ lookup: useCategoryLookup(), query: useCategories() }), {
      wrapper,
    });
    await waitFor(() => expect(result.current.query.isError).toBe(true));
    expect(result.current.lookup.ready).toBe(false);
    expect(result.current.lookup.byId.size).toBe(0);
  });

  it("returns a map by id once loaded", async () => {
    const categories = await mockRequest<Category[]>({ method: "GET", path: "/categories" });
    const { result } = renderHook(() => useCategoryLookup(), { wrapper });
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.byId.size).toBe(categories.length);
    const [first] = categories;
    if (!first) throw new Error("seed");
    expect(result.current.byId.get(first.id)?.name).toBe(first.name);
  });
});
