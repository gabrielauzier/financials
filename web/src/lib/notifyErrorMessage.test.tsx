import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Toaster } from "@/components/ui/sonner";
import { toastClassNames } from "@/components/ui/toast-styles";
import { notifyErrorMessage } from "./notify";

afterEach(cleanup);

describe("notifyErrorMessage (Toaster real)", () => {
  it("mostra um toast de erro com exatamente o texto dado e as classes de cor do erro", async () => {
    render(<Toaster />);
    const text = "Não foi possível acessar o armazenamento do navegador.";
    act(() => notifyErrorMessage(text));
    const item = (await screen.findByText(text)).closest("li");
    expect(item).not.toBeNull();
    expect(item?.getAttribute("data-type")).toBe("error");
    const colors = toastClassNames.error
      .split(/\s+/)
      .filter((name) => /(?:^|:)(?:bg|text|border)-/.test(name));
    expect(colors.length).toBeGreaterThan(0);
    for (const name of colors) expect(item).toHaveClass(name);
  });
});
