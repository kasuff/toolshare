import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../src/hooks/useToast";
import { ToolDetailPage } from "../../src/pages/ToolDetailPage";

const { getTools, createToolRequest } = vi.hoisted(() => ({
  getTools: vi.fn(),
  createToolRequest: vi.fn()
}));

vi.mock("../../src/services/api", () => ({
  api: {
    getTools,
    createToolRequest
  }
}));

describe("ToolDetailPage", () => {
  it("shows the detail layout without a slider and uses discrete booking inputs", async () => {
    getTools.mockResolvedValueOnce([
      {
        id: "t1",
        ownerId: "u1",
        name: "Akkuschrauber Bosch",
        description: "Leistungsstark",
        category: "Elektro",
        imageUrl: "https://example.com/tool.jpg",
        status: "VERFUEGBAR"
      }
    ]);

    render(
      <ToastProvider>
        <MemoryRouter initialEntries={["/tools/t1"]}>
          <Routes>
            <Route path="/tools/:id" element={<ToolDetailPage token="token-123" />} />
            <Route path="/inbox" element={<div>Inbox</div>} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    );

    expect(await screen.findByText("Werkzeug buchen")).toBeInTheDocument();
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "−" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "+" })).toHaveLength(1);
    expect(screen.getByLabelText("Von wann?")).toHaveAttribute("type", "date");
    expect(screen.getByLabelText("Abholzeit?")).toHaveAttribute("type", "time");
    await waitFor(() => expect(getTools).toHaveBeenCalled());
  });

  it("creates the request with calculated dates from the selected inputs", async () => {
    getTools.mockResolvedValueOnce([
      {
        id: "t1",
        ownerId: "u1",
        name: "Akkuschrauber Bosch",
        description: "Leistungsstark",
        category: "Elektro",
        imageUrl: "https://example.com/tool.jpg",
        status: "VERFUEGBAR"
      }
    ]);
    createToolRequest.mockResolvedValueOnce({ id: "b1" });

    render(
      <ToastProvider>
        <MemoryRouter initialEntries={["/tools/t1"]}>
          <Routes>
            <Route path="/tools/:id" element={<ToolDetailPage token="token-123" />} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    );

    await screen.findByText("Werkzeug buchen");

    const dateInput = screen.getByLabelText("Von wann?");
    const pickupInput = screen.getByLabelText("Abholzeit?");
    const timeInputs = screen.getAllByDisplayValue("10:00");

    fireEvent.change(dateInput, { target: { value: "2026-05-06" } });
    fireEvent.change(timeInputs[0], { target: { value: "09:30" } });
    fireEvent.change(pickupInput, { target: { value: "11:00" } });

    fireEvent.click(screen.getByRole("button", { name: /Anfrage senden/i }));

    expect(createToolRequest).toHaveBeenCalledWith(
      {
        toolId: "t1",
        startIso: "2026-05-06T09:30",
        endIso: "2026-05-07T09:30",
        pickupTimeIso: "2026-05-06T11:00"
      },
      "token-123"
    );
  });
});
