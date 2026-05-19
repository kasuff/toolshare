# Beitragen zu ToolShare (Code-Repo)

Architektur, ADRs und Scrum-Doku liegen im separaten Repository  
[project-management](https://gitlab.lrz.de/swe2_if/team06/project-management).

## Code als Dokumentation

Weil Doku und Code getrennt sind, muss dieser Code **für Reviewer und zukünftiges Ich** verständlich sein – ohne jedes Mal MkDocs zu öffnen.

**Entscheidung:** [ADR-008: Code als lebende Dokumentation](https://gitlab.lrz.de/swe2_if/team06/project-management/-/blob/main/docs/adr/008-code-als-dokumentation.md)

**Ausführliche Richtlinie:** [Code als Dokumentation](https://gitlab.lrz.de/swe2_if/team06/project-management/-/blob/main/docs/architektur/code-als-dokumentation.md)

### Kurzfassung

1. **Lesbarer Code** (Namen, kleine Funktionen, Feature-Module) vor langen Kommentaren.
2. **Kommentare** erklären *Warum*, Geschäftsregeln und Abweichungen zur Fachsprache – nicht *Was* der nächste Zeile tut.
3. **TypeScript + Zod** dokumentieren API-Verträge; keine parallelen Tabellen im Doku-Repo pflegen.
4. **Neue Architekturentscheidungen** → ADR im Doku-Repo, nicht 50 Zeilen Kommentar im Code.
5. **Merge Requests:** Verständlichkeit mitprüfen.

Literaturhinweise (Clean Code, Code Complete, ISO 25010): siehe verlinkte Doku-Seite.
