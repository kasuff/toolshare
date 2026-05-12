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
      <rect width="600" height="400" fill="#f3f5f4" />
      <g transform="translate(165 40)">
        <rect x="0" y="0" width="270" height="320" rx="54" fill="#1f925a" />
        <g transform="translate(75 100)">
          <svg viewBox="0 0 24 24" width="120" height="120" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11.414 10 4.031 17.418a2.091 2.091 0 0 0 0 2.967 2.11 2.11 0 0 0 2.976 0l7.407-7.385" />
            <path d="M18.121 15.293 20.707 12.707a1 1 0 0 0 0-1.414l-7.586-7.586a1 1 0 0 0-1.414 0L9.121 6.293a1 1 0 0 0 0 1.414l7.586 7.586a1 1 0 0 0 1.414 0" />
          </svg>
        </g>
      </g>
    </svg>
  `);

export function getPlaceholderImageForCategory(_category: string): string {
  return DEFAULT_PLACEHOLDER_IMAGE;
}
