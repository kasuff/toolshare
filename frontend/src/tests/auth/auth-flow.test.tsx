import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../../App";
import { ToastProvider } from "../../hooks/useToast";
import {  api  } from "@toolshare/shared";

const mockUseSession = vi.fn();

vi.mock("../../hooks/useSession", () => ({
  useSession: () => mockUseSession()
}));

vi.mock("@toolshare/shared", async () => {
  const actual = await vi.importActual<typeof import("@toolshare/shared")>("@toolshare/shared");
  return {
    ...actual,
    api: {
      ...actual.api,
      suggestAddresses: vi.fn(),
      validateAddress: vi.fn()
    }
  };
});

function renderApp(initialEntry: string, state?: unknown) {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={[{ pathname: initialEntry, state }]}>
        <App />
      </MemoryRouter>
    </ToastProvider>
  );
}

describe("Authentication user journey", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSession.mockReturnValue({
      token: null,
      users: [],
      currentUser: null,
      isLoading: false,
      error: null,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      updateProfile: vi.fn()
    });
    vi.mocked(api.suggestAddresses).mockResolvedValue([]);
    vi.mocked(api.validateAddress).mockResolvedValue({
      isValid: true,
      normalizedAddress: null,
      normalizedParts: null
    });
  });

  it("redirects guest from protected route to auth with hint", async () => {
    renderApp("/tools/new");

    expect(await screen.findByRole("heading", { name: "Willkommen zurück" })).toBeInTheDocument();
    expect(screen.getByText("Bitte melde dich an, um diese Funktion zu nutzen.")).toBeInTheDocument();
  });

  it("autofills address fields when suggestions exist", async () => {
    vi.mocked(api.suggestAddresses).mockResolvedValue([
      {
        label: "Musterstrasse 10, 80802 Muenchen, Deutschland",
        street: "Musterstrasse",
        houseNumber: "10",
        postalCode: "80802",
        city: "Muenchen",
        country: "Deutschland"
      }
    ]);

    renderApp("/auth");

    fireEvent.click(screen.getByRole("button", { name: /Neu bei Toolshare/i }));
    fireEvent.focus(screen.getByPlaceholderText("Adresse suchen"));
    fireEvent.change(screen.getByPlaceholderText("Adresse suchen"), {
      target: { value: "Muster" }
    });

    await screen.findByText("Vorschläge - klicken zum Übernehmen");

    fireEvent.mouseDown(await screen.findByRole("option", { name: /Musterstrasse 10/i }));

    expect(screen.queryByPlaceholderText("Straße")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Adresse manuell eingeben" }));
    expect(await screen.findByDisplayValue("Musterstrasse")).toBeInTheDocument();
    expect(screen.getByDisplayValue("10")).toBeInTheDocument();
    expect(screen.getByDisplayValue("80802")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Muenchen")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Automatische Adresssuche verwenden" }));
    expect(screen.getByDisplayValue("Musterstrasse 10, 80802 Muenchen, Deutschland")).toBeInTheDocument();
  });

  it("shows no-suggestion state and keeps manual fields unchanged", async () => {
    vi.mocked(api.suggestAddresses).mockResolvedValue([]);

    renderApp("/auth");
    fireEvent.click(screen.getByRole("button", { name: /Neu bei Toolshare/i }));
    fireEvent.focus(screen.getByPlaceholderText("Adresse suchen"));
    fireEvent.change(screen.getByPlaceholderText("Adresse suchen"), {
      target: { value: "zzz" }
    });

    expect(await screen.findByText("Keine Vorschläge gefunden.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Adresse manuell eingeben" }));
    expect(screen.getByPlaceholderText("Straße")).toHaveValue("");
    expect(screen.getByPlaceholderText("Hausnr.")).toHaveValue("");
  });
});
