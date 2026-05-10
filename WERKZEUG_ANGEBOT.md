# Werkzeug-Angebot-Formular

## Übersicht

Das Werkzeug-Angebot-Formular ermöglicht es Nutzern, ihre Werkzeuge und Geräte anzubieten. Das Formular ist benutzerfreundlich und integriert sich nahtlos in die ToolShare-Anwendung.

## Features

✅ **Bild-Upload**
- Intuitive Drag-and-Drop oder Click-to-Upload-Oberfläche
- Automatische Vorschau des hochgeladenen Bildes
- Größenlimit: max. 5MB (JPG, PNG, etc.)
- Option zum Wechseln oder Löschen des Bildes

✅ **Kategorie-Auswahl**
- Kategorien mit visuellen Icons:
  - ⚡ Elektrowerkzeuge
  - 🌿 Gartenwerkzeuge
  - 🪵 Holzbearbeitung
  - 🔨 Bauwerkzeuge
  - 🔧 Sanitär & Installationen
  - 🎨 Mal & Lackier Werkzeuge
  - 🔩 KFZ Werkzeuge
  - 📦 Sonstiges

✅ **Voreingestellte Bilder**
- Jede Kategorie hat ein Standard-Bild als Fallback
- Wird angezeigt, wenn kein Bild hochgeladen wurde
- Bilder von Unsplash (hochwertige Stock-Fotos)

✅ **Kontaktdaten des Besitzers**
- Automatisch aus dem aktuellen Benutzer gefüllt
- Name und E-Mail werden angezeigt
- Potenzielle Nutzer können direkt per E-Mail kontaktieren

✅ **Validierung**
- Pflichtfelder: Name, Beschreibung, Kategorie
- Fehlerhafte Eingaben werden mit klaren Meldungen angezeigt
- Formular-Feedback während des Speicherns

## Komponenten

### 1. `NewToolPage.tsx`

Hauptseite für das Werkzeug-Angebot.

```tsx
<NewToolPage 
  currentUser={user}
  token={authToken}
/>
```

**Props:**
- `currentUser?: User` - Der aktuelle angemeldete Nutzer
- `token?: string` - Authentifizierungs-Token

### 2. `ImageUpload.tsx`

Komponente für Bild-Upload mit Vorschau.

```tsx
<ImageUpload
  onImageSelect={(imageData) => setImage(imageData)}
  currentImage={imageUrl}
  label="Werkzeug Foto"
  hint="Lade ein gutes Foto hoch..."
/>
```

**Props:**
- `onImageSelect: (imageData: string | null) => void` - Callback bei Bildauswahl
- `currentImage?: string` - Aktuelles Bild (URL oder Base64)
- `label: string` - Label für das Input-Feld
- `hint?: string` - Hinweis-Text unter dem Label

**Features:**
- Dateigrößen-Validierung (max. 5MB)
- Datei-Typ-Validierung (nur Bilder)
- Base64-Encoding für einfache Speicherung
- Vorschau-Anzeige
- Löschen-Option

### 3. `CategorySelect.tsx`

Dropdown-Komponente für Kategorie-Auswahl.

```tsx
<CategorySelect
  value={selectedCategory}
  onChange={(cat) => setCategory(cat)}
  label="Werkzeug-Kategorie"
  hint="Hilft anderen, dein Werkzeug zu finden"
/>
```

**Props:**
- `value: string` - Aktuelle Kategorie
- `onChange: (value: string) => void` - Callback bei Änderung
- `label: string` - Label für das Feld
- `hint?: string` - Hinweis-Text

### 4. `OwnerContactCard.tsx`

Karte mit Kontaktdaten des Werkzeug-Besitzers.

```tsx
<OwnerContactCard owner={currentUser} />
```

**Props:**
- `owner: User` - Der Besitzer des Werkzeugs

## Kategorien & Fallback-Bilder

Die Datei `utils/categories.ts` definiert:

```ts
// Verfügbare Kategorien
TOOL_CATEGORIES: Array<{
  value: string;      // z.B. "elektro"
  label: string;      // z.B. "Elektrowerkzeuge"
  icon: string;       // z.B. "⚡"
}>

// Fallback-Bilder pro Kategorie
CATEGORY_IMAGES: Record<string, string>
  // URL zu hochwertigem Bild (Unsplash)

// Helper-Funktion
getPlaceholderImageForCategory(category: string): string
```

## Verwendungsbeispiel

```tsx
import { NewToolPage } from "./pages/NewToolPage";
import { useSession } from "./hooks/useSession";

export function App() {
  const { user, token } = useSession();

  return (
    <Routes>
      <Route 
        path="/tools/new" 
        element={<NewToolPage currentUser={user} token={token} />}
      />
    </Routes>
  );
}
```

## Workflow

1. **Login-Check**: Benutzer muss angemeldet sein
2. **Formular ausfüllen**:
   - Name eingeben
   - Beschreibung schreiben
   - Kategorie wählen
   - (Optional) Bild hochladen
3. **Vorschau**: Bild wird live angezeigt (oder Fallback-Bild)
4. **Kontaktdaten**: Nutzer sieht seine Kontaktdaten
5. **Speichern**: Werkzeug wird erstellt
6. **Bestätigung**: Erfolgsmeldung + Weiterleitung zu Werkzeug-Liste

## API-Integration

Die Komponente nutzt `api.createTool()`:

```ts
await api.createTool({
  name: "Bohrmaschine",
  description: "Zustand: wie neu...",
  category: "elektro",
  imageUrl: "data:image/png;base64,..." // optional
}, token);
```

## Styling

Alle Komponenten nutzen CSS-Variablen aus `styles.css`:

```css
--color-brand: #1f8a5b
--color-brand-soft: #eaf7f1
--color-text-muted: #6b7280
--radius-md: 16px
--space-4: 1rem
```

Responsive Design für Mobile (< 640px Breite).

## Testing

Beispiel-Test für `ImageUpload`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ImageUpload } from "./ImageUpload";

test("uploads and previews image", async () => {
  const handleSelect = vi.fn();
  render(
    <ImageUpload 
      onImageSelect={handleSelect}
      label="Test Image"
    />
  );
  
  const input = screen.getByRole("button", { name: /Bild hochladen/i });
  // ... weitere Tests
});
```

## Fehlerbehandlung

- ❌ Datei zu groß → "Datei ist zu groß. Maximum 5MB."
- ❌ Falsche Datei-Type → "Bitte wähle eine Bilddatei aus"
- ❌ Fehlende Felder → "Bitte gib einen Namen ein" etc.
- ❌ API-Fehler → Fehlermeldung vom Server

## Future Enhancements

- [ ] Mehrfach-Bilder (Bildergalerie)
- [ ] Drag-and-Drop für Bilder
- [ ] Bilder-Komprimierung (vor Upload)
- [ ] Bildbearbeitung (zuschneiden, drehen)
- [ ] Integration mit Cloud-Storage (S3, Supabase)
- [ ] QR-Code zum Werkzeug teilen
