import { useEffect, useId, useState, type KeyboardEvent } from "react";
import { api, type AddressSuggestion } from "../services/api";
import { isAddressComplete, type AddressFormFields } from "../utils/address";

type Props = {
  value: AddressFormFields;
  onChange: (value: AddressFormFields) => void;
  initialSearchValue?: string;
  required?: boolean;
  hasError?: boolean;
  describedBy?: string;
  errorMessageId?: string;
  onBlur?: () => void;
  compactManualLayout?: boolean;
};

export function AddressInput({
  value,
  onChange,
  initialSearchValue = "",
  required = false,
  hasError = false,
  describedBy,
  errorMessageId,
  onBlur,
  compactManualLayout = false
}: Props) {
  const [mode, setMode] = useState<"automatic" | "manual">("automatic");
  const [searchValue, setSearchValue] = useState(initialSearchValue);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [isFocused, setIsFocused] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const inputId = useId();
  const listboxId = `${inputId}-suggestions`;
  const descriptionIds = [describedBy, hasError ? errorMessageId : null].filter(Boolean).join(" ") || undefined;

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
      setActiveSuggestionIndex(-1);
      return;
    }

    const timer = window.setTimeout(() => {
      void api.suggestAddresses(searchValue).then((nextSuggestions) => {
        setSuggestions(nextSuggestions);
        setActiveSuggestionIndex(nextSuggestions.length > 0 ? 0 : -1);
      });
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
    setActiveSuggestionIndex(-1);
  };

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setSuggestions([]);
      setActiveSuggestionIndex(-1);
      return;
    }
    if (suggestions.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveSuggestionIndex((current) => (current + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveSuggestionIndex((current) => (current <= 0 ? suggestions.length - 1 : current - 1));
    } else if (event.key === "Enter" && activeSuggestionIndex >= 0) {
      event.preventDefault();
      selectSuggestion(suggestions[activeSuggestionIndex]);
    }
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
              id={inputId}
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => {
                onBlur?.();
                window.setTimeout(() => setIsFocused(false), 120);
              }}
              placeholder="Adresse suchen"
              aria-label="Adresse suchen"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={isFocused && searchValue.trim().length >= 3}
              aria-controls={listboxId}
              aria-activedescendant={
                activeSuggestionIndex >= 0 ? `${listboxId}-option-${activeSuggestionIndex}` : undefined
              }
              autoComplete="street-address"
              className={hasError ? "input-invalid" : undefined}
              aria-invalid={hasError}
              aria-describedby={descriptionIds}
              required={required && !isAddressComplete(value)}
              onKeyDown={handleSearchKeyDown}
            />
            {isFocused && searchValue.trim().length >= 3 && (
              <div className="address-dropdown">
                <p className="address-dropdown-head">Vorschläge - klicken zum Übernehmen</p>
                {suggestions.length > 0 ? (
                  <ul id={listboxId} className="address-suggestion-list" role="listbox" aria-label="Adressvorschläge">
                    {suggestions.map((suggestion, index) => (
                      <li
                        id={`${listboxId}-option-${index}`}
                        key={suggestion.label}
                        role="option"
                        aria-selected={index === activeSuggestionIndex}
                        className={`address-suggestion-item ${index === activeSuggestionIndex ? "is-active" : ""}`.trim()}
                        onMouseDown={(event) => {
                          event.preventDefault();
                          selectSuggestion(suggestion);
                        }}
                        onMouseEnter={() => setActiveSuggestionIndex(index)}
                      >
                          <span className="address-suggestion-title">{suggestion.label}</span>
                          <span className="address-suggestion-meta">
                            {suggestion.postalCode} {suggestion.city}
                          </span>
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
                aria-invalid={hasError}
                aria-describedby={descriptionIds}
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
                aria-invalid={hasError}
                aria-describedby={descriptionIds}
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
                aria-invalid={hasError}
                aria-describedby={descriptionIds}
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
                aria-invalid={hasError}
                aria-describedby={descriptionIds}
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
                aria-describedby={descriptionIds}
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
