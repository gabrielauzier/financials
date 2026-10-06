import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { Category } from "@/lib/api/types";
import { CategoryOptionLabel } from "./CategoryOptionLabel";

afterEach(cleanup);

describe("CategoryOptionLabel (IMPIMP-03)", () => {
  it("renderiza o nome da categoria", () => {
    render(<CategoryOptionLabel category={{ id: "c1", name: "Alimentação" } as Category} />);
    expect(screen.getByText("Alimentação")).toBeInTheDocument();
  });
});
