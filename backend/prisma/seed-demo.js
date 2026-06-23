/* eslint-disable */
/**
 * Demo-Seed für Präsentationen.
 * Legt realistisch wirkende Nutzer, Werkzeuge, Werkstätten, Buchungen,
 * Bewertungen, Benachrichtigungen und Meldungen an.
 *
 * Modus: NUR ERGÄNZEN. Es wird nichts gelöscht. Vorhandene echte
 * Login-Accounts (Manager etc.) bleiben unangetastet und bekommen Workshops.
 *
 * Idempotent: Nutzer werden per E-Mail ge-upsertet; bei wiederholtem Lauf
 * werden die Demo-Inhalte (Tools/Buchungen/...) nicht erneut angelegt.
 *
 * Lauf:  docker exec -w /app toolshare-backend-1 node prisma/seed-demo.js
 */
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");
const { TOOL_IMAGES, WORKSHOP_IMAGES } = require("./demo-images");

const prisma = new PrismaClient();

const DEMO_PASSWORD = "Demo1234!";
const DAY = 86_400_000;

/** Datum relativ zu heute, auf eine volle Stunde gesetzt. */
function day(offset, hour = 10) {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  return new Date(d.getTime() + offset * DAY);
}

// --- Demo-Nutzer (München-Umfeld) -----------------------------------------
const DEMO_USERS = [
  { email: "markus.bauer@gmail.com",       name: "Markus Bauer",      address: "Schwanthalerstraße 45, 80336 München, Deutschland" },
  { email: "julia.hoffmann@gmx.de",        name: "Julia Hoffmann",    address: "Leopoldstraße 88, 80802 München, Deutschland" },
  { email: "stefan.weber@web.de",          name: "Stefan Weber",      address: "Sendlinger Straße 12, 80331 München, Deutschland" },
  { email: "sandra.fischer@gmail.com",     name: "Sandra Fischer",    address: "Implerstraße 7, 81371 München, Deutschland" },
  { email: "thomas.wagner@outlook.de",     name: "Thomas Wagner",     address: "Rosenheimer Straße 145, 81671 München, Deutschland" },
  { email: "lena.schaefer@gmail.com",      name: "Lena Schäfer",      address: "Tegernseer Landstraße 30, 81541 München, Deutschland" },
  { email: "michael.koch@web.de",          name: "Michael Koch",      address: "Dachauer Straße 200, 80992 München, Deutschland" },
  { email: "anna.richter@gmx.de",          name: "Anna Richter",      address: "Wörthstraße 18, 81667 München, Deutschland" },
  { email: "daniel.klein@gmail.com",       name: "Daniel Klein",      address: "Fraunhoferstraße 9, 80469 München, Deutschland" },
  { email: "christina.wolf@gmail.com",     name: "Christina Wolf",    address: "Hohenzollernstraße 112, 80796 München, Deutschland" },
  { email: "florian.schroeder@web.de",     name: "Florian Schröder",  address: "Lindwurmstraße 71, 80337 München, Deutschland" },
  { email: "nicole.neumann@gmx.de",        name: "Nicole Neumann",    address: "Barer Straße 50, 80799 München, Deutschland" },
];

// Bestehende, echte Manager-Accounts, denen wir Werkstätten zuordnen.
const MANAGER_EMAILS = [
  "sauerwei@hm.edu",
  "mittermeier.lukas@web.de",
  "unglertmaik@gmail.com",
  "katalin.szentmiklosy@hm.edu",
];

// --- Werkzeuge ------------------------------------------------------------
const TOOLS = [
  // elektro
  { owner: "markus.bauer@gmail.com",    name: "Bosch GSB 18V-55 Akku-Schlagbohrschrauber", category: "elektro", desc: "Kompakter 18V-Schlagbohrschrauber inklusive zwei Akkus, Ladegerät und Koffer. Ideal für Wand- und Deckenmontagen.", loc: "Schwanthalerstraße 45, 80336 München", note: "Klingel 'Bauer', 2. Stock" },
  { owner: "stefan.weber@web.de",       name: "Makita Winkelschleifer 125 mm",             category: "elektro", desc: "Flex für Metall und Stein, 900 W. Passende Trenn- und Schruppscheiben können mitgegeben werden.", loc: "Sendlinger Straße 12, 80331 München", note: null },
  { owner: "thomas.wagner@outlook.de",  name: "Kärcher Hochdruckreiniger K5",              category: "elektro", desc: "Reinigt Terrasse, Auto und Fassade. Inklusive Flächenreiniger-Aufsatz.", loc: "Rosenheimer Straße 145, 81671 München", note: "Abholung am Wochenende bevorzugt" },
  { owner: "daniel.klein@gmail.com",    name: "Bosch Stichsäge PST 900 PEL",               category: "elektro", desc: "Pendelhub-Stichsäge mit Sägeblättern für Holz und Metall.", loc: "Fraunhoferstraße 9, 80469 München", note: null },
  // garten
  { owner: "michael.koch@web.de",       name: "Gardena Elektro-Vertikutierer",             category: "garten",  desc: "Für einen gesunden, moosfreien Rasen im Frühjahr.", loc: "Dachauer Straße 200, 80992 München", note: null },
  { owner: "lena.schaefer@gmail.com",   name: "Stihl Akku-Heckenschere HSA 50",            category: "garten",  desc: "Leise Akku-Heckenschere, 50 cm Schnittlänge. Akku hält etwa 40 Minuten.", loc: "Tegernseer Landstraße 30, 81541 München", note: null },
  { owner: "thomas.wagner@outlook.de",  name: "Husqvarna Benzin-Rasenmäher",               category: "garten",  desc: "Robuster Benzinmäher mit Fangkorb, 46 cm Schnittbreite.", loc: "Rosenheimer Straße 145, 81671 München", note: null },
  { owner: "sandra.fischer@gmail.com",  name: "Bau-Schubkarre 100 L",                      category: "garten",  desc: "Stabile Schubkarre mit pneumatischem Reifen.", loc: "Implerstraße 7, 81371 München", note: null },
  // holz
  { owner: "daniel.klein@gmail.com",    name: "Festool Tauchsäge TS 55 + Führungsschiene", category: "holz",    desc: "Präzise Tauchsäge mit 1,4 m Führungsschiene – perfekt für saubere Plattenschnitte.", loc: "Fraunhoferstraße 9, 80469 München", note: "Bitte die Führungsschiene pfleglich behandeln" },
  { owner: "anna.richter@gmx.de",       name: "Bosch Exzenterschleifer PEX 400 AE",        category: "holz",    desc: "Exzenterschleifer mit Staubabsaugung, inklusive Schleifpapier-Set.", loc: "Wörthstraße 18, 81667 München", note: null },
  { owner: "florian.schroeder@web.de",  name: "Klappbare Werkbank (Black+Decker Workmate)", category: "holz",   desc: "Klappbare Werkbank mit integrierter Spannvorrichtung.", loc: "Lindwurmstraße 71, 80337 München", note: null },
  { owner: "markus.bauer@gmail.com",    name: "Makita Akku-Oberfräse",                     category: "holz",    desc: "Für Kanten, Nuten und Fräsarbeiten. Fräser-Set inklusive.", loc: "Schwanthalerstraße 45, 80336 München", note: null },
  // bau
  { owner: "stefan.weber@web.de",       name: "Bosch Bohrhammer GBH 2-28 (SDS-Plus)",      category: "bau",     desc: "Kräftiger Bohrhammer für Beton und Mauerwerk, inklusive Meißel-Set.", loc: "Sendlinger Straße 12, 80331 München", note: null },
  { owner: "florian.schroeder@web.de",  name: "Bosch Kreuzlinienlaser",                    category: "bau",     desc: "Für exaktes Ausrichten von Regalen, Bildern und Fliesen.", loc: "Lindwurmstraße 71, 80337 München", note: null },
  { owner: "nicole.neumann@gmx.de",     name: "Hailo Alu-Mehrzweckleiter (3-teilig)",      category: "bau",     desc: "Mehrzweckleiter bis ca. 4,5 m Arbeitshöhe.", loc: "Barer Straße 50, 80799 München", note: null },
  { owner: "michael.koch@web.de",       name: "Betonmischer 140 L",                        category: "bau",     desc: "Elektrischer Betonmischer für kleinere Bauprojekte.", loc: "Dachauer Straße 200, 80992 München", note: "Transport nur mit Kombi oder Anhänger möglich" },
  // sanitaer
  { owner: "christina.wolf@gmail.com",  name: "Rohrreinigungsspirale 10 m",                category: "sanitaer", desc: "Manuelle Rohrreinigungsspirale gegen hartnäckige Verstopfungen.", loc: "Hohenzollernstraße 112, 80796 München", note: null },
  { owner: "daniel.klein@gmail.com",    name: "Rothenberger Presszange",                   category: "sanitaer", desc: "Profi-Presszange für Sanitärinstallationen inklusive Pressbacken.", loc: "Fraunhoferstraße 9, 80469 München", note: null },
  // malen
  { owner: "julia.hoffmann@gmx.de",     name: "Wagner Farbsprühsystem",                    category: "malen",   desc: "Sprühsystem für Wände und Möbel mit gleichmäßigem Farbauftrag.", loc: "Leopoldstraße 88, 80802 München", note: null },
  { owner: "nicole.neumann@gmx.de",     name: "Tapezier-Set (Tisch + Vlies + Roller)",     category: "malen",   desc: "Kompaktes Renovier-Set: Tapeziertisch, Abdeckvlies und Roller.", loc: "Barer Straße 50, 80799 München", note: null },
  // kfz
  { owner: "stefan.weber@web.de",       name: "Rangierwagenheber 2 t + Unterstellböcke",   category: "kfz",     desc: "Hydraulischer Rangierwagenheber inklusive zwei Unterstellböcken für den Reifenwechsel.", loc: "Sendlinger Straße 12, 80331 München", note: null },
  { owner: "markus.bauer@gmail.com",    name: "OBD2-Diagnosegerät (Bluetooth)",            category: "kfz",     desc: "Liest Fehlercodes aus, Bluetooth-fähig, deutschsprachige App.", loc: "Schwanthalerstraße 45, 80336 München", note: null },
  { owner: "thomas.wagner@outlook.de",  name: "Drehmomentschlüssel-Set 1/2\"",             category: "kfz",     desc: "Drehmomentschlüssel 28–210 Nm mit passendem Nusskasten.", loc: "Rosenheimer Straße 145, 81671 München", note: null },
  // sonstiges
  { owner: "christina.wolf@gmail.com",  name: "Nähmaschine Brother Innov-is",              category: "sonstiges", desc: "Computer-Nähmaschine mit vielen Stichprogrammen, ideal für Reparaturen.", loc: "Hohenzollernstraße 112, 80796 München", note: null },
  { owner: "lena.schaefer@gmail.com",   name: "Bierzeltgarnitur (Tisch + 2 Bänke)",        category: "sonstiges", desc: "Klassische klappbare Garnitur für Gartenfeste.", loc: "Tegernseer Landstraße 30, 81541 München", note: null },
];

// --- Buchungen ------------------------------------------------------------
// status: RETURNED (Vergangenheit, mit Bewertungen) | ACCEPTED | PENDING | REJECTED
const BOOKINGS = [
  // RETURNED – bekommen Bewertungen in beide Richtungen
  { borrower: "julia.hoffmann@gmx.de",    tool: "Bosch GSB 18V-55 Akku-Schlagbohrschrauber", status: "RETURNED", start: -30, dur: 3 },
  { borrower: "anna.richter@gmx.de",      tool: "Kärcher Hochdruckreiniger K5",              status: "RETURNED", start: -25, dur: 2 },
  { borrower: "stefan.weber@web.de",      tool: "Gardena Elektro-Vertikutierer",             status: "RETURNED", start: -20, dur: 4 },
  { borrower: "daniel.klein@gmail.com",   tool: "Stihl Akku-Heckenschere HSA 50",            status: "RETURNED", start: -18, dur: 1 },
  { borrower: "sandra.fischer@gmail.com", tool: "Festool Tauchsäge TS 55 + Führungsschiene", status: "RETURNED", start: -14, dur: 2 },
  { borrower: "florian.schroeder@web.de", tool: "OBD2-Diagnosegerät (Bluetooth)",            status: "RETURNED", start: -10, dur: 1 },
  // ACCEPTED – aktuell laufend
  { borrower: "nicole.neumann@gmx.de",    tool: "Husqvarna Benzin-Rasenmäher",               status: "ACCEPTED", start: -2, dur: 5 },
  { borrower: "michael.koch@web.de",      tool: "Bosch Bohrhammer GBH 2-28 (SDS-Plus)",      status: "ACCEPTED", start: -1, dur: 4 },
  // ACCEPTED – zukünftig
  { borrower: "lena.schaefer@gmail.com",  tool: "Bosch Kreuzlinienlaser",                    status: "ACCEPTED", start: 4,  dur: 2 },
  { borrower: "christina.wolf@gmail.com", tool: "Wagner Farbsprühsystem",                    status: "ACCEPTED", start: 6,  dur: 3 },
  // PENDING – offene Anfragen
  { borrower: "thomas.wagner@outlook.de", tool: "Festool Tauchsäge TS 55 + Führungsschiene", status: "PENDING",  start: 5,  dur: 2 },
  { borrower: "markus.bauer@gmail.com",   tool: "Rohrreinigungsspirale 10 m",                status: "PENDING",  start: 3,  dur: 1 },
  { borrower: "anna.richter@gmx.de",      tool: "Hailo Alu-Mehrzweckleiter (3-teilig)",      status: "PENDING",  start: 7,  dur: 2 },
  { borrower: "daniel.klein@gmail.com",   tool: "Betonmischer 140 L",                        status: "PENDING",  start: 8,  dur: 3 },
  // REJECTED
  { borrower: "stefan.weber@web.de",      tool: "Nähmaschine Brother Innov-is",              status: "REJECTED", start: 2,  dur: 5 },
  { borrower: "florian.schroeder@web.de", tool: "Bau-Schubkarre 100 L",                      status: "REJECTED", start: 1,  dur: 1 },
];

// Bewertungen je RETURNED-Buchung (borrower -> owner / owner -> borrower)
const RATING_TEXTS = {
  "Bosch GSB 18V-55 Akku-Schlagbohrschrauber": { toOwner: { score: 5, comment: "Top Bohrmaschine, alles dabei und top gepflegt. Übergabe super unkompliziert!" }, toBorrower: { score: 5, comment: "Sehr zuverlässig, pünktlich und sauber zurückgegeben. Gerne wieder!" } },
  "Kärcher Hochdruckreiniger K5":              { toOwner: { score: 4, comment: "Hat einwandfrei funktioniert, Terrasse sieht aus wie neu. Danke!" }, toBorrower: { score: 5, comment: "Alles bestens, gerne wieder." } },
  "Gardena Elektro-Vertikutierer":            { toOwner: { score: 5, comment: "Gerät war top in Schuss, Rasen ist wieder fit." }, toBorrower: { score: 4, comment: "Freundlicher Kontakt, Rückgabe einen Tag später als abgesprochen – aber kein Problem." } },
  "Stihl Akku-Heckenschere HSA 50":           { toOwner: { score: 5, comment: "Leicht, leise und scharf. Perfekt für die Hecke." }, toBorrower: { score: 5, comment: "Super netter Kontakt, alles top." } },
  "Festool Tauchsäge TS 55 + Führungsschiene": { toOwner: { score: 5, comment: "Absolute Profi-Säge, saubere Schnitte. Vielen Dank fürs Verleihen!" }, toBorrower: { score: 5, comment: "Sehr sorgfältiger Umgang mit dem Werkzeug, jederzeit wieder." } },
  "OBD2-Diagnosegerät (Bluetooth)":           { toOwner: { score: 4, comment: "Hat den Fehler sofort gefunden, App ist verständlich." }, toBorrower: { score: 5, comment: "Schnelle und unkomplizierte Übergabe." } },
};

// --- Werkstätten ----------------------------------------------------------
const WORKSHOPS = [
  {
    manager: "sauerwei@hm.edu",
    name: "Holzwerkstatt München-Süd",
    description: "Voll ausgestattete Holzwerkstatt für Hobbyschreiner. Hobelbänke, Absauganlage und stationäre Maschinen vorhanden. Einweisung durch erfahrene Mitglieder.",
    location: "Implerstraße 11, 81371 München",
    maxCapacity: 8,
    equipment: ["Hobelbank", "Absauganlage", "Erste-Hilfe-Kasten", "WLAN", "Gehörschutz"],
    tools: [
      { name: "Tischkreissäge", category: "holz" },
      { name: "Bandschleifer", category: "holz" },
      { name: "Standbohrmaschine", category: "elektro" },
      { name: "Akkuschrauber-Set", category: "elektro" },
    ],
    slots: [ { start: 2, hour: 17, dur: 3 }, { start: 5, hour: 10, dur: 4 }, { start: 9, hour: 17, dur: 3 }, { start: 12, hour: 10, dur: 4 } ],
  },
  {
    manager: "mittermeier.lukas@web.de",
    name: "FabLab Schraubzwinge",
    description: "Offene Hightech-Werkstatt mit 3D-Druckern, Lasercutter und Lötplätzen. Perfekt für Prototypen und Reparaturen.",
    location: "Lothstraße 64, 80335 München",
    maxCapacity: 12,
    equipment: ["3D-Drucker", "Lasercutter", "Lötstation", "WLAN", "Werkzeugausgabe"],
    tools: [
      { name: "3D-Drucker (Prusa MK4)", category: "sonstiges" },
      { name: "Lötstation", category: "elektro" },
      { name: "Heißluftgebläse", category: "elektro" },
      { name: "Feinmechaniker-Werkzeugset", category: "sonstiges" },
    ],
    slots: [ { start: 1, hour: 18, dur: 3 }, { start: 4, hour: 18, dur: 3 }, { start: 8, hour: 14, dur: 4 }, { start: 11, hour: 18, dur: 3 } ],
  },
  {
    manager: "unglertmaik@gmail.com",
    name: "Fahrrad-Selbsthilfewerkstatt Allach",
    description: "Schraub deinen Drahtesel selbst wieder flott. Montageständer, Spezialwerkzeug und hilfsbereite Ehrenamtliche vor Ort.",
    location: "Rudhartstraße 9, 80999 München",
    maxCapacity: 6,
    equipment: ["Montageständer", "Druckluft", "Ersatzteillager", "WLAN"],
    tools: [
      { name: "Montageständer", category: "kfz" },
      { name: "Zentrierständer", category: "kfz" },
      { name: "Drehmomentschlüssel", category: "kfz" },
      { name: "Kettennietwerkzeug", category: "kfz" },
    ],
    slots: [ { start: 3, hour: 16, dur: 4 }, { start: 6, hour: 16, dur: 4 }, { start: 10, hour: 10, dur: 5 } ],
  },
  {
    manager: "katalin.szentmiklosy@hm.edu",
    name: "Kreativ- und Nähwerkstatt Lothstraße",
    description: "Gemeinschaftswerkstatt für Textil, Upcycling und kleine Reparaturen. Nähmaschinen, Overlock und Zuschneidetische vorhanden.",
    location: "Lothstraße 5, 80335 München",
    maxCapacity: 10,
    equipment: ["Nähmaschinen", "Overlock", "Bügelstation", "Zuschneidetisch", "WLAN"],
    tools: [
      { name: "Nähmaschine", category: "sonstiges" },
      { name: "Overlock-Maschine", category: "sonstiges" },
      { name: "Dampfbügelstation", category: "sonstiges" },
    ],
    slots: [ { start: 2, hour: 15, dur: 3 }, { start: 7, hour: 15, dur: 3 }, { start: 13, hour: 10, dur: 4 } ],
  },
];

// Werkstatt-Buchungen: (Nutzer, Werkstatt-Index, Slot-Index, Status)
const WORKSHOP_BOOKINGS = [
  { user: "anna.richter@gmx.de",     ws: 0, slot: 0, status: "ACCEPTED" },
  { user: "daniel.klein@gmail.com",  ws: 0, slot: 1, status: "PENDING"  },
  { user: "florian.schroeder@web.de", ws: 1, slot: 0, status: "ACCEPTED" },
  { user: "julia.hoffmann@gmx.de",   ws: 1, slot: 2, status: "ACCEPTED" },
  { user: "sandra.fischer@gmail.com", ws: 2, slot: 0, status: "ACCEPTED" },
  { user: "nicole.neumann@gmx.de",   ws: 3, slot: 0, status: "PENDING"  },
  { user: "christina.wolf@gmail.com", ws: 3, slot: 1, status: "ACCEPTED" },
];

// --- Benachrichtigungen ---------------------------------------------------
const NOTIFICATIONS = [
  { user: "markus.bauer@gmail.com",   message: "Thomas Wagner möchte deine 'Makita Akku-Oberfräse' ausleihen.", read: false },
  { user: "daniel.klein@gmail.com",   message: "Neue Anfrage für 'Festool Tauchsäge TS 55 + Führungsschiene'.", read: false },
  { user: "christina.wolf@gmail.com", message: "Markus Bauer möchte deine 'Rohrreinigungsspirale 10 m' ausleihen.", read: false },
  { user: "nicole.neumann@gmx.de",    message: "Deine Buchung für 'Husqvarna Benzin-Rasenmäher' wurde bestätigt.", read: true },
  { user: "michael.koch@web.de",      message: "Deine Buchung für 'Bosch Bohrhammer GBH 2-28 (SDS-Plus)' wurde bestätigt.", read: false },
  { user: "stefan.weber@web.de",      message: "Deine Anfrage für 'Nähmaschine Brother Innov-is' wurde leider abgelehnt.", read: true },
  { user: "florian.schroeder@web.de", message: "Deine Anfrage für 'Bau-Schubkarre 100 L' wurde leider abgelehnt.", read: false },
  { user: "julia.hoffmann@gmx.de",    message: "Bitte bewerte deine letzte Ausleihe: 'Bosch GSB 18V-55 Akku-Schlagbohrschrauber'.", read: false },
  { user: "anna.richter@gmx.de",      message: "Bitte bewerte deine letzte Ausleihe: 'Kärcher Hochdruckreiniger K5'.", read: true },
  { user: "lena.schaefer@gmail.com",  message: "Deine Buchung für 'Bosch Kreuzlinienlaser' wurde bestätigt.", read: false },
  { user: "anna.richter@gmx.de",      message: "Deine Anmeldung für 'Holzwerkstatt München-Süd' wurde bestätigt.", read: false },
  { user: "florian.schroeder@web.de", message: "Deine Anmeldung für 'FabLab Schraubzwinge' wurde bestätigt.", read: true },
];

async function backfillDemoImages() {
  let toolCount = 0;
  for (const t of TOOLS) {
    const imageUrl = TOOL_IMAGES[t.name];
    if (!imageUrl) continue;
    const result = await prisma.tool.updateMany({
      where: { name: t.name },
      data: { imageUrl },
    });
    toolCount += result.count;
  }

  let workshopCount = 0;
  for (const w of WORKSHOPS) {
    const imageUrls = WORKSHOP_IMAGES[w.name];
    if (!imageUrls?.length) continue;
    const result = await prisma.workshop.updateMany({
      where: { name: w.name },
      data: { imageUrls },
    });
    workshopCount += result.count;
  }

  console.log(`  → ${toolCount} Werkzeug-Bilder und ${workshopCount} Werkstatt-Bilder gesetzt.`);
}

async function main() {
  console.log("→ Lege Demo-Nutzer an (upsert per E-Mail) …");
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  for (const u of DEMO_USERS) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {}, // bestehende Nutzer nicht überschreiben
      create: { email: u.email, name: u.name, address: u.address, passwordHash, role: "USER" },
    });
  }

  // E-Mail -> User-ID Map (Demo + benötigte Manager)
  const neededEmails = [...DEMO_USERS.map((u) => u.email), ...MANAGER_EMAILS];
  const users = await prisma.user.findMany({ where: { email: { in: neededEmails } } });
  const userByEmail = new Map(users.map((u) => [u.email, u]));
  const uid = (email) => {
    const u = userByEmail.get(email);
    if (!u) throw new Error(`Nutzer nicht gefunden: ${email}`);
    return u.id;
  };

  // Idempotenz-Wächter: existieren die Demo-Inhalte schon?
  const sentinel = await prisma.tool.findFirst({ where: { name: TOOLS[0].name } });
  if (sentinel) {
    console.log("✓ Demo-Inhalte existieren bereits – aktualisiere fehlende Bilder …");
    await backfillDemoImages();
    console.log(`  Login für alle Demo-Nutzer: Passwort '${DEMO_PASSWORD}'.`);
    return;
  }

  console.log("→ Lege Werkzeuge an …");
  const toolByName = new Map();
  for (const t of TOOLS) {
    const tool = await prisma.tool.create({
      data: {
        ownerId: uid(t.owner),
        name: t.name,
        description: t.desc,
        category: t.category,
        pickupLocation: t.loc,
        pickupLocationNote: t.note ?? undefined,
        imageUrl: TOOL_IMAGES[t.name] ?? undefined,
        status: "AVAILABLE",
        createdAt: day(-45 - Math.floor(Math.random() * 30)),
      },
    });
    toolByName.set(t.name, tool);
  }

  console.log("→ Lege Werkzeug-Buchungen an …");
  const returnedBookings = []; // für Bewertungen
  for (const b of BOOKINGS) {
    const tool = toolByName.get(b.tool);
    const start = day(b.start, 10);
    const end = day(b.start + b.dur, 18);
    const booking = await prisma.booking.create({
      data: {
        userId: uid(b.borrower),
        toolId: tool.id,
        status: b.status,
        startDate: start,
        endDate: end,
        pickupTime: start,
        createdAt: day(b.start - 2, 9),
      },
    });
    if (b.status === "RETURNED") returnedBookings.push({ booking, tool, borrower: b.borrower });
  }

  console.log("→ Lege Bewertungen an …");
  for (const rb of returnedBookings) {
    const texts = RATING_TEXTS[rb.tool.name];
    if (!texts) continue;
    const borrowerId = uid(rb.borrower);
    const ownerId = rb.tool.ownerId;
    // Verleiher bewertet den Ausleiher
    await prisma.rating.create({
      data: { bookingId: rb.booking.id, fromUserId: ownerId, toUserId: borrowerId, score: texts.toBorrower.score, comment: texts.toBorrower.comment, status: "VISIBLE", createdAt: day(0, 12) },
    });
    // Ausleiher bewertet den Verleiher
    await prisma.rating.create({
      data: { bookingId: rb.booking.id, fromUserId: borrowerId, toUserId: ownerId, score: texts.toOwner.score, comment: texts.toOwner.comment, status: "VISIBLE", createdAt: day(0, 13) },
    });
  }

  console.log("→ Lege Werkstätten inkl. Tools & Zeitslots an …");
  const createdWorkshops = [];
  for (const w of WORKSHOPS) {
    const workshop = await prisma.workshop.create({
      data: {
        managerId: uid(w.manager),
        name: w.name,
        description: w.description,
        location: w.location,
        maxCapacity: w.maxCapacity,
        equipment: w.equipment,
        imageUrls: WORKSHOP_IMAGES[w.name] ?? [],
        workshopTools: { create: w.tools.map((t) => ({ name: t.name, category: t.category })) },
        timeslots: {
          create: w.slots.map((s) => ({ startTime: day(s.start, s.hour), endTime: day(s.start, s.hour + s.dur) })),
        },
      },
      include: { timeslots: { orderBy: { startTime: "asc" } } },
    });
    createdWorkshops.push(workshop);
  }

  console.log("→ Lege Werkstatt-Buchungen an …");
  for (const wb of WORKSHOP_BOOKINGS) {
    const ws = createdWorkshops[wb.ws];
    const slot = ws.timeslots[wb.slot];
    if (!slot) continue;
    await prisma.booking.create({
      data: {
        userId: uid(wb.user),
        workshopId: ws.id,
        timeslotId: slot.id,
        status: wb.status,
        startDate: slot.startTime,
        endDate: slot.endTime,
        createdAt: day(-3, 9),
      },
    });
  }

  console.log("→ Lege Benachrichtigungen an …");
  for (const n of NOTIFICATIONS) {
    await prisma.notification.create({
      data: { userId: uid(n.user), message: n.message, read: n.read, createdAt: day(-Math.floor(Math.random() * 5), 8 + Math.floor(Math.random() * 10)) },
    });
  }

  console.log("→ Lege Meldungen (Moderation) an …");
  const beschaedigt = toolByName.get("Bau-Schubkarre 100 L");
  await prisma.report.create({
    data: {
      reporterId: uid("anna.richter@gmx.de"),
      targetType: "TOOL",
      targetId: beschaedigt.id,
      reason: "Beschreibung weicht vom Zustand ab",
      details: "Das Werkzeug war stärker abgenutzt als in der Anzeige beschrieben. Der Reifen war platt.",
      status: "OPEN",
      createdAt: day(-4, 11),
    },
  });
  await prisma.report.create({
    data: {
      reporterId: uid("daniel.klein@gmail.com"),
      targetType: "USER",
      targetId: uid("stefan.weber@web.de"),
      reason: "Unangemessene Kommunikation",
      details: "Im Chat zur Buchung kam es zu einem unfreundlichen Ton bei der Terminabsprache.",
      status: "OPEN",
      createdAt: day(-2, 16),
    },
  });

  console.log("\n✅ Demo-Daten erfolgreich angelegt.");
  console.log(`   Nutzer: ${DEMO_USERS.length}  |  Tools: ${TOOLS.length}  |  Buchungen: ${BOOKINGS.length + WORKSHOP_BOOKINGS.length}  |  Werkstätten: ${WORKSHOPS.length}`);
  console.log(`   Login für alle Demo-Nutzer: Passwort '${DEMO_PASSWORD}' (z. B. markus.bauer@gmail.com).`);
}

main()
  .catch((e) => {
    console.error("❌ Fehler beim Seeden:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
