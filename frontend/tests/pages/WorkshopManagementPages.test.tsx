import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../src/hooks/useToast";
import { ToastViewport } from "../../src/components/ui";
import { NewWorkshopPage } from "../../src/pages/NewWorkshopPage";
import { EditWorkshopPage } from "../../src/pages/EditWorkshopPage";
import type { User } from "../../src/types/domain";

const {
  createWorkshop,
  getWorkshopById,
  updateWorkshop,
  createWorkshopTimeslot,
  updateWorkshopTimeslot,
  deleteWorkshopTimeslot,
  validateAddress,
  suggestAddresses
} = vi.hoisted(() => ({
  createWorkshop: vi.fn(),
  getWorkshopById: vi.fn(),
  updateWorkshop: vi.fn(),
  createWorkshopTimeslot: vi.fn(),
  updateWorkshopTimeslot: vi.fn(),
  deleteWorkshopTimeslot: vi.fn(),
  validateAddress: vi.fn(),
  suggestAddresses: vi.fn()
}));

vi.mock("../../src/services/api", () => ({
  api: {
    createWorkshop,
    getWorkshopById,
    updateWorkshop,
    createWorkshopTimeslot,
    updateWorkshopTimeslot,
    deleteWorkshopTimeslot,
    validateAddress,
    suggestAddresses,
    getSystemSettings: vi.fn().mockResolvedValue([])
  }
}));

class FileReaderMock {
  public onload: ((event: { target: { result: string } }) => void) | null = null;

  readAsDataURL() {
    this.onload?.({
      target: {
        result: "data:image/png;base64,mock-photo"
      }
    });
  }
}

const currentUser: User = {
  id: "owner-1",
  name: "Lea",
  email: "lea@example.com",
  role: "NUTZER",
  isSuspended: false
};

describe("Workshop management pages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("FileReader", FileReaderMock as unknown as typeof FileReader);
  });

  it("creates workshop with extras, workshop tools and slot payload", async () => {
    createWorkshop.mockResolvedValueOnce({ id: "workshop-1" });
    validateAddress.mockResolvedValueOnce({
      isValid: true,
      normalizedAddress: "Musterstraße 5, 80331 München, Deutschland",
      normalizedParts: null
    });

    const { container } = render(
      <ToastProvider>
        <MemoryRouter>
          <NewWorkshopPage token="token-123" currentUser={currentUser} />
        </MemoryRouter>
      </ToastProvider>
    );

    fireEvent.change(screen.getByPlaceholderText("z.B. Garagen-Werkstatt"), {
      target: { value: "Makerspace Nord" }
    });
    fireEvent.change(screen.getByPlaceholderText(/helle Werkstatt/i), {
      target: { value: "Eine gut ausgestattete Werkstatt im Norden." }
    });
    fireEvent.click(screen.getByRole("button", { name: "Adresse manuell eingeben" }));
    fireEvent.change(screen.getByPlaceholderText("Straße"), { target: { value: "Musterstraße" } });
    fireEvent.change(screen.getByPlaceholderText("Hausnummer"), { target: { value: "5" } });
    fireEvent.change(screen.getByPlaceholderText("PLZ"), { target: { value: "80331" } });
    fireEvent.change(screen.getByPlaceholderText("Ort"), { target: { value: "München" } });

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "holz" } });
    fireEvent.change(screen.getByPlaceholderText("Werkzeugname (z.B. Bosch Akkuschrauber)"), {
      target: { value: "Tischkreissaege" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Werkzeug hinzufügen" }));

    fireEvent.click(screen.getByRole("checkbox", { name: /WLAN/i }));

    const fileInput = container.querySelector("input[type=\"file\"]") as HTMLInputElement;
    fireEvent.change(fileInput, {
      target: {
        files: [new File(["dummy"], "werkstatt.png", { type: "image/png" })]
      }
    });
    await screen.findByText("1 von 3 Fotos");

    fireEvent.change(screen.getByLabelText("Startdatum"), { target: { value: "2026-07-01" } });
    fireEvent.change(screen.getByLabelText("Startzeit"), { target: { value: "09:00" } });
    fireEvent.change(screen.getByLabelText("Enddatum"), { target: { value: "2026-07-01" } });
    fireEvent.change(screen.getByLabelText("Endzeit"), { target: { value: "12:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Zeitraum blockieren" }));
    fireEvent.click(screen.getByRole("button", { name: "Werkstatt einstellen" }));

    await waitFor(() => expect(createWorkshop).toHaveBeenCalledTimes(1));

    const [payload, token] = createWorkshop.mock.calls[0] as [Record<string, unknown>, string];
    expect(token).toBe("token-123");
    expect(payload).toMatchObject({
      name: "Makerspace Nord",
      description: "Eine gut ausgestattete Werkstatt im Norden.",
      location: "Musterstraße 5, 80331 München, Deutschland",
      maxCapacity: 2,
      extras: ["wlan"],
      equipmentItems: [{ name: "Tischkreissaege", category: "holz" }],
      slots: [{ startIso: "2026-07-01T09:00", endIso: "2026-07-01T12:00", blockedByOwner: true }]
    });
    expect((payload.imageUrls as string[])[0]).toContain("data:image/png;base64,mock-photo");
  });

  it("loads and updates existing workshop details", async () => {
    getWorkshopById.mockResolvedValueOnce({
      workshop: {
        id: "workshop-1",
        ownerId: "owner-1",
        name: "Alte Werkstatt",
        description: "Werkstatt",
        location: "Musterstraße 5, 80331 München, Deutschland",
        maxCapacity: 5,
        extras: ["starkstrom"],
        equipmentItems: [{ id: "tool-1", name: "Akkuschrauber", category: "elektro" }],
        imageUrls: ["data:image/png;base64,existing"],
        toolIds: []
      },
      slots: [
        {
          id: "slot-1",
          workshopId: "workshop-1",
          startIso: "2026-07-01T09:00:00.000Z",
          endIso: "2026-07-01T12:00:00.000Z",
          blockedByOwner: false
        }
      ]
    });
    updateWorkshop.mockResolvedValueOnce({
      id: "workshop-1"
    });
    validateAddress.mockResolvedValue({
      isValid: true,
      normalizedAddress: "Musterstraße 5, 80331 München, Deutschland",
      normalizedParts: null
    });

    render(
      <ToastProvider>
        <ToastViewport />
        <MemoryRouter initialEntries={["/workshops/workshop-1/edit"]}>
          <Routes>
            <Route
              path="/workshops/:id/edit"
              element={<EditWorkshopPage token="token-456" currentUser={currentUser} />}
            />
            <Route path="/workshops" element={<div>Workshops Home</div>} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    );

    expect(await screen.findByDisplayValue("Alte Werkstatt")).toBeInTheDocument();
    fireEvent.change(screen.getByDisplayValue("Alte Werkstatt"), {
      target: { value: "Neue Werkstatt" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Änderungen speichern" }));

    await waitFor(() => expect(updateWorkshop).toHaveBeenCalledTimes(1));
    expect(validateAddress).toHaveBeenCalledTimes(1);
    expect(updateWorkshop).toHaveBeenCalledWith(
      "workshop-1",
      expect.objectContaining({
        name: "Neue Werkstatt",
        location: "Musterstraße 5, 80331 München, Deutschland",
        maxCapacity: 5,
        extras: ["starkstrom"],
        equipmentItems: [{ name: "Akkuschrauber", category: "elektro" }],
        imageUrls: ["data:image/png;base64,existing"]
      }),
      "token-456"
    );
  });

  it("shows login required when editing without token", () => {
    render(
      <ToastProvider>
        <ToastViewport />
        <MemoryRouter initialEntries={["/workshops/workshop-1/edit"]}>
          <Routes>
            <Route
              path="/workshops/:id/edit"
              element={<EditWorkshopPage token={undefined} currentUser={currentUser} />}
            />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    );

    expect(screen.getByRole("link", { name: "Einloggen" })).toHaveAttribute("href", "/auth");
    expect(getWorkshopById).not.toHaveBeenCalled();
  });

  it("redirects when a different user tries to edit the workshop", async () => {
    getWorkshopById.mockResolvedValueOnce({
      workshop: {
        id: "workshop-1",
        ownerId: "other-owner",
        name: "Fremde Werkstatt",
        description: "Werkstatt",
        location: "Musterstraße 5, 80331 München, Deutschland",
        maxCapacity: 2,
        extras: [],
        equipmentItems: [],
        imageUrls: ["data:image/png;base64,existing"],
        toolIds: []
      },
      slots: [
        {
          id: "slot-1",
          workshopId: "workshop-1",
          startIso: "2026-07-01T09:00:00.000Z",
          endIso: "2026-07-01T12:00:00.000Z",
          blockedByOwner: false
        }
      ]
    });

    render(
      <ToastProvider>
        <ToastViewport />
        <MemoryRouter initialEntries={["/workshops/workshop-1/edit"]}>
          <Routes>
            <Route
              path="/workshops/:id/edit"
              element={<EditWorkshopPage token="token-456" currentUser={currentUser} />}
            />
            <Route path="/workshops" element={<div>Workshops Home</div>} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    );

    expect(await screen.findByText("Workshops Home")).toBeInTheDocument();
    expect(getWorkshopById).toHaveBeenCalledWith("workshop-1", "token-456");
  });

  it("manages slots and shows validation errors while editing", async () => {
    getWorkshopById.mockResolvedValueOnce({
      workshop: {
        id: "workshop-1",
        ownerId: "owner-1",
        name: "Alte Werkstatt",
        description: "Werkstatt",
        location: "Musterstraße 5, 80331 München, Deutschland",
        maxCapacity: 5,
        extras: [],
        equipmentItems: [],
        imageUrls: ["data:image/png;base64,existing"],
        toolIds: []
      },
      slots: [
        {
          id: "slot-1",
          workshopId: "workshop-1",
          startIso: "2026-07-01T09:00:00.000Z",
          endIso: "2026-07-01T12:00:00.000Z",
          blockedByOwner: false
        }
      ]
    });
    validateAddress.mockResolvedValue({
      isValid: true,
      normalizedAddress: "Musterstraße 5, 80331 München, Deutschland",
      normalizedParts: null
    });
    createWorkshopTimeslot.mockResolvedValueOnce({
      id: "slot-2",
      workshopId: "workshop-1",
      startIso: "2026-07-02T10:00:00.000Z",
      endIso: "2026-07-02T12:00:00.000Z",
      blockedByOwner: true
    });
    updateWorkshopTimeslot.mockResolvedValueOnce({
      id: "slot-1",
      workshopId: "workshop-1",
      startIso: "2026-07-01T09:00:00.000Z",
      endIso: "2026-07-01T12:00:00.000Z",
      blockedByOwner: true
    });
    deleteWorkshopTimeslot.mockResolvedValueOnce(undefined);

    render(
      <ToastProvider>
        <ToastViewport />
        <MemoryRouter initialEntries={["/workshops/workshop-1/edit"]}>
          <Routes>
            <Route
              path="/workshops/:id/edit"
              element={<EditWorkshopPage token="token-456" currentUser={currentUser} />}
            />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    );

    expect(await screen.findByDisplayValue("Alte Werkstatt")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Start"), { target: { value: "2026-07-02T14:00" } });
    fireEvent.change(screen.getByLabelText("Ende"), { target: { value: "2026-07-02T10:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Zeitfenster hinzufügen" }));
    expect(await screen.findByText("Die Endzeit muss nach der Startzeit liegen.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Start"), { target: { value: "2026-07-02T10:00" } });
    fireEvent.change(screen.getByLabelText("Ende"), { target: { value: "2026-07-02T12:00" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /Zeitraum blockieren/i }));
    fireEvent.click(screen.getByRole("button", { name: "Zeitfenster hinzufügen" }));

    await waitFor(() =>
      expect(createWorkshopTimeslot).toHaveBeenCalledWith(
        "workshop-1",
        { startIso: "2026-07-02T10:00", endIso: "2026-07-02T12:00", blockedByOwner: true },
        "token-456"
      )
    );

    fireEvent.click(screen.getByRole("button", { name: "Blockieren" }));
    await waitFor(() => expect(updateWorkshopTimeslot).toHaveBeenCalled());

    fireEvent.click(screen.getAllByRole("button", { name: "Entfernen" })[0]);
    await waitFor(() => expect(deleteWorkshopTimeslot).toHaveBeenCalledWith("workshop-1", "slot-1", "token-456"));
  });

  it("shows a toast when loading the workshop fails", async () => {
    getWorkshopById.mockRejectedValueOnce(new Error("Netzwerkfehler"));

    render(
      <ToastProvider>
        <ToastViewport />
        <MemoryRouter initialEntries={["/workshops/workshop-1/edit"]}>
          <Routes>
            <Route
              path="/workshops/:id/edit"
              element={<EditWorkshopPage token="token-456" currentUser={currentUser} />}
            />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    );

    expect(await screen.findByText("Netzwerkfehler")).toBeInTheDocument();
  });
});
