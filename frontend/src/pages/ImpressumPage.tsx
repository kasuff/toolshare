export function ImpressumPage() {
  return (
    <article className="legal-page">
      <h1>Impressum</h1>

      <h2 id="m46">Diensteanbieter</h2>
      <p>
        Sauerwein Alexander<br />
        Freisinger Landstraße 86<br />
        80939 München
      </p>

      <h2 id="m56">Kontaktmöglichkeiten</h2>
      <p>
        E-Mail-Adresse:{" "}
        <a href="mailto:alex.sauerwe@gmail.com">alex.sauerwe@gmail.com</a>
      </p>
      <p>Telefon: 015259593474</p>

      <h2 id="m65">Haftungs- und Schutzrechtshinweise</h2>
      <p>
        Haftungsausschluss: Die Inhalte dieses Onlineangebotes wurden sorgfältig
        und nach unserem aktuellen Kenntnisstand erstellt, dienen jedoch nur der
        Information und entfalten keine rechtlich bindende Wirkung, sofern es
        sich nicht um gesetzlich verpflichtende Informationen (z.&nbsp;B. das
        Impressum, die Datenschutzerklärung, AGB oder verpflichtende Belehrungen
        von Verbrauchern) handelt. Wir behalten uns vor, die Inhalte vollständig
        oder teilweise zu ändern oder zu löschen, soweit vertragliche
        Verpflichtungen unberührt bleiben. Alle Angebote sind freibleibend und
        unverbindlich.
      </p>

      <p className="legal-seal">
        <a
          href="https://datenschutz-generator.de/"
          title="Rechtstext von Dr. Schwenke - für weitere Informationen bitte anklicken."
          target="_blank"
          rel="noopener noreferrer nofollow"
        >
          Erstellt mit kostenlosem Datenschutz-Generator.de von Dr. Thomas
          Schwenke
        </a>
      </p>
    </article>
  );
}
