# Native Android Installation (APK)

Wenn du die ToolShare Mobile App nicht nur über "Expo Go" testen, sondern als echte native App dauerhaft auf deinem Smartphone installieren möchtest, kannst du eine `.apk`-Datei erstellen.

Da wir **Expo** verwenden, gibt es dafür zwei empfohlene Wege: 
Den einfachen Weg über die Cloud (EAS) und den fortgeschrittenen Weg lokal (per USB).

---

## Möglichkeit 1: APK über die Expo-Cloud bauen (Empfohlen)

Mit den **Expo Application Services (EAS)** kannst du die App in der Cloud kompilieren lassen und anschließend die `.apk` direkt auf dein Handy herunterladen. Du brauchst hierfür *kein* lokales Android Studio.

### Voraussetzungen
Du benötigst einen kostenlosen [Expo-Account](https://expo.dev/).

### Schritt-für-Schritt Anleitung

1. **EAS CLI installieren:**
   Öffne ein Terminal und installiere das EAS-Tool global:
   ```bash
   npm install -g eas-cli
   ```

2. **Bei Expo einloggen:**
   ```bash
   eas login
   ```

3. **Projekt konfigurieren:**
   Führe im `mobile`-Ordner folgenden Befehl aus:
   ```bash
   eas build:configure
   ```
   (Dies generiert eine `eas.json` Datei im `mobile`-Verzeichnis).

4. **eas.json anpassen:**
   Damit eine installierbare `.apk`-Datei anstelle eines `.aab` (für den Play Store) generiert wird, öffne die neu erstellte `eas.json` und füge bei `preview` das Feld `buildType: "apk"` hinzu:
   ```json
   {
     "build": {
       "preview": {
         "android": {
           "buildType": "apk"
         }
       },
       "production": {}
     }
   }
   ```

5. **Die App bauen:**
   Starte den Build-Prozess mit dem Profil "preview":
   ```bash
   eas build -p android --profile preview
   ```
   
6. **Installieren:**
   Sobald der Build abgeschlossen ist (dies kann ein paar Minuten dauern), erhältst du im Terminal einen QR-Code und einen Link.
   Öffne den Link auf deinem Handy (oder scanne den QR-Code) und lade die `.apk`-Datei herunter.
   Klicke auf die heruntergeladene Datei, um sie auf deinem Handy zu installieren.

---

## Möglichkeit 2: Lokal via USB (Erfordert Android Studio)

Wenn du die App komplett lokal auf deinem PC kompilieren möchtest, brauchst du ein vollständiges lokales Android-Setup.

### Voraussetzungen
- Android Studio ist auf deinem PC installiert.
- Das Android SDK, Platform-Tools (adb) und Java sind konfiguriert.
- Dein Smartphone ist per USB verbunden und **USB-Debugging** ist in den Entwickleroptionen aktiviert.

### Schritt-für-Schritt Anleitung

1. **USB-Verbindung prüfen:**
   Stelle sicher, dass dein PC das Handy erkennt:
   ```bash
   adb devices
   ```

2. **App kompilieren und ausführen:**
   Wechsle in das `mobile` Verzeichnis und starte den nativen Android-Run-Befehl:
   ```bash
   npx expo run:android
   ```
   
   *Was passiert jetzt?*
   Expo generiert den systemeigenen Android-Code (Prebuild), kompiliert ihn lokal über das Gradle-Build-System und installiert die fertige App direkt per USB auf dein Smartphone. Die App öffnet sich danach automatisch.
