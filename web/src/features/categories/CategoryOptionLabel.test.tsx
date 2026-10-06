import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { Category } from "@/lib/api/types";
import { CategoryOptionLabel } from "./CategoryOptionLabel";

afterEach(cleanup);

describe("CategoryOptionLabel (IMPIMP-03)", () => {
  it("renderiza o nome da categoria", () => {
    render(
      <CategoryOptionLabel
        category={{ id: "c1", name: "Alimentação", color: "teal-400" } as Category}
      />,
    );
    expect(screen.getByText("Alimentação")).toBeInTheDocument();
  });

  it("renderiza o nome como badge com a cor da categoria", () => {
    render(
      <CategoryOptionLabel
        category={{ id: "c1", name: "Alimentação", color: "teal-400" } as Category}
      />,
    );
    expect(screen.getByText("Alimentação")).toHaveClass("bg-teal-400", "text-teal-800");
  });
});
