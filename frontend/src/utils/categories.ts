// Tool categories and their corresponding placeholder images
export const TOOL_CATEGORIES = [
  { value: "elektro", label: "Elektrowerkzeuge", icon: "" },
  { value: "garten", label: "Gartenwerkzeuge", icon: "" },
  { value: "holz", label: "Holzbearbeitung", icon: "" },
  { value: "bau", label: "Bauwerkzeuge", icon: "" },
  { value: "sanitaer", label: "Sanitär & Installationen", icon: "" },
  { value: "malen", label: "Mal & Lackier Werkzeuge", icon: "" },
  { value: "kfz", label: "KFZ Werkzeuge", icon: "" },
  { value: "sonstiges", label: "Sonstiges", icon: "" }
];

export const CATEGORY_IMAGES: Record<string, string> = {
  elektro: "https://images.unsplash.com/photo-1570233767202-49b8db2f29a7?w=600&h=300&fit=crop",
  garten: "https://images.unsplash.com/photo-1584622595473-3d233cb63185?w=600&h=300&fit=crop",
  holz: "https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=600&h=300&fit=crop",
  bau: "https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=600&h=300&fit=crop",
  sanitaer: "https://images.unsplash.com/photo-1563406858-3a3f6ac3ed0c?w=600&h=300&fit=crop",
  malen: "https://images.unsplash.com/photo-1578926314433-b2f06eb62654?w=600&h=300&fit=crop",
  kfz: "https://images.unsplash.com/photo-1486262715619-3417ca6ef291?w=600&h=300&fit=crop",
  sonstiges: "https://images.unsplash.com/photo-1607705703520-bb876e2e67d1?w=600&h=300&fit=crop"
};

export function getPlaceholderImageForCategory(category: string): string {
  return CATEGORY_IMAGES[category.toLowerCase()] || CATEGORY_IMAGES.sonstiges;
}
