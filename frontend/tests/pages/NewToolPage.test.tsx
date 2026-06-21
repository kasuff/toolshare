import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../src/hooks/useToast";
import { ToastViewport } from "../../src/components/ui";
import { NewToolPage } from "../../src/pages/NewToolPage";
import { DEFAULT_PLACEHOLDER_IMAGE } from "@toolshare/shared";

const { createTool, validateAddress, suggestAddresses } = vi.hoisted(() => ({
  createTool: vi.fn(),
  validateAddress: vi.fn(),
  suggestAddresses: vi.fn()
}));

vi.mock("@toolshare/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@toolshare/shared")>();
  return {
    ...actual,
    api: {
      createTool,
      validateAddress,
      suggestAddresses,
      getSystemSettings: vi.fn().mockResolvedValue([])
    }
  };
});

class FileReaderMock {
  public onload: ((event: { target: { result: string } }) => void) | null = null;

  readAsDataURL() {
    this.onload?.({
      target: {
        result: "data:image/png;base64,mock-tool-image"
      }
    });
  }
}

function renderNewToolPage(token: string | null = "token-123") {
  return render(
    <ToastProvider>
      <ToastViewport />
      <MemoryRouter initialEntries={["/tools/new"]}>
        <Routes>
          <Route path="/tools/new" element={<NewToolPage token={token ?? undefined} />} />
          <Route path="/tools" element={<div>Tools Home</div>} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>
  );
}

function fillManualAddress() {
  fireEvent.click(screen.getByRole("button", { name: "Adresse manuell eingeben" }));
  fireEvent.change(screen.getByPlaceholderText("Straße"), { target: { value: "Musterstraße" } });
  fireEvent.change(screen.getByPlaceholderText("Hausnummer"), { target: { value: "5" } });
  fireEvent.change(screen.getByPlaceholderText("PLZ"), { target: { value: "80331" } });
  fireEvent.change(screen.getByPlaceholderText("Ort"), { target: { value: "München" } });
  fireEvent.change(screen.getByPlaceholderText("Land"), { target: { value: "Deutschland" } });
}

function fillRequiredFields(options: { withImage?: boolean; container?: HTMLElement } = {}) {
  fireEvent.change(screen.getByPlaceholderText("z.B. Akku-Bohrmaschine"), {
    target: { value: "Akkuschrauber" }
  });
  fireEvent.change(
    screen.getByPlaceholderText(
      "z.B.: Zustand: wie neu, selten benutzt. Lieferumfang: 1x Bohrmaschine, 2x Akkus, 1x Ladegerät. Besonderheiten: sehr leise, eingebaute LED"
    ),
    { target: { value: "Sehr gut erhalten" } }
  );
  fireEvent.change(screen.getByRole("combobox", { name: "Kategorie *" }), { target: { value: "holz" } });
  fillManualAddress();

  if (options.withImage && options.container) {
    const fileInput = options.container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, {
      target: { files: [new File(["image"], "tool.png", { type: "image/png" })] }
    });
  }
}

describe("NewToolPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("FileReader", FileReaderMock as unknown as typeof FileReader);
    validateAddress.mockResolvedValue({
      isValid: true,
      normalizedAddress: "Musterstraße 5, 80331 München, Deutschland",
      normalizedParts: null
    });
    suggestAddresses.mockResolvedValue([]);
  });

  it("shows login required without a token", () => {
    renderNewToolPage(null);
    expect(screen.getByRole("link", { name: "Einloggen" })).toHaveAttribute("href", "/auth");
  });

  it("shows field errors on blur before submit", async () => {
    renderNewToolPage();

    const nameInput = screen.getByPlaceholderText("z.B. Akku-Bohrmaschine");
    fireEvent.focus(nameInput);
    fireEvent.blur(nameInput);
    expect(await screen.findByText("Bitte gib einen Namen für das Werkzeug ein.")).toBeInTheDocument();

    const descriptionInput = screen.getByPlaceholderText(
      /Zustand: wie neu, selten benutzt/
    );
    fireEvent.blur(descriptionInput);
    expect(
      await screen.findByText("Bitte gib eine Beschreibung mit mindestens 5 Zeichen ein.")
    ).toBeInTheDocument();

    fireEvent.blur(screen.getByRole("combobox", { name: "Kategorie *" }));
    expect(await screen.findByText("Bitte wähle eine Kategorie aus.")).toBeInTheDocument();

    fillManualAddress();
    const streetInput = screen.getByPlaceholderText("Straße");
    fireEvent.change(streetInput, { target: { value: "" } });
    fireEvent.blur(streetInput);
    expect(await screen.findByText("Bitte gib einen vollständigen Abholort an.")).toBeInTheDocument();
  });

  it("creates a tool with placeholder image when no photo is uploaded", async () => {
    createTool.mockResolvedValueOnce({ id: "tool-1" });
    renderNewToolPage();

    fillRequiredFields();
    fireEvent.change(screen.getByPlaceholderText("z.B. Klingeln bei Thomas, 4. Stock, Hinterhof links"), {
      target: { value: "Bitte im Hinterhof klingeln" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Werkzeug einstellen" }));

    await waitFor(() =>
      expect(createTool).toHaveBeenCalledWith(
        {
          name: "Akkuschrauber",
          description: "Sehr gut erhalten",
          category: "holz",
          imageUrl: DEFAULT_PLACEHOLDER_IMAGE,
          pickupLocation: "Musterstraße 5, 80331 München, Deutschland",
          pickupLocationNote: "Bitte im Hinterhof klingeln"
        },
        "token-123"
      )
    );
    expect(await screen.findByText("Tools Home")).toBeInTheDocument();
    expect(await screen.findByText("Werkzeug erfolgreich eingestellt!")).toBeInTheDocument();
  });

  it("creates a tool with an uploaded image", async () => {
    createTool.mockResolvedValueOnce({ id: "tool-2" });
    const { container } = renderNewToolPage();

    fillRequiredFields({ withImage: true, container });
    fireEvent.click(screen.getByRole("button", { name: "Werkzeug einstellen" }));

    await waitFor(() =>
      expect(createTool).toHaveBeenCalledWith(
        expect.objectContaining({
          imageUrl: "data:image/png;base64,mock-tool-image"
        }),
        "token-123"
      )
    );
  });

  it("falls back to the manual address when validation returns no normalized address", async () => {
    validateAddress.mockResolvedValueOnce({
      isValid: true,
      normalizedAddress: null,
      normalizedParts: null
    });
    createTool.mockResolvedValueOnce({ id: "tool-3" });
    renderNewToolPage();

    fillRequiredFields();
    fireEvent.click(screen.getByRole("button", { name: "Werkzeug einstellen" }));

    await waitFor(() =>
      expect(createTool).toHaveBeenCalledWith(
        expect.objectContaining({
          pickupLocation: "Musterstraße 5, 80331 München, Deutschland"
        }),
        "token-123"
      )
    );
  });

  it("shows loading state while the tool is being created", async () => {
    let resolveCreate: (value: { id: string }) => void = () => {};
    createTool.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveCreate = resolve;
        })
    );
    renderNewToolPage();

    fillRequiredFields();
    fireEvent.click(screen.getByRole("button", { name: "Werkzeug einstellen" }));

    expect(await screen.findByRole("button", { name: "Wird gespeichert..." })).toBeDisabled();
    resolveCreate({ id: "tool-4" });
    await waitFor(() => expect(screen.getByText("Tools Home")).toBeInTheDocument());
  });

  it("shows API errors when tool creation fails", async () => {
    createTool.mockRejectedValueOnce(new Error("Server nicht erreichbar"));
    renderNewToolPage();

    fillRequiredFields();
    fireEvent.click(screen.getByRole("button", { name: "Werkzeug einstellen" }));

    expect(await screen.findByText("Server nicht erreichbar")).toBeInTheDocument();
  });

  it("shows a generic error when creation fails with a non-Error value", async () => {
    createTool.mockRejectedValueOnce("unexpected");
    renderNewToolPage();

    fillRequiredFields();
    fireEvent.click(screen.getByRole("button", { name: "Werkzeug einstellen" }));

    expect(await screen.findByText("Werkzeug konnte nicht angelegt werden.")).toBeInTheDocument();
  });

  it("blocks submit and shows errors when required fields are missing", async () => {
    renderNewToolPage();

    fireEvent.click(screen.getByRole("button", { name: "Werkzeug einstellen" }));

    expect(await screen.findByText("Bitte gib einen Namen für das Werkzeug ein.")).toBeInTheDocument();
    expect(screen.getByText("Bitte gib eine Beschreibung mit mindestens 5 Zeichen ein.")).toBeInTheDocument();
    expect(screen.getByText("Bitte wähle eine Kategorie aus.")).toBeInTheDocument();
    expect(screen.getByText("Bitte gib einen vollständigen Abholort an.")).toBeInTheDocument();
    expect(createTool).not.toHaveBeenCalled();
    expect(validateAddress).not.toHaveBeenCalled();
  });

  it("shows an error toast when address validation fails", async () => {
    validateAddress.mockResolvedValueOnce({
      isValid: false,
      normalizedAddress: null,
      normalizedParts: null
    });
    renderNewToolPage();

    fillRequiredFields();
    fireEvent.click(screen.getByRole("button", { name: "Werkzeug einstellen" }));

    expect(
      await screen.findByText("Adresse konnte nicht verifiziert werden. Bitte wähle eine vorgeschlagene Adresse.")
    ).toBeInTheDocument();
    expect(createTool).not.toHaveBeenCalled();
  });

  it("omits optional pickup note when left empty", async () => {
    createTool.mockResolvedValueOnce({ id: "tool-5" });
    renderNewToolPage();

    fillRequiredFields();
    fireEvent.click(screen.getByRole("button", { name: "Werkzeug einstellen" }));

    await waitFor(() =>
      expect(createTool).toHaveBeenCalledWith(
        expect.objectContaining({
          pickupLocationNote: undefined
        }),
        "token-123"
      )
    );
  });
});
