import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { OfferCard } from "../../src/components/OfferCard";
import { formatOfferDistance } from "../../src/utils/offerFormatting";

describe("OfferCard", () => {
  it("supports keyboard selection and renders a fallback for missing images", () => {
    const onSelect = vi.fn();

    render(
      <MemoryRouter>
        <OfferCard
          name="Werkstatt ohne Bild"
          description="Beschreibung"
          badgeLabel="0 Slots"
          badgeUnavailable
          meta="München"
          ownerName=" "
          onSelect={onSelect}
        />
      </MemoryRouter>
    );

    const card = screen.getByRole("button", { name: /Werkstatt ohne Bild/i });
    expect(screen.getByTitle("Werkstatt ohne Bild")).toBeInTheDocument();

    fireEvent.keyDown(card, { key: "Escape" });
    expect(onSelect).not.toHaveBeenCalled();

    fireEvent.keyDown(card, { key: "Enter" });
    fireEvent.keyDown(card, { key: " " });
    expect(onSelect).toHaveBeenCalledTimes(2);
  });

  it("formats known and unknown distances", () => {
    expect(formatOfferDistance(1.25)).toBe("1.3 km");
    expect(formatOfferDistance(null)).toBe("Distanz offen");
  });
});
