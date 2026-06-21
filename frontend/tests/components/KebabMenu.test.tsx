import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { KebabMenu } from "../../src/components/KebabMenu";

describe("KebabMenu", () => {
  it("opens, runs an action and closes on outside click", () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();

    render(
      <KebabMenu
        items={[
          { id: "edit", label: "Bearbeiten", onSelect: onEdit },
          { id: "delete", label: "Löschen", onSelect: onDelete, disabled: true }
        ]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Weitere Aktionen" }));
    expect(screen.getByRole("menu")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("menuitem", { name: "Bearbeiten" }));
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Weitere Aktionen" }));
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("closes on Escape", () => {
    render(
      <KebabMenu
        items={[{ id: "edit", label: "Bearbeiten", onSelect: vi.fn() }]}
        ariaLabel="Thread-Aktionen"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Thread-Aktionen" }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});
