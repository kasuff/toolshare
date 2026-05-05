import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../../App";
import { ToastProvider } from "../../hooks/useToast";
import { api } from "../../services/api";

const mockUseSession = vi.fn();

vi.mock("../../hooks/useSession", () => ({
  useSession: () => mockUseSession()
}));

vi.mock("../../services/api", async () => {
  const actual = await vi.importActual<typeof import("../../services/api")>("../../services/api");
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

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Neu bei Toolshare? Jetzt registrieren" }));
    await user.type(screen.getByPlaceholderText("Adresse suchen (optional für Autofill)"), "Muster");

    await user.click(await screen.findByRole("button", { name: /Musterstrasse 10/i }));

    expect(screen.getByDisplayValue("Musterstrasse")).toBeInTheDocument();
    expect(screen.getByDisplayValue("10")).toBeInTheDocument();
    expect(screen.getByDisplayValue("80802")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Muenchen")).toBeInTheDocument();
    expect(screen.getByText("Musterstrasse 10, 80802 Muenchen, Deutschland", { selector: "p.address-preview" })).toBeInTheDocument();
  });

  it("shows no-suggestion state and keeps manual fields unchanged", async () => {
    vi.mocked(api.suggestAddresses).mockResolvedValue([]);

    renderApp("/auth");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Neu bei Toolshare? Jetzt registrieren" }));
    await user.type(screen.getByPlaceholderText("Adresse suchen (optional für Autofill)"), "zzz");

    expect(await screen.findByText("Keine Vorschläge gefunden.")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Straße")).toHaveValue("");
    expect(screen.getByPlaceholderText("Hausnummer")).toHaveValue("");
  });
});
