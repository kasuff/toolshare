import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../src/hooks/useToast";
import { EditToolPage } from "../../src/pages/EditToolPage";
import type { User } from "@toolshare/shared";

const { getTools, updateTool, validateAddress, suggestAddresses } = vi.hoisted(() => ({
  getTools: vi.fn(),
  updateTool: vi.fn(),
  validateAddress: vi.fn(),
  suggestAddresses: vi.fn()
}));

vi.mock("@toolshare/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@toolshare/shared")>();
  return {
    ...actual,
    api: {
      ...actual.api,
      getTools, updateTool, validateAddress, suggestAddresses
    }
  };
});

const owner: User = {
  id: "owner-1",
  name: "Lea",
  email: "lea@example.com",
  role: "NUTZER",
  isSuspended: false
};

describe("EditToolPage", () => {
  it("loads the existing tool and updates it instead of creating a new offer", async () => {
    getTools.mockResolvedValueOnce([
      {
        id: "tool-1",
        ownerId: "owner-1",
        name: "Alter Bohrer",
        description: "Guter Zustand",
        category: "elektro",
        imageUrl: "tool.png",
        pickupLocation: "Musterstraße 5, 80331 München, Deutschland",
        pickupLocationNote: "Hinterhof",
        status: "VERFUEGBAR"
      }
    ]);
    validateAddress.mockResolvedValueOnce({
      isValid: true,
      normalizedAddress: "Musterstraße 5, 80331 München, Deutschland",
      normalizedParts: null
    });
    updateTool.mockResolvedValueOnce({ id: "tool-1" });

    render(
      <ToastProvider>
        <MemoryRouter initialEntries={["/tools/tool-1/edit"]}>
          <Routes>
            <Route path="/tools/:id/edit" element={<EditToolPage token="token-123" currentUser={owner} />} />
            <Route path="/tools/:id" element={<div>Tool detail</div>} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    );

    const nameInput = await screen.findByDisplayValue("Alter Bohrer");
    fireEvent.change(nameInput, { target: { value: "Neuer Bohrer" } });
    fireEvent.click(screen.getByRole("button", { name: "Änderungen speichern" }));

    await waitFor(() =>
      expect(updateTool).toHaveBeenCalledWith(
        "tool-1",
        expect.objectContaining({
          name: "Neuer Bohrer",
          description: "Guter Zustand",
          category: "elektro",
          pickupLocation: "Musterstraße 5, 80331 München, Deutschland",
          pickupLocationNote: "Hinterhof"
        }),
        "token-123"
      )
    );
  });

  it("shows a login prompt without an authenticated user", async () => {
    render(
      <ToastProvider>
        <MemoryRouter initialEntries={["/tools/tool-1/edit"]}>
          <Routes>
            <Route path="/tools/:id/edit" element={<EditToolPage />} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    );

    expect(await screen.findByText("Login erforderlich")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Einloggen" })).toHaveAttribute(
      "href",
      "/auth"
    );
  });

  it("does not update an incomplete tool", async () => {
    getTools.mockResolvedValueOnce([
      {
        id: "tool-1",
        ownerId: "owner-1",
        name: "Alter Bohrer",
        description: "Guter Zustand",
        category: "elektro",
        imageUrl: "tool.png",
        pickupLocation: "Musterstrasse 5, 80331 Muenchen, Deutschland",
        pickupLocationNote: "Hinterhof",
        status: "VERFUEGBAR"
      }
    ]);

    render(
      <ToastProvider>
        <MemoryRouter initialEntries={["/tools/tool-1/edit"]}>
          <Routes>
            <Route path="/tools/:id/edit" element={<EditToolPage token="token-123" currentUser={owner} />} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    );

    const nameInput = await screen.findByDisplayValue("Alter Bohrer");
    fireEvent.change(nameInput, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: /speichern/i }));

    expect(updateTool).not.toHaveBeenCalled();
  });

  it("keeps an unchanged stored pickup location valid", async () => {
    getTools.mockResolvedValueOnce([
      {
        id: "tool-1",
        ownerId: "owner-1",
        name: "Alter Bohrer",
        description: "Guter Zustand",
        category: "elektro",
        imageUrl: "tool.png",
        pickupLocation: "München Zentrum",
        pickupLocationNote: "",
        status: "VERFUEGBAR"
      }
    ]);
    updateTool.mockResolvedValueOnce({ id: "tool-1" });

    render(
      <ToastProvider>
        <MemoryRouter initialEntries={["/tools/tool-1/edit"]}>
          <Routes>
            <Route path="/tools/:id/edit" element={<EditToolPage token="token-123" currentUser={owner} />} />
            <Route path="/tools/:id" element={<div>Tool detail</div>} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    );

    fireEvent.change(await screen.findByDisplayValue("Alter Bohrer"), {
      target: { value: "Neuer Bohrer" }
    });
    fireEvent.click(screen.getByRole("button", { name: /speichern/i }));

    await waitFor(() =>
      expect(updateTool).toHaveBeenCalledWith(
        "tool-1",
        expect.objectContaining({ pickupLocation: "München Zentrum" }),
        "token-123"
      )
    );
  });
});
