import { describe, expect, it } from "vitest";
import {
  DEFAULT_PLACEHOLDER_IMAGE,
  TOOL_CATEGORIES,
  getPlaceholderImageForCategory
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
});
