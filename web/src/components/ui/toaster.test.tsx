import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { notifyError, notifyInfo, notifySuccess } from "@/lib/notify";
import { Toaster } from "./sonner";
import { toastClassNames } from "./toast-styles";

afterEach(cleanup);

const colorClasses = (type: "success" | "error" | "info") =>
  toastClassNames[type].split(/\s+/).filter((name) => /(?:^|:)(?:bg|text|border)-/.test(name));
const toastOf = async (text: string) => {
  const item = (await screen.findByText(text)).closest("li");
  if (!item) throw new Error(`toast "${text}" not found`);
  return item;
};

describe("Toaster: um toast real de cada tipo emitido pelo notify", () => {
  it("o toast de cada tipo leva o atributo do tipo e as classes de cor do próprio tipo, e só elas", async () => {
    render(<Toaster />);
    act(() => {
      notifySuccess("Transação criada");
      notifyError(new Error("falha"), "transaction");
      notifyInfo("Dica para você");
    });
    const success = await toastOf("Transação criada");
    const error = await toastOf("Não foi possível concluir a operação. Tente novamente.");
    const info = await toastOf("Dica para você");

    expect([success, error, info].map((item) => item.getAttribute("data-type"))).toEqual([
      "success",
      "error",
      "info",
    ]);
    for (const name of colorClasses("success")) expect(success).toHaveClass(name);
    for (const name of colorClasses("error")) expect(error).toHaveClass(name);
    for (const name of colorClasses("info")) expect(info).toHaveClass(name);
    for (const name of colorClasses("error")) expect(success).not.toHaveClass(name);
    for (const name of colorClasses("success")) expect(error).not.toHaveClass(name);
    for (const name of [...colorClasses("success"), ...colorClasses("error")]) {
      expect(info).not.toHaveClass(name);
    }
  });
});
