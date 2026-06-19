import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SystemRulesInfo } from "../../src/components/SystemRulesInfo";

const { getSystemSettings } = vi.hoisted(() => ({
  getSystemSettings: vi.fn()
}));

vi.mock("../../src/services/api", () => ({
  api: {
    getSystemSettings
  }
}));

describe("SystemRulesInfo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when no settings are returned", async () => {
    getSystemSettings.mockResolvedValueOnce([]);
    const { container } = render(<SystemRulesInfo token="token-1" />);
    await waitFor(() => expect(getSystemSettings).toHaveBeenCalledWith("token-1"));
    expect(container).toBeEmptyDOMElement();
  });

  it("shows filtered platform rules", async () => {
    getSystemSettings.mockResolvedValueOnce([
      { key: "maxLoanDurationDays", label: "Maximale Ausleihdauer", value: 14, unit: "Tage" },
      { key: "hiddenRule", label: "Hidden", value: 1 }
    ]);

    render(
      <SystemRulesInfo
        token="token-1"
        keys={["maxLoanDurationDays"]}
        title="Wichtige Regeln"
      />
    );

    expect(await screen.findByText("Wichtige Regeln")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Wichtige Regeln"));
    expect(screen.getByText(/Maximale Ausleihdauer/)).toBeInTheDocument();
    expect(screen.getByText(/14 Tage/)).toBeInTheDocument();
    expect(screen.queryByText("Hidden")).not.toBeInTheDocument();
  });
});
