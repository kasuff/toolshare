import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { OfferCard } from "../../src/components/OfferCard";
import { formatOfferDistance } from "../../src/utils/offerFormatting";

describe("OfferCard", () => {
  it("supports keyboard selection and renders a fallback for missing images", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <OfferCard
          name="Werkstatt ohne Bild"
          description="Beschreibung"
          meta="München"
          ownerName=" "
          onSelect={onSelect}
        />
      </MemoryRouter>
    );

    const card = screen.getByRole("button", { name: /Werkstatt ohne Bild/i });
    expect(screen.getByTitle("Werkstatt ohne Bild")).toBeInTheDocument();
    expect(screen.queryByText("0 Slots")).not.toBeInTheDocument();

    card.focus();
    await user.keyboard("{Escape}");
    expect(onSelect).not.toHaveBeenCalled();

    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    expect(onSelect).toHaveBeenCalledTimes(2);
  });

  it("formats known and unknown distances", () => {
    expect(formatOfferDistance(1.25)).toBe("1.3 km");
    expect(formatOfferDistance(null)).toBe("Distanz offen");
  });
});
