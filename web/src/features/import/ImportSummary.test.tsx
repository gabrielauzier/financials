import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import { ImportFailure, ImportSuccess } from "./ImportSummary";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

afterEach(cleanup);

describe("resumo da importação", () => {
  it("mostra as contagens de importadas e ignoradas e os atalhos", () => {
    const onImportAnother = vi.fn();
    render(
      <ImportSuccess
        result={{ batchId: "b", imported: 12, skipped: 3 }}
        onImportAnother={onImportAnother}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("12 transações importadas, 3 ignoradas");
    expect(screen.getByRole("link", { name: "Ver extrato" })).toHaveAttribute("href", "/extrato");
    fireEvent.click(screen.getByRole("button", { name: "Importar outro arquivo" }));
    expect(onImportAnother).toHaveBeenCalledTimes(1);
  });

  it("falha mostra 'Nada foi importado' com o motivo em português e permite tentar de novo", () => {
    const onRetry = vi.fn();
    render(
      <ImportFailure error={new ApiError("storage_error", "S3 exploded", 500)} onRetry={onRetry} />,
    );
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Nada foi importado. Tente novamente.");
    expect(alert).toHaveTextContent("Não foi possível concluir a importação. Tente novamente.");
    expect(alert).not.toHaveTextContent("S3 exploded");
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
