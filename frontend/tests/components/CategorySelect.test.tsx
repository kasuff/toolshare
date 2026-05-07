import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CategorySelect } from "../../src/components/CategorySelect";

describe("CategorySelect", () => {
  it("renders available categories and forwards selections", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    render(<CategorySelect value="" onChange={onChange} label="Kategorie" hint="Bitte wählen" />);

    expect(screen.getByText("Kategorie")).toBeInTheDocument();
    expect(screen.getByText("Bitte wählen")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Elektrowerkzeuge/i })).toBeInTheDocument();

    await user.selectOptions(screen.getByRole("combobox"), "garten");
    expect(onChange).toHaveBeenCalledWith("garten");
  });
});
