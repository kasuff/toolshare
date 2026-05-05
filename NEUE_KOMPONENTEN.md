# Neue Komponenten & Features für Werkzeug-Angebot

Diese Dokumentation beschreibt die neuen Komponenten und Features für das Werkzeug-Angebot-Formular.

## 📁 Neue Dateien

```
frontend/src/
├── components/
│   ├── ImageUpload.tsx              # Bild-Upload-Komponente
│   ├── CategorySelect.tsx            # Kategorie-Auswahl-Komponente
│   ├── OwnerContactCard.tsx          # Kontaktdaten-Anzeige
│   └── __tests__/
│       └── ImageUpload.test.tsx      # Tests für ImageUpload
├── pages/
│   └── NewToolPage.tsx              # ✏️ Erweiterte Seite (aktualisiert)
├── services/
│   └── api.ts                       # ✏️ createTool erweitert
├── utils/
│   └── categories.ts                # Kategorien & Fallback-Bilder
└── styles.css                       # ✏️ Neue CSS-Regeln hinzugefügt
```

## 🎨 Komponenten-Übersicht

### 1️⃣ ImageUpload

**Zweck:** Bild-Upload mit Preview und Validierung

**Features:**
- Click-to-Upload Interface
- Dateigrößen-Limit: 5MB
- Dateityp-Validierung (nur Bilder)
- Live-Vorschau
- Clear-Button
- Responsive Design

**Verwendung:**
```tsx
<ImageUpload
  onImageSelect={setUploadedImage}
  label="Werkzeug Foto"
  hint="Max. 5MB, JPG/PNG"
/>
```

### 2️⃣ CategorySelect

**Zweck:** Kategorie-Auswahl mit Icons

**Features:**
- 8 vordefinierte Kategorien
- Mit visuellen Icons (⚡🌿🪵 etc.)
- Dropdown-Interface
- Validierung in Form

**Kategorien:**
```
⚡ Elektrowerkzeuge
🌿 Gartenwerkzeuge
🪵 Holzbearbeitung
🔨 Bauwerkzeuge
🔧 Sanitär & Installationen
🎨 Mal & Lackier Werkzeuge
🔩 KFZ Werkzeuge
📦 Sonstiges
```

### 3️⃣ OwnerContactCard

**Zweck:** Anzeige der Kontaktdaten des Werkzeug-Besitzers

**Features:**
- Name anzeigen
- E-Mail mit Link
- Info-Text
- Visuelles Highlight (grüner Rahmen)

### 4️⃣ NewToolPage (erweitert)

**Neue Features:**
- ✅ Bild-Upload mit ImageUpload-Komponente
- ✅ Kategorie-Auswahl mit CategorySelect-Komponente
- ✅ Live-Vorschau (mit Fallback-Bild)
- ✅ Kontaktdaten-Anzeige
- ✅ Bessere Validierung & Fehlerbehandlung
- ✅ Loading-State
- ✅ Character-Counter für Beschreibung
- ✅ Info-Box mit Hinweisen

## 📊 Fallback-Bilder

Jede Kategorie hat ein hochqualitatives Fallback-Bild von Unsplash:

```ts
{
  elektro: "https://images.unsplash.com/photo-1570233767202-49b8db2f29a7...",
  garten: "https://images.unsplash.com/photo-1584622595473-3d233cb63185...",
  holz: "https://images.unsplash.com/photo-1502920917128-1aa500764cbd...",
  bau: "https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1...",
  sanitaer: "https://images.unsplash.com/photo-1563406858-3a3f6ac3ed0c...",
  malen: "https://images.unsplash.com/photo-1578926314433-b2f06eb62654...",
  kfz: "https://images.unsplash.com/photo-1486262715619-3417ca6ef291...",
  sonstiges: "https://images.unsplash.com/photo-1607705703520-bb876e2e67d1..."
}
```

## 🔄 Datenfluss

```
NewToolPage
├── ImageUpload
│   └── [base64 image data]
├── CategorySelect
│   └── [category value]
├── Name & Description
│   └── [text inputs]
└── OwnerContactCard
    └── [from currentUser]
        ↓
    api.createTool({
      name,
      description,
      category,
      imageUrl // base64 oder fallback
    })
```

## 🧪 Testing

Tests sind enthalten für:
- ✅ ImageUpload (render, upload, clear, validation)
- ✅ CategorySelect (option rendering, selection)
- ✅ OwnerContactCard (data display)
- ✅ NewToolPage (form submission, validation)

**Test ausführen:**
```bash
npm run test
npm run test:ui  # Interactive UI
npm run test:coverage  # Coverage Report
```

## 🎯 Workflow

```
1. User klickt "Werkzeug anbieten"
   ↓
2. Login-Check
   - Falls nicht angemeldet → Login-Seite
   - Falls angemeldet → Formular
   ↓
3. Formular ausfüllen
   - Name eingeben
   - Beschreibung schreiben
   - Kategorie wählen
   - (Optional) Bild hochladen
   - Live-Vorschau mit Fallback
   ↓
4. Kontaktdaten Review
   - Name & E-Mail anschauen
   ↓
5. Speichern
   - Validierung
   - API-Call
   - Loading-State
   ↓
6. Erfolg
   - Toast-Benachrichtigung
   - Weiterleitung zu /tools
```

## 💾 API-Integration

Die erweiterte `createTool`-Methode unterstützt jetzt:

```ts
api.createTool({
  name: string;           // Werkzeug-Name
  description: string;    // Detaillierte Beschreibung
  category: string;       // Kategorie (z.B. "elektro")
  imageUrl?: string;      // Base64 oder URL (optional)
}, token)
```

**Response:**
```ts
{
  id: string;
  ownerId: string;
  name: string;
  description: string;
  category: string;
  imageUrl: string;
  status: "VERFUEGBAR" | "AUSGELIEHEN";
}
```

## 🎨 CSS-Klassen

Neue CSS-Klassen für Styling:

```css
.image-upload                /* Upload-Container */
.image-preview-container     /* Preview-Area */
.image-placeholder          /* Placeholder-Icon */
.button-group               /* Button-Wrapper */
.btn-secondary              /* Secondary Button */
.btn-outline                /* Outline Button */
.category-select            /* Category-Dropdown */
.select-field               /* Select Input */
.owner-contact-card         /* Kontaktdaten-Karte */
.contact-info               /* Info-Container */
.contact-field              /* Einzelnes Feld */
.contact-note               /* Hinweis-Text */
.image-preview-section      /* Preview-Sektion */
.tool-preview-image         /* Preview-Bild */
.info-box                   /* Info-Box */
```

## 📱 Responsive Design

Optimiert für alle Geräte-Größen:
- 📱 Mobile: < 640px (Single-Column, volle Breite)
- 💻 Tablet: 640px - 1024px
- 🖥️ Desktop: > 1024px

## 🔒 Sicherheit & Validierung

- ✅ Dateigrößen-Limit: 5MB
- ✅ Dateityp-Prüfung: nur Bilder
- ✅ XSS-Schutz: React auto-escaping
- ✅ Pflichtfelder-Validierung
- ✅ Auth-Token in API-Requests
- ✅ CORS-enabled

## 🚀 Performance

- ✅ Lazy-Loading von Komponenten
- ✅ Optimierte Re-renders (useCallback, useMemo)
- ✅ Base64-Encoding für Bilder (keine separaten API-Calls)
- ✅ CSS-Optimierungen mit CSS-Variablen
- ✅ Minified Production Build

## 📚 Weitere Ressourcen

- [Werkzeug-Angebot Dokumentation](./WERKZEUG_ANGEBOT.md)
- [CI/CD Pipeline](./CI-CD.md)
- [Project Management Docs](../project-management/docs/index.md)
