import { describe, expect, it } from "vitest";
import {
  DEFAULT_PLACEHOLDER_IMAGE,
  TOOL_CATEGORIES,
  getPlaceholderImageForCategory,
  normalizePlaceholderImage
} from "../../src/utils/categories";

describe("categories utilities", () => {
  it("exposes the expected category list", () => {
    expect(TOOL_CATEGORIES).toHaveLength(8);
    expect(TOOL_CATEGORIES.map((category) => category.value)).toContain("garten");
  });

  it("returns a category-specific placeholder image and falls back safely", () => {
    expect(getPlaceholderImageForCategory("Holz")).toBe(DEFAULT_PLACEHOLDER_IMAGE);
    expect(getPlaceholderImageForCategory("unknown-category")).toBe(DEFAULT_PLACEHOLDER_IMAGE);
  });

  it("replaces the legacy green placeholder without changing uploaded images", () => {
    const legacyPlaceholder = DEFAULT_PLACEHOLDER_IMAGE.replace(
      encodeURIComponent("#FF6600"),
      encodeURIComponent("#1f925a")
    );
    const uploadedImage = "data:image/png;base64,uploaded";

    expect(normalizePlaceholderImage(legacyPlaceholder)).toBe(DEFAULT_PLACEHOLDER_IMAGE);
    expect(normalizePlaceholderImage(uploadedImage)).toBe(uploadedImage);
  });
});
