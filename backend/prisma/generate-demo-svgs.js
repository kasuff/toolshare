/* eslint-disable */
/**
 * Erzeugt lokale Demo-SVGs mit Werkzeug-Motiven.
 * Ausgabe: frontend/public/demo/tools/*.svg und workshops/*.svg
 */
const fs = require("node:fs");
const path = require("node:path");

const OUT_TOOLS = path.join(__dirname, "../../frontend/public/demo/tools");
const OUT_WORKSHOPS = path.join(__dirname, "../../frontend/public/demo/workshops");

const CATEGORY_COLORS = {
  elektro: "#2563eb",
  garten: "#16a34a",
  holz: "#b45309",
  bau: "#dc2626",
  sanitaer: "#0891b2",
  malen: "#9333ea",
  kfz: "#4b5563",
  sonstiges: "#D14700",
};

/** Einfache Werkzeug-Silhouetten (viewBox 0 0 120 80) */
const ICONS = {
  drill: '<rect x="72" y="18" width="34" height="22" rx="4" fill="#fff" opacity=".9"/><rect x="18" y="30" width="58" height="16" rx="3" fill="#fff" opacity=".9"/><circle cx="24" cy="38" r="10" fill="#fff" opacity=".75"/>',
  grinder: '<circle cx="70" cy="40" r="22" fill="none" stroke="#fff" stroke-width="5" opacity=".9"/><rect x="20" y="34" width="42" height="12" rx="3" fill="#fff" opacity=".9"/>',
  washer: '<rect x="22" y="24" width="48" height="32" rx="6" fill="#fff" opacity=".9"/><path d="M70 36h24l6 8v8H70z" fill="#fff" opacity=".85"/>',
  jigsaw: '<path d="M24 48h38l8-12 10 4-6 16H24z" fill="#fff" opacity=".9"/><rect x="62" y="22" width="30" height="18" rx="3" fill="#fff" opacity=".85"/>',
  garden: '<path d="M20 52c18-28 42-30 60-10" fill="none" stroke="#fff" stroke-width="5" opacity=".9"/><rect x="52" y="18" width="10" height="34" rx="2" fill="#fff" opacity=".85"/>',
  mower: '<rect x="18" y="36" width="64" height="24" rx="6" fill="#fff" opacity=".9"/><circle cx="34" cy="62" r="8" fill="#fff" opacity=".8"/><circle cx="66" cy="62" r="8" fill="#fff" opacity=".8"/>',
  wheelbarrow: '<path d="M24 50h52l10-18H34z" fill="#fff" opacity=".9"/><circle cx="78" cy="54" r="12" fill="none" stroke="#fff" stroke-width="4" opacity=".85"/>',
  tablesaw: '<rect x="20" y="42" width="72" height="14" rx="2" fill="#fff" opacity=".9"/><path d="M58 18v24" stroke="#fff" stroke-width="4" opacity=".85"/><circle cx="58" cy="16" r="8" fill="#fff" opacity=".8"/>',
  sander: '<rect x="24" y="30" width="52" height="24" rx="8" fill="#fff" opacity=".9"/><rect x="76" y="34" width="20" height="16" rx="3" fill="#fff" opacity=".85"/>',
  workbench: '<rect x="16" y="44" width="88" height="10" rx="2" fill="#fff" opacity=".9"/><rect x="22" y="54" width="8" height="16" fill="#fff" opacity=".8"/><rect x="90" y="54" width="8" height="16" fill="#fff" opacity=".8"/>',
  router: '<rect x="28" y="34" width="44" height="20" rx="4" fill="#fff" opacity=".9"/><path d="M72 44h20l-6 10H72z" fill="#fff" opacity=".85"/>',
  hammer: '<rect x="24" y="38" width="52" height="12" rx="2" fill="#fff" opacity=".9"/><rect x="68" y="24" width="14" height="28" rx="2" fill="#fff" opacity=".85"/>',
  laser: '<rect x="26" y="36" width="48" height="14" rx="3" fill="#fff" opacity=".9"/><path d="M74 43h18" stroke="#fff" stroke-width="3" opacity=".85"/><circle cx="96" cy="43" r="4" fill="#fff"/>',
  ladder: '<path d="M30 18v44M78 18v44M30 28h48M30 40h48M30 52h48" stroke="#fff" stroke-width="4" opacity=".9"/>',
  mixer: '<circle cx="46" cy="42" r="22" fill="none" stroke="#fff" stroke-width="5" opacity=".9"/><rect x="66" y="30" width="28" height="24" rx="4" fill="#fff" opacity=".85"/>',
  pipe: '<path d="M30 50c0-18 16-28 34-20 10 4 16 0 22-8" fill="none" stroke="#fff" stroke-width="5" opacity=".9"/><circle cx="86" cy="24" r="8" fill="#fff" opacity=".85"/>',
  paint: '<rect x="34" y="22" width="24" height="36" rx="4" fill="#fff" opacity=".9"/><path d="M58 34h26l-8 24H50z" fill="#fff" opacity=".85"/>',
  wallpaper: '<rect x="20" y="24" width="36" height="32" rx="2" fill="#fff" opacity=".9"/><rect x="60" y="30" width="40" height="8" rx="2" fill="#fff" opacity=".85"/>',
  jack: '<path d="M24 54h52l14-20H38z" fill="#fff" opacity=".9"/><rect x="46" y="22" width="8" height="18" fill="#fff" opacity=".85"/>',
  obd: '<rect x="28" y="28" width="44" height="24" rx="4" fill="#fff" opacity=".9"/><rect x="76" y="34" width="18" height="12" rx="2" fill="#fff" opacity=".85"/>',
  wrench: '<path d="M34 52l18-18c6-6 14-4 18 2s2 14-4 18l-18 18" fill="none" stroke="#fff" stroke-width="5" opacity=".9"/>',
  sewing: '<rect x="24" y="34" width="56" height="22" rx="4" fill="#fff" opacity=".9"/><path d="M80 40c8 4 8 14 0 18" fill="none" stroke="#fff" stroke-width="3" opacity=".85"/>',
  bench: '<rect x="18" y="40" width="84" height="10" rx="2" fill="#fff" opacity=".9"/><rect x="22" y="50" width="10" height="14" fill="#fff" opacity=".8"/><rect x="88" y="50" width="10" height="14" fill="#fff" opacity=".8"/>',
  workshop: '<rect x="14" y="30" width="92" height="34" rx="4" fill="#fff" opacity=".2"/><rect x="22" y="38" width="24" height="18" rx="2" fill="#fff" opacity=".85"/><rect x="52" y="38" width="24" height="18" rx="2" fill="#fff" opacity=".85"/><rect x="82" y="38" width="16" height="18" rx="2" fill="#fff" opacity=".85"/>',
  fablab: '<rect x="20" y="22" width="36" height="36" rx="4" fill="#fff" opacity=".85"/><path d="M62 30h34v28H62z" fill="#fff" opacity=".7"/><path d="M68 38h8v12h-8zm12 0h8v12h-8z" fill="#fff" opacity=".9"/>',
  bike: '<circle cx="34" cy="50" r="14" fill="none" stroke="#fff" stroke-width="4" opacity=".9"/><circle cx="78" cy="50" r="14" fill="none" stroke="#fff" stroke-width="4" opacity=".9"/><path d="M34 50h24l10-18" stroke="#fff" stroke-width="4" opacity=".85"/>',
  textile: '<rect x="24" y="30" width="48" height="24" rx="3" fill="#fff" opacity=".9"/><path d="M76 36c10 4 10 18 0 22" fill="none" stroke="#fff" stroke-width="3" opacity=".85"/>',
};

function wrapLines(text, max = 22) {
  const words = text.split(" ");
  const lines = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > max && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 2);
}

function createSvg(title, category, iconKey) {
  const color = CATEGORY_COLORS[category] || CATEGORY_COLORS.sonstiges;
  const icon = ICONS[iconKey] || ICONS.drill;
  const lines = wrapLines(title);
  const textY = lines.length > 1 ? 332 : 340;
  const textLines = lines
    .map((line, i) => `<tspan x="300" dy="${i === 0 ? 0 : 28}">${escapeXml(line)}</tspan>`)
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400" role="img" aria-label="${escapeXml(title)}">
  <rect width="600" height="400" fill="#f3f5f4"/>
  <rect x="40" y="40" width="520" height="220" rx="24" fill="${color}"/>
  <g transform="translate(240 110)">${icon}</g>
  <text x="300" y="${textY}" text-anchor="middle" font-family="system-ui,Segoe UI,sans-serif" font-size="22" font-weight="600" fill="#1f2937">${textLines}</text>
</svg>`;
}

function escapeXml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const TOOL_ASSETS = [
  { file: "bosch-gsb", name: "Bosch GSB 18V-55 Akku-Schlagbohrschrauber", category: "elektro", icon: "drill" },
  { file: "makita-flex", name: "Makita Winkelschleifer 125 mm", category: "elektro", icon: "grinder" },
  { file: "kaercher-k5", name: "Kärcher Hochdruckreiniger K5", category: "elektro", icon: "washer" },
  { file: "bosch-stichsaege", name: "Bosch Stichsäge PST 900 PEL", category: "elektro", icon: "jigsaw" },
  { file: "gardena-vertikutierer", name: "Gardena Elektro-Vertikutierer", category: "garten", icon: "garden" },
  { file: "stihl-heckenschere", name: "Stihl Akku-Heckenschere HSA 50", category: "garten", icon: "garden" },
  { file: "husqvarna-rasenmaeher", name: "Husqvarna Benzin-Rasenmäher", category: "garten", icon: "mower" },
  { file: "schubkarre", name: "Bau-Schubkarre 100 L", category: "garten", icon: "wheelbarrow" },
  { file: "festool-tauchsaege", name: "Festool Tauchsäge TS 55 + Führungsschiene", category: "holz", icon: "tablesaw" },
  { file: "bosch-exzenterschleifer", name: "Bosch Exzenterschleifer PEX 400 AE", category: "holz", icon: "sander" },
  { file: "werkbank", name: "Klappbare Werkbank (Black+Decker Workmate)", category: "holz", icon: "workbench" },
  { file: "makita-oberfraese", name: "Makita Akku-Oberfräse", category: "holz", icon: "router" },
  { file: "bosch-bohrhammer", name: "Bosch Bohrhammer GBH 2-28 (SDS-Plus)", category: "bau", icon: "hammer" },
  { file: "bosch-laser", name: "Bosch Kreuzlinienlaser", category: "bau", icon: "laser" },
  { file: "hailo-leiter", name: "Hailo Alu-Mehrzweckleiter (3-teilig)", category: "bau", icon: "ladder" },
  { file: "betonmischer", name: "Betonmischer 140 L", category: "bau", icon: "mixer" },
  { file: "rohrspirale", name: "Rohrreinigungsspirale 10 m", category: "sanitaer", icon: "pipe" },
  { file: "presszange", name: "Rothenberger Presszange", category: "sanitaer", icon: "pipe" },
  { file: "wagner-farbe", name: "Wagner Farbsprühsystem", category: "malen", icon: "paint" },
  { file: "tapezier-set", name: "Tapezier-Set (Tisch + Vlies + Roller)", category: "malen", icon: "wallpaper" },
  { file: "wagenheber", name: "Rangierwagenheber 2 t + Unterstellböcke", category: "kfz", icon: "jack" },
  { file: "obd2", name: "OBD2-Diagnosegerät (Bluetooth)", category: "kfz", icon: "obd" },
  { file: "drehmomentschluessel", name: 'Drehmomentschlüssel-Set 1/2"', category: "kfz", icon: "wrench" },
  { file: "naehmaschine", name: "Nähmaschine Brother Innov-is", category: "sonstiges", icon: "sewing" },
  { file: "bierzeltgarnitur", name: "Bierzeltgarnitur (Tisch + 2 Bänke)", category: "sonstiges", icon: "bench" },
];

const WORKSHOP_ASSETS = [
  { file: "holzwerkstatt", name: "Holzwerkstatt München-Süd", category: "holz", icon: "workshop" },
  { file: "fablab", name: "FabLab Schraubzwinge", category: "elektro", icon: "fablab" },
  { file: "fahrradwerkstatt", name: "Fahrrad-Selbsthilfewerkstatt Allach", category: "kfz", icon: "bike" },
  { file: "naehwerkstatt", name: "Kreativ- und Nähwerkstatt Lothstraße", category: "sonstiges", icon: "textile" },
];

fs.mkdirSync(OUT_TOOLS, { recursive: true });
fs.mkdirSync(OUT_WORKSHOPS, { recursive: true });

/** @type {Record<string, string>} */
const TOOL_IMAGES = {};
for (const item of TOOL_ASSETS) {
  const svg = createSvg(item.name, item.category, item.icon);
  const rel = `/demo/tools/${item.file}.svg`;
  fs.writeFileSync(path.join(OUT_TOOLS, `${item.file}.svg`), svg);
  TOOL_IMAGES[item.name] = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

/** @type {Record<string, string[]>} */
const WORKSHOP_IMAGES = {};
for (const item of WORKSHOP_ASSETS) {
  const svg = createSvg(item.name, item.category, item.icon);
  const rel = `/demo/workshops/${item.file}.svg`;
  fs.writeFileSync(path.join(OUT_WORKSHOPS, `${item.file}.svg`), svg);
  WORKSHOP_IMAGES[item.name] = [`data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`];
}

const outFile = path.join(__dirname, "demo-images.js");
const content = `/* eslint-disable */
/** Automatisch generiert von generate-demo-svgs.js – nicht manuell bearbeiten. */
const TOOL_IMAGES = ${JSON.stringify(TOOL_IMAGES, null, 2)};
const WORKSHOP_IMAGES = ${JSON.stringify(WORKSHOP_IMAGES, null, 2)};
module.exports = { TOOL_IMAGES, WORKSHOP_IMAGES };
`;
fs.writeFileSync(outFile, content);
console.log(`✓ ${TOOL_ASSETS.length} Werkzeug- und ${WORKSHOP_ASSETS.length} Werkstatt-SVGs erzeugt.`);
