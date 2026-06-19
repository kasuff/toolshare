import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../src/hooks/useToast";
import { ProfileSettingsPage } from "../../src/pages/ProfileSettingsPage";

const { validateAddress, suggestAddresses, changePassword } = vi.hoisted(() => ({
  validateAddress: vi.fn(),
  suggestAddresses: vi.fn(),
  changePassword: vi.fn()
}));

vi.mock("@toolshare/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@toolshare/shared")>();
  return {
    ...actual,
    api: {
      ...actual.api,
      validateAddress,
    suggestAddresses,
    changePassword
    }
  };
});

describe("ProfileSettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the guest state", () => {
    render(
      <ToastProvider>
        <MemoryRouter>
          <ProfileSettingsPage onSave={vi.fn()} />
        </MemoryRouter>
      </ToastProvider>
    );

    expect(screen.getByRole("link", { name: "Einloggen" })).toHaveAttribute("href", "/auth");
  });

  it("shows suggestions, validates input and saves the profile", async () => {
    validateAddress.mockResolvedValue({
      isValid: true,
      normalizedAddress: null,
      normalizedParts: null
    });
    suggestAddresses.mockResolvedValue([
      {
        label: "Musterstraße 5, 80331 München, Deutschland",
        street: "Musterstraße",
        houseNumber: "5",
        postalCode: "80331",
        city: "München",
        country: "Deutschland"
      }
    ]);

    const onSave = vi.fn().mockResolvedValue({
      id: "u1",
      name: "Lea Neu",
      email: "lea@example.com",
      role: "NUTZER",
      isSuspended: false
    });

    render(
      <ToastProvider>
        <MemoryRouter>
          <ProfileSettingsPage
            currentUser={{
              id: "u1",
              name: "Lea",
              email: "lea@example.com",
              role: "NUTZER",
              isSuspended: false,
              address: "Musterstraße 1, 80331 München, Deutschland"
            }}
            onSave={onSave}
          />
        </MemoryRouter>
      </ToastProvider>
    );

    expect(screen.getByRole("heading", { name: "Einstellungen" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Kontodaten" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "lea@example.com" })).toHaveAttribute("href", "mailto:lea@example.com");
    expect(screen.getByRole("button", { name: "Passwort ändern" })).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Adresse suchen"), {
      target: { value: "Muster" }
    });
    fireEvent.focus(screen.getByPlaceholderText("Adresse suchen"));

    expect(await screen.findByRole("listbox", { name: "Adressvorschläge" })).toBeInTheDocument();
    await waitFor(() => expect(suggestAddresses).toHaveBeenCalled());
    fireEvent.mouseDown(screen.getByRole("button", { name: /Musterstraße 5, 80331 München, Deutschland/i }));

    fireEvent.change(screen.getByPlaceholderText("Dein Name"), { target: { value: "Lea Neu" } });
    fireEvent.click(screen.getByRole("button", { name: "Änderungen speichern" }));

    await waitFor(() => {
      expect(validateAddress).toHaveBeenCalled();
      expect(onSave).toHaveBeenCalledWith({
        name: "Lea Neu",
        address: "Musterstraße 5, 80331 München, Deutschland"
      });
    });
  });

  it("blocks invalid name and incomplete address data", async () => {
    const onSave = vi.fn();

    render(
      <ToastProvider>
        <MemoryRouter>
          <ProfileSettingsPage
            currentUser={{
              id: "u1",
              name: "Lea",
              email: "lea@example.com",
              role: "NUTZER",
              isSuspended: false
            }}
            onSave={onSave}
          />
        </MemoryRouter>
      </ToastProvider>
    );

    fireEvent.change(screen.getByPlaceholderText("Dein Name"), { target: { value: "A" } });
    fireEvent.click(screen.getByRole("button", { name: "Änderungen speichern" }));

    await waitFor(() => expect(onSave).not.toHaveBeenCalled());
    expect(validateAddress).not.toHaveBeenCalled();
  });

  const renderWithUser = () =>
    render(
      <ToastProvider>
        <MemoryRouter>
          <ProfileSettingsPage
            currentUser={{
              id: "u1",
              name: "Lea",
              email: "lea@example.com",
              role: "NUTZER",
              isSuspended: false
            }}
            token="tok-123"
            onSave={vi.fn()}
          />
        </MemoryRouter>
      </ToastProvider>
    );

  it("does not submit when the two new passwords do not match", async () => {
    renderWithUser();

    fireEvent.click(screen.getByRole("button", { name: "Passwort ändern" }));
    fireEvent.change(screen.getByPlaceholderText("Aktuelles Passwort"), { target: { value: "Current123" } });
    fireEvent.change(screen.getByPlaceholderText("Mindestens 8 Zeichen"), { target: { value: "NewPass1234" } });
    fireEvent.change(screen.getByPlaceholderText("Neues Passwort erneut eingeben"), {
      target: { value: "Different999" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Passwort ändern" }));

    await waitFor(() => expect(changePassword).not.toHaveBeenCalled());
  });

  it("changes the password and closes the form on success", async () => {
    changePassword.mockResolvedValue(undefined);
    renderWithUser();

    fireEvent.click(screen.getByRole("button", { name: "Passwort ändern" }));
    fireEvent.change(screen.getByPlaceholderText("Aktuelles Passwort"), { target: { value: "Current123" } });
    fireEvent.change(screen.getByPlaceholderText("Mindestens 8 Zeichen"), { target: { value: "NewPass1234" } });
    fireEvent.change(screen.getByPlaceholderText("Neues Passwort erneut eingeben"), {
      target: { value: "NewPass1234" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Passwort ändern" }));

    await waitFor(() =>
      expect(changePassword).toHaveBeenCalledWith("Current123", "NewPass1234", "tok-123")
    );
    // Formular schließt → Passwortfelder verschwinden wieder.
    await waitFor(() =>
      expect(screen.queryByPlaceholderText("Aktuelles Passwort")).not.toBeInTheDocument()
    );
  });
});
