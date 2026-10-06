import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ColorPicker } from "./ColorPicker";
import { COLOR_KEYS, colorLabel } from "./palette";

afterEach(cleanup);

function setup(value = "blue-600", extra: { disabled?: boolean } = {}) {
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

describe("ColorPicker (COLOR-07)", () => {
  it("opens a radiogroup 'Paleta de cores' with 66 uniquely named Portuguese radios (AC 1)", async () => {
    const { trigger } = setup();
    const { radios } = await openPicker(trigger);
    expect(radios).toHaveLength(66);
    const names = radios.map((radio) => nameOf(radio));
    expect(new Set(names).size).toBe(66);
    expect(names).toEqual(COLOR_KEYS.map(colorLabel));
    expect(names).toContain("Azul 600");
    expect(names).toContain("Verde-azulado 400");
    expect(screen.getByRole("radio", { name: "Azul 600" })).toBeInTheDocument();
  });

  it("marks only the selected radio and shows swatch name on the trigger (AC 2)", async () => {
    const { trigger } = setup("blue-600");
    expect(trigger).toHaveTextContent("Azul 600");
    const { radios } = await openPicker(trigger);
    const checked = radios.filter((radio) => radio.getAttribute("aria-checked") === "true");
    expect(checked.map(nameOf)).toEqual(["Azul 600"]);
    expect(checked[0]?.querySelector("svg")).not.toBeNull();
    expect(radios.filter((radio) => radio.querySelector("svg"))).toHaveLength(1);
  });

  it("a click calls onChange once with the exact key, closes and returns focus to the trigger (AC 3)", async () => {
    const { trigger, onChange } = setup("blue-600");
    await openPicker(trigger);
    fireEvent.click(screen.getByRole("radio", { name: "Rosê 900" }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("rose-900");
    await waitFor(() => expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("arrows move 1 sideways and 6 vertically without leaving the grid (AC 4)", async () => {
    const { trigger } = setup("red-400");
    const { radios } = await openPicker(trigger);
    await waitFor(() => expect(focused()).toBe(radios[0]));
    fireEvent.keyDown(focused(), { key: "ArrowLeft" });
    expect(focused()).toBe(radios[0]);
    fireEvent.keyDown(focused(), { key: "ArrowUp" });
    expect(focused()).toBe(radios[0]);
    fireEvent.keyDown(focused(), { key: "ArrowRight" });
    expect(focused()).toBe(radios[1]);
    fireEvent.keyDown(focused(), { key: "ArrowDown" });
    expect(focused()).toBe(radios[7]);
    fireEvent.keyDown(focused(), { key: "ArrowUp" });
    expect(focused()).toBe(radios[1]);
    fireEvent.keyDown(focused(), { key: "ArrowLeft" });
    expect(focused()).toBe(radios[0]);
  });

  it("does not leave the grid at the last cell or move down past the last row (AC 4)", async () => {
    const { trigger } = setup("stone-900");
    const { radios } = await openPicker(trigger);
    await waitFor(() => expect(focused()).toBe(radios[65]));
    fireEvent.keyDown(focused(), { key: "ArrowRight" });
    expect(focused()).toBe(radios[65]);
    fireEvent.keyDown(focused(), { key: "ArrowDown" });
    expect(focused()).toBe(radios[65]);
    fireEvent.keyDown(focused(), { key: "ArrowUp" });
    expect(focused()).toBe(radios[59]);
    fireEvent.keyDown(focused(), { key: "ArrowDown" });
    expect(focused()).toBe(radios[65]);
  });

  it("navigates by arrows to Azul 600 and Enter chooses it (AC 5)", async () => {
    const { trigger, onChange } = setup("red-400");
    const { radios } = await openPicker(trigger);
    await waitFor(() => expect(focused()).toBe(radios[0]));
    const target = COLOR_KEYS.indexOf("blue-600"); // 31 = 5 rows down and 1 right
    for (let i = 0; i < Math.floor(target / 6); i += 1) {
      fireEvent.keyDown(focused(), { key: "ArrowDown" });
    }
    for (let i = 0; i < target % 6; i += 1) fireEvent.keyDown(focused(), { key: "ArrowRight" });
    expect(focused()).toHaveAccessibleName("Azul 600");
    fireEvent.keyDown(focused(), { key: "Enter" });
    expect(onChange).toHaveBeenCalledExactlyOnceWith("blue-600");
  });

  it("Home and End go to the first and last, Space chooses the focused one (AC 5)", async () => {
    const { trigger, onChange } = setup("blue-600");
    const { radios } = await openPicker(trigger);
    fireEvent.keyDown(focused(), { key: "End" });
    expect(focused()).toBe(radios[65]);
    fireEvent.keyDown(focused(), { key: "Home" });
    expect(focused()).toBe(radios[0]);
    fireEvent.keyDown(focused(), { key: " " });
    expect(onChange).toHaveBeenCalledExactlyOnceWith("red-400");
  });

  it("Escape closes without calling onChange (AC 6)", async () => {
    const { trigger, onChange } = setup();
    await openPicker(trigger);
    fireEvent.keyDown(focused(), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument());
    expect(onChange).not.toHaveBeenCalled();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("a disabled picker does not open (AC 7)", () => {
    const { trigger } = setup("blue-600", { disabled: true });
    expect(trigger).toBeDisabled();
    fireEvent.click(trigger);
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
  });

  it("an unknown value shows Ardósia 600 and checks no radio (AC 8)", async () => {
    const { trigger } = setup("banana");
    expect(trigger).toHaveTextContent("Ardósia 600");
    const { radios } = await openPicker(trigger);
    expect(radios.filter((radio) => radio.getAttribute("aria-checked") === "true")).toHaveLength(0);
    expect(radios.filter((radio) => radio.getAttribute("aria-checked") === "false")).toHaveLength(
      66,
    );
  });

  it("has exactly one tabIndex=0 (the selected, or the first) and the id on the trigger (AC 9)", async () => {
    const { trigger } = setup("blue-600");
    expect(trigger.id).toBe("cor-teste");
    const { radios } = await openPicker(trigger);
    const tabbable = radios.filter((radio) => radio.tabIndex === 0);
    expect(tabbable.map(nameOf)).toEqual(["Azul 600"]);
    cleanup();
    const { trigger: other } = setup("banana");
    const { radios: others } = await openPicker(other);
    expect(others.filter((radio) => radio.tabIndex === 0)).toEqual([others[0]]);
  });
});
