import { useEffect, useState } from "react";
import { api, type AddressSuggestion } from "@toolshare/shared";
import { isAddressComplete, type AddressFormFields } from "../utils/address";

type Props = {
  value: AddressFormFields;
  onChange: (value: AddressFormFields) => void;
  initialSearchValue?: string;
  required?: boolean;
  hasError?: boolean;
  onBlur?: () => void;
  compactManualLayout?: boolean;
};

export function AddressInput({
  value,
  onChange,
  initialSearchValue = "",
  required = false,
  hasError = false,
  onBlur,
  compactManualLayout = false
}: Props) {
  const [mode, setMode] = useState<"automatic" | "manual">("automatic");
  const [searchValue, setSearchValue] = useState(initialSearchValue);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    setSearchValue(initialSearchValue);
  }, [initialSearchValue]);

  useEffect(() => {
    if (!value.street && !value.houseNumber && !value.postalCode && !value.city) {
      setSearchValue("");
    }
  }, [value.city, value.houseNumber, value.postalCode, value.street]);

  useEffect(() => {
    if (mode !== "automatic" || !isFocused || searchValue.trim().length < 3) {
      setSuggestions([]);
      return;
    }

    const timer = window.setTimeout(() => {
      void api.suggestAddresses(searchValue).then(setSuggestions);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [isFocused, mode, searchValue]);

  const selectSuggestion = (suggestion: AddressSuggestion) => {
    onChange({
      street: suggestion.street,
      houseNumber: suggestion.houseNumber,
      postalCode: suggestion.postalCode,
      city: suggestion.city,
      country: suggestion.country || "Deutschland"
    });
    setSearchValue(suggestion.label);
    setSuggestions([]);
  };

  const updateField = (field: keyof AddressFormFields, fieldValue: string) => {
    onChange({ ...value, [field]: fieldValue });
  };

  return (
    <div className={`address-input ${compactManualLayout ? "address-input-compact" : ""}`.trim()}>
      {mode === "automatic" ? (
        <>
          <div className="address-autocomplete">
            <input
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => {
                onBlur?.();
                window.setTimeout(() => setIsFocused(false), 120);
              }}
              placeholder="Adresse suchen"
              autoComplete="street-address"
              className={hasError ? "input-invalid" : undefined}
              aria-invalid={hasError}
              required={required && !isAddressComplete(value)}
            />
            {isFocused && searchValue.trim().length >= 3 && (
              <div className="address-dropdown" role="listbox" aria-label="Adressvorschläge">
                <p className="address-dropdown-head">Vorschläge - klicken zum Übernehmen</p>
                {suggestions.length > 0 ? (
                  <ul className="address-suggestion-list">
                    {suggestions.map((suggestion) => (
                      <li key={suggestion.label}>
                        <button
                          type="button"
                          className="address-suggestion-item"
                          onMouseDown={() => selectSuggestion(suggestion)}
                        >
                          <span className="address-suggestion-title">{suggestion.label}</span>
                          <span className="address-suggestion-meta">
                            {suggestion.postalCode} {suggestion.city}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="address-suggestion-empty">Keine Vorschläge gefunden.</p>
                )}
              </div>
            )}
          </div>
          <p className="address-mode-hint">
            Keine passende Adresse?{" "}
            <button type="button" className="address-mode-toggle" onClick={() => setMode("manual")}>
              Adresse manuell eingeben
            </button>
          </p>
        </>
      ) : (
        <>
          <div className={`address-grid ${compactManualLayout ? "address-grid-compact" : ""}`.trim()}>
            <label className="address-field address-field-street form-label">
              <span>Straße {required ? "*" : ""}</span>
              <input
                value={value.street}
                onChange={(event) => updateField("street", event.target.value)}
                onBlur={onBlur}
                placeholder="Straße"
                autoComplete="address-line1"
                required={required}
              />
            </label>
            <label className="address-field address-field-house-number form-label">
              <span>{compactManualLayout ? "Hausnr." : "Hausnummer"} {required ? "*" : ""}</span>
              <input
                value={value.houseNumber}
                onChange={(event) => updateField("houseNumber", event.target.value)}
                onBlur={onBlur}
                placeholder="Hausnummer"
                autoComplete="address-line2"
                required={required}
              />
            </label>
            <label className="address-field address-field-postal-code form-label">
              <span>PLZ {required ? "*" : ""}</span>
              <input
                value={value.postalCode}
                onChange={(event) => updateField("postalCode", event.target.value)}
                onBlur={onBlur}
                placeholder="PLZ"
                autoComplete="postal-code"
                required={required}
              />
            </label>
            <label className="address-field address-field-city form-label">
              <span>Ort {required ? "*" : ""}</span>
              <input
                value={value.city}
                onChange={(event) => updateField("city", event.target.value)}
                onBlur={onBlur}
                placeholder="Ort"
                autoComplete="address-level2"
                required={required}
              />
            </label>
            <label className="address-field address-field-country form-label">
              <span>Land</span>
              <input
                value={value.country}
                onChange={(event) => updateField("country", event.target.value)}
                onBlur={onBlur}
                placeholder="Land"
                autoComplete="country-name"
              />
            </label>
          </div>
          <p className="address-mode-hint">
            Lieber automatisch suchen?{" "}
            <button type="button" className="address-mode-toggle" onClick={() => setMode("automatic")}>
              Automatische Adresssuche verwenden
            </button>
          </p>
        </>
      )}
    </div>
  );
}
