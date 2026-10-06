import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ColorPicker } from "./ColorPicker";
import { COLOR_KEYS, colorLabel } from "./palette";

afterEach(cleanup);

function setup(value = "blue-400", extra: { disabled?: boolean } = {}) {
  const onChange = vi.fn();
  render(
    <>
      <label htmlFor="cor-teste">Cor</label>
      <ColorPicker id="cor-teste" value={value} onChange={onChange} {...extra} />
    </>,
  );
  return { onChange, trigger: screen.getByLabelText("Cor") };
}

async function openPicker(trigger: HTMLElement) {
  fireEvent.click(trigger);
  const group = await screen.findByRole("radiogroup", { name: "Paleta de cores" });
  return { group, radios: within(group).getAllByRole("radio") };
}

const focused = () => document.activeElement as HTMLElement;
const nameOf = (el: Element) => el.getAttribute("aria-label");
const press = (key: string) => fireEvent.keyDown(focused(), { key });
const indexOfKey = (key: string) => COLOR_KEYS.indexOf(key as (typeof COLOR_KEYS)[number]);

// The grid has 6 columns: rows 0-5, 6-11, 12-17 and 18-21 (the last row has 4 cells).
describe("ColorPicker (COLOR-07)", () => {
  it("opens a radiogroup 'Paleta de cores' with 22 uniquely named Portuguese radios (AC 1)", async () => {
    const { trigger } = setup();
    const { radios } = await openPicker(trigger);
    expect(radios).toHaveLength(22);
    const names = radios.map((radio) => nameOf(radio));
    expect(new Set(names).size).toBe(22);
    expect(names).toEqual(COLOR_KEYS.map(colorLabel));
    expect(names).toContain("Azul");
    expect(names).toContain("Verde-azulado");
    expect(screen.getByRole("radio", { name: "Azul" })).toBeInTheDocument();
  });

  it("marks only the selected radio and shows swatch name on the trigger (AC 2)", async () => {
    const { trigger } = setup("blue-400");
    expect(trigger).toHaveTextContent("Azul");
    const { radios } = await openPicker(trigger);
    const checked = radios.filter((radio) => radio.getAttribute("aria-checked") === "true");
    expect(checked.map(nameOf)).toEqual(["Azul"]);
    expect(checked[0]?.querySelector("svg")).not.toBeNull();
    expect(radios.filter((radio) => radio.querySelector("svg"))).toHaveLength(1);
  });

  it("a click calls onChange once with the exact key, closes and returns focus to the trigger (AC 3)", async () => {
    const { trigger, onChange } = setup("blue-400");
    await openPicker(trigger);
    fireEvent.click(screen.getByRole("radio", { name: "Rosê" }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("rose-400");
    await waitFor(() => expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("arrows move 1 sideways and 6 vertically without leaving the grid (AC 4)", async () => {
    const { trigger } = setup("red-400");
    const { radios } = await openPicker(trigger);
    await waitFor(() => expect(focused()).toBe(radios[0]));
    press("ArrowLeft");
    expect(focused()).toBe(radios[0]);
    press("ArrowUp");
    expect(focused()).toBe(radios[0]);
    press("ArrowRight");
    expect(focused()).toBe(radios[1]);
    press("ArrowDown");
    expect(focused()).toBe(radios[7]);
    press("ArrowUp");
    expect(focused()).toBe(radios[1]);
    press("ArrowLeft");
    expect(focused()).toBe(radios[0]);
  });

  it("clamps at the edges: the focus stays when the target would be outside the grid (AC 4)", async () => {
    const { trigger } = setup("stone-400");
    const { radios } = await openPicker(trigger);
    await waitFor(() => expect(focused()).toBe(radios[21]));
    press("ArrowRight");
    expect(focused()).toBe(radios[21]);
    press("ArrowDown");
    expect(focused()).toBe(radios[21]);
    press("ArrowUp");
    expect(focused()).toBe(radios[15]);
    press("ArrowDown");
    expect(focused()).toBe(radios[21]);
  });

  it("Down on a non-last cell with no cell below, and Up on a top-row cell, stay where they are (AC 4)", async () => {
    // index 16 (Rosê) sits above the 2 missing cells of the last row: 16 + 6 = 22 does not exist.
    const rose = indexOfKey("rose-400");
    expect(rose).toBe(16);
    const { trigger } = setup("rose-400");
    const { radios } = await openPicker(trigger);
    await waitFor(() => expect(focused()).toBe(radios[16]));
    press("ArrowDown");
    expect(focused()).toBe(radios[16]);
    press("ArrowUp");
    expect(focused()).toBe(radios[10]);
    cleanup();
    const top = setup("lime-400");
    const { radios: topRadios } = await openPicker(top.trigger);
    await waitFor(() => expect(focused()).toBe(topRadios[4]));
    press("ArrowUp");
    expect(focused()).toBe(topRadios[4]);
    press("ArrowDown");
    expect(focused()).toBe(topRadios[10]);
  });

  it("navigates by arrows to Azul and Enter chooses it (AC 5)", async () => {
    const { trigger, onChange } = setup("red-400");
    const { radios } = await openPicker(trigger);
    await waitFor(() => expect(focused()).toBe(radios[0]));
    const target = indexOfKey("blue-400"); // 10 = 1 row down and 4 right
    for (let i = 0; i < Math.floor(target / 6); i += 1) press("ArrowDown");
    for (let i = 0; i < target % 6; i += 1) press("ArrowRight");
    expect(focused()).toHaveAccessibleName("Azul");
    press("Enter");
    expect(onChange).toHaveBeenCalledExactlyOnceWith("blue-400");
  });

  it("Home and End go to the first and last, Space chooses the focused one (AC 5)", async () => {
    const { trigger, onChange } = setup("blue-400");
    const { radios } = await openPicker(trigger);
    press("End");
    expect(focused()).toBe(radios[21]);
    press("Home");
    expect(focused()).toBe(radios[0]);
    press(" ");
    expect(onChange).toHaveBeenCalledExactlyOnceWith("red-400");
  });

  it("Escape closes without calling onChange (AC 6)", async () => {
    const { trigger, onChange } = setup();
    await openPicker(trigger);
    press("Escape");
    await waitFor(() => expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument());
    expect(onChange).not.toHaveBeenCalled();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("a disabled picker does not open (AC 7)", () => {
    const { trigger } = setup("blue-400", { disabled: true });
    expect(trigger).toBeDisabled();
    fireEvent.click(trigger);
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
  });

  it("an unknown value (even a former 600 key) shows Ardósia and checks no radio (AC 8)", async () => {
    for (const value of ["banana", "blue-600"]) {
      const { trigger } = setup(value);
      expect(trigger).toHaveTextContent("Ardósia");
      const { radios } = await openPicker(trigger);
      expect(radios.filter((radio) => radio.getAttribute("aria-checked") === "true")).toHaveLength(
        0,
      );
      expect(radios.filter((radio) => radio.getAttribute("aria-checked") === "false")).toHaveLength(
        22,
      );
      cleanup();
    }
  });

  it("has exactly one tabIndex=0 (the selected, or the first) and the id on the trigger (AC 9)", async () => {
    const { trigger } = setup("blue-400");
    expect(trigger.id).toBe("cor-teste");
    const { radios } = await openPicker(trigger);
    expect(radios.filter((radio) => radio.tabIndex === 0).map(nameOf)).toEqual(["Azul"]);
    cleanup();
    const { trigger: other } = setup("banana");
    const { radios: others } = await openPicker(other);
    expect(others.filter((radio) => radio.tabIndex === 0)).toEqual([others[0]]);
  });

  it("after moving, closing and reopening, the only tabIndex=0 is the selected radio again (AC 9)", async () => {
    const { trigger } = setup("blue-400");
    const first = await openPicker(trigger);
    await waitFor(() => expect(focused()).toBe(first.radios[10]));
    press("ArrowRight");
    expect(first.radios.filter((radio) => radio.tabIndex === 0).map(nameOf)).toEqual(["Índigo"]);
    press("Escape");
    await waitFor(() => expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument());
    const second = await openPicker(trigger);
    expect(second.radios.filter((radio) => radio.tabIndex === 0).map(nameOf)).toEqual(["Azul"]);
  });

  it("after choosing another color and reopening with the new value, the only tabIndex=0 is the new one (AC 9)", async () => {
    const onChange = vi.fn();
    const ui = (value: string) => (
      <>
        <label htmlFor="cor-teste">Cor</label>
        <ColorPicker id="cor-teste" value={value} onChange={onChange} />
      </>
    );
    const { rerender } = render(ui("blue-400"));
    const trigger = screen.getByLabelText("Cor");
    await openPicker(trigger);
    fireEvent.click(screen.getByRole("radio", { name: "Rosê" }));
    await waitFor(() => expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument());
    rerender(ui("rose-400"));
    const { radios } = await openPicker(trigger);
    expect(radios.filter((radio) => radio.tabIndex === 0).map(nameOf)).toEqual(["Rosê"]);
    expect(
      radios.filter((radio) => radio.getAttribute("aria-checked") === "true").map(nameOf),
    ).toEqual(["Rosê"]);
  });
});
