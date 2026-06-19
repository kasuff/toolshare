import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AddressInput } from "../../src/components/AddressInput";
import { ConfirmDialog } from "../../src/components/ConfirmDialog";
import { KebabMenu } from "../../src/components/KebabMenu";
import { api } from "../../src/services/api";
import { EMPTY_ADDRESS } from "../../src/utils/address";

vi.mock("../../src/services/api", async () => {
  const actual = await vi.importActual<typeof import("../../src/services/api")>("../../src/services/api");
  return {
    ...actual,
    api: {
      ...actual.api,
      suggestAddresses: vi.fn()
    }
  };
});

describe("accessible interactions", () => {
  it("selects address suggestions with arrow keys and Enter", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    vi.mocked(api.suggestAddresses).mockResolvedValue([
      {
        label: "Musterstraße 5, 80331 München",
        street: "Musterstraße",
        houseNumber: "5",
        postalCode: "80331",
        city: "München",
        country: "Deutschland"
      }
    ]);

    render(<AddressInput value={{ ...EMPTY_ADDRESS }} onChange={onChange} />);
    const input = screen.getByRole("combobox", { name: "Adresse suchen" });
    act(() => input.focus());
    fireEvent.change(input, { target: { value: "Muster" } });
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 300));
    });
    await waitFor(() => expect(screen.getByRole("option")).toBeInTheDocument());
    await act(async () => {
      await user.keyboard("{ArrowDown}{Enter}");
    });

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ street: "Musterstraße" }));
  });

  it("traps dialog focus, closes with Escape and restores focus", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const { rerender } = render(<button type="button">Dialog öffnen</button>);
    const trigger = screen.getByRole("button", { name: "Dialog öffnen" });
    trigger.focus();

    rerender(
      <>
        <button type="button">Dialog öffnen</button>
        <ConfirmDialog
          title="Eintrag löschen?"
          text="Der Eintrag wird gelöscht."
          confirmLabel="Löschen"
          onCancel={onCancel}
          onConfirm={() => undefined}
        />
      </>
    );

    expect(screen.getByRole("button", { name: "Abbrechen" })).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalledOnce();
    rerender(<button type="button">Dialog öffnen</button>);
    expect(screen.getByRole("button", { name: "Dialog öffnen" })).toHaveFocus();
  });

  it("supports arrow-key navigation in action menus", async () => {
    const user = userEvent.setup();
    const secondAction = vi.fn();
    render(
      <KebabMenu
        items={[
          { id: "first", label: "Erste Aktion", onSelect: () => undefined },
          { id: "second", label: "Zweite Aktion", onSelect: secondAction }
        ]}
      />
    );

    await act(async () => {
      await user.click(screen.getByRole("button", { name: "Weitere Aktionen" }));
    });
    expect(screen.getByRole("menuitem", { name: "Erste Aktion" })).toHaveFocus();
    await act(async () => {
      await user.keyboard("{ArrowDown}{Enter}");
    });
    expect(secondAction).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.getByRole("button", { name: "Weitere Aktionen" })).toHaveFocus());
  });
});
