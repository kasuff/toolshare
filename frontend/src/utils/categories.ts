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

export const DEFAULT_PLACEHOLDER_IMAGE =
  "data:image/svg+xml;charset=UTF-8," +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400" role="img" aria-label="Hammer als Standardbild">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#eef8f2" />
          <stop offset="100%" stop-color="#d9efe3" />
        </linearGradient>
      </defs>
      <rect width="600" height="400" fill="url(#bg)" />
      <rect x="136" y="92" width="328" height="216" rx="28" fill="#ffffff" opacity="0.95" />
      <circle cx="452" cy="108" r="56" fill="#c9e7d6" opacity="0.8" />
      <path d="M204 118h82l14 14-30 30h-82l-14-14z" fill="#1f8a5b" />
      <path d="M240 140 176 204" stroke="#166c47" stroke-width="20" stroke-linecap="round" />
      <path d="M174 206 150 230" stroke="#166c47" stroke-width="20" stroke-linecap="round" />
      <path d="M214 156 256 198" stroke="#2fa66e" stroke-width="20" stroke-linecap="round" />
    </svg>
  `);

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
  return CATEGORY_IMAGES[category.toLowerCase()] || DEFAULT_PLACEHOLDER_IMAGE;
}
