import { fireEvent, render, screen } from "@testing-library/react";
import type { FormEvent } from "react";
import { describe, expect, it, vi } from "vitest";
import { DateInput } from "../../src/components/DateInput";

describe("DateInput", () => {
  it("keeps middle edits at the clicked digit instead of reformatting from the end", () => {
    const onChange = vi.fn();
    render(<DateInput aria-label="Datum" value="2026-07-15" onChange={onChange} />);

    const input = screen.getByLabelText("Datum") as HTMLInputElement;
    expect(input).toHaveValue("15.07.2026");

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "15.07.026" } });
    expect(input).toHaveValue("15.07.026");
    expect(onChange).not.toHaveBeenCalledWith("2026-07-15");

    fireEvent.change(input, { target: { value: "15.07.2027" } });
    expect(onChange).toHaveBeenLastCalledWith("2027-07-15");
  });

  it("still accepts existing iso-style test values and shows the date mask", () => {
    const onChange = vi.fn();
    render(<DateInput aria-label="Datum" value="" onChange={onChange} />);

    fireEvent.change(screen.getByLabelText("Datum"), { target: { value: "2026-07-15" } });

    expect(screen.getByLabelText("Datum")).toHaveValue("15.07.2026");
    expect(onChange).toHaveBeenLastCalledWith("2026-07-15");
  });

  it("adds separators after day and month while typing at the end", () => {
    const onChange = vi.fn();
    render(<DateInput aria-label="Datum" value="" onChange={onChange} />);

    const input = screen.getByLabelText("Datum");
    fireEvent.change(input, { target: { value: "1", selectionStart: 1 } });
    fireEvent.change(input, { target: { value: "15", selectionStart: 2 } });
    expect(input).toHaveValue("15");

    fireEvent.change(input, { target: { value: "150", selectionStart: 3 } });
    expect(input).toHaveValue("15.0");

    fireEvent.change(input, { target: { value: "15.07", selectionStart: 5 } });
    expect(input).toHaveValue("15.07");

    fireEvent.change(input, { target: { value: "15.072", selectionStart: 6 } });
    expect(input).toHaveValue("15.07.2");
  });

  it("does not submit the surrounding form when Enter is pressed", () => {
    const onSubmit = vi.fn((event: FormEvent<HTMLFormElement>) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <DateInput aria-label="Datum" value="2026-07-15" onChange={vi.fn()} />
      </form>
    );

    const input = screen.getByLabelText("Datum");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "1.1.2026" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onSubmit).not.toHaveBeenCalled();
    expect(input).toHaveValue("01.01.2026");
  });

  it("accepts single-digit day and month segments and pads them in the stored value", () => {
    const onChange = vi.fn();
    render(<DateInput aria-label="Datum" value="2026-12-12" onChange={onChange} />);

    const input = screen.getByLabelText("Datum");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "1.1.2026" } });

    expect(input).toHaveValue("1.1.2026");
    expect(onChange).toHaveBeenLastCalledWith("2026-01-01");

    fireEvent.blur(input);
    expect(input).toHaveValue("01.01.2026");
  });

  it("opens a native date picker from the visible calendar button", () => {
    const onChange = vi.fn();
    const { container } = render(<DateInput aria-label="Datum" value="2026-07-15" onChange={onChange} />);

    const picker = container.querySelector(".date-input-picker-native") as HTMLInputElement;
    const showPicker = vi.fn();
    picker.showPicker = showPicker;

    expect(picker).toHaveAttribute("type", "date");
    fireEvent.click(screen.getByRole("button", { name: "Kalender öffnen" }));
    expect(showPicker).toHaveBeenCalledTimes(1);

    fireEvent.change(picker, { target: { value: "2026-08-03" } });
    expect(onChange).toHaveBeenLastCalledWith("2026-08-03");
  });
});
