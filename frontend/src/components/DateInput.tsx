import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FocusEvent,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type MouseEvent
} from "react";

type DateInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange"> & {
  value: string;
  onChange: (value: string) => void;
};

function isoToDisplay(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[3]}.${match[2]}.${match[1]}` : value;
}

function displayToIso(value: string) {
  const match = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(value);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }

  return `${match[3]}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function formatDateDigits(value: string) {
  const isoValue = isoToDisplay(value);
  const digits = isoValue.replace(/\D/g, "").slice(0, 8);
  const day = digits.slice(0, 2);
  const month = digits.slice(2, 4);
  const year = digits.slice(4);

  return [day, month, year].filter(Boolean).join(".");
}

function normalizeDateDraft(value: string, isAppendingAtEnd: boolean) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return isoToDisplay(value);
  }

  if (isAppendingAtEnd) {
    return formatDateDigits(value);
  }

  return value.replace(/[^\d.]/g, "").slice(0, 10);
}

export function DateInput({
  value,
  onChange,
  onBlur,
  onFocus,
  onKeyDown,
  className,
  disabled,
  min,
  max,
  placeholder = "tt.mm.jjjj",
  ...props
}: DateInputProps) {
  const [draft, setDraft] = useState(() => isoToDisplay(value));
  const [isFocused, setIsFocused] = useState(false);
  const pickerRef = useRef<HTMLInputElement>(null);
  const committedValueRef = useRef(value);
  const propValueRef = useRef(value);

  useEffect(() => {
    if (value !== propValueRef.current) {
      propValueRef.current = value;
      committedValueRef.current = value;
      if (!isFocused) {
        setDraft(isoToDisplay(value));
      }
    }
  }, [isFocused, value]);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.value;
    const isAppendingAtEnd = nextValue.length > draft.length && event.target.selectionStart === nextValue.length;
    const nextDraft = normalizeDateDraft(nextValue, isAppendingAtEnd);
    setDraft(nextDraft);

    const isoValue = displayToIso(nextDraft);
    if (isoValue) {
      committedValueRef.current = isoValue;
      onChange(isoValue);
    } else if (!nextDraft) {
      committedValueRef.current = "";
      onChange("");
    }
  };

  const handleFocus = (event: FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    onFocus?.(event);
  };

  const commitDraft = (nextDraft: string) => {
    const isoValue = displayToIso(nextDraft);
    if (isoValue) {
      committedValueRef.current = isoValue;
      setDraft(isoToDisplay(isoValue));
    } else {
      setDraft(isoToDisplay(committedValueRef.current));
    }
  };

  const handleBlur = (event: FocusEvent<HTMLInputElement>) => {
    setIsFocused(false);
    commitDraft(event.currentTarget.value);
    onBlur?.(event);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commitDraft(event.currentTarget.value);
      event.currentTarget.blur();
    }
    onKeyDown?.(event);
  };

  const handlePickerClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    const picker = pickerRef.current;
    if (!picker) return;

    if (typeof picker.showPicker === "function") {
      picker.showPicker();
      return;
    }

    picker.click();
  };

  return (
    <span className={`date-input-control${disabled ? " is-disabled" : ""}`}>
      <input
        {...props}
        className={className}
        type="text"
        inputMode="numeric"
        maxLength={10}
        placeholder={placeholder}
        value={draft}
        disabled={disabled}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
      />
      <button
        aria-label="Kalender öffnen"
        className="date-input-picker-button"
        disabled={disabled}
        type="button"
        onClick={handlePickerClick}
      >
        <span className="date-input-calendar-icon material-symbols-outlined" aria-hidden="true">
          calendar_month
        </span>
      </button>
      <input
        ref={pickerRef}
        aria-hidden="true"
        className="date-input-picker-native"
        tabIndex={-1}
        type="date"
        value={value}
        min={min}
        max={max}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </span>
  );
}
