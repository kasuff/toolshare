type Props = {
  value: number;
  onChange: (score: number) => void;
  label?: string;
  disabled?: boolean;
};

export function StarRatingInput({ value, onChange, label = "Bewertung", disabled = false }: Props) {
  return (
    <div className="star-rating-input" role="group" aria-label={label}>
      <div className="star-rating-input-row">
        {[1, 2, 3, 4, 5].map((score) => {
          const active = score <= value;
          return (
            <button
              key={score}
              type="button"
              className={`star-rating-star${active ? " star-rating-star--active" : ""}`}
              aria-label={`${score} von 5 Sternen`}
              aria-pressed={active}
              disabled={disabled}
              onClick={() => onChange(score)}
            >
              <span className="material-symbols-outlined" aria-hidden="true">
                {active ? "star" : "star_border"}
              </span>
            </button>
          );
        })}
      </div>
      {value > 0 && <p className="star-rating-input-hint">{value} von 5 Sternen</p>}
    </div>
  );
}

export function StarRatingDisplay({ score, label }: { score: number; label?: string }) {
  const rounded = Math.max(0, Math.min(5, Math.round(score)));
  return (
    <span className="star-rating-display" aria-label={label ?? `${rounded} von 5 Sternen`}>
      {Array.from({ length: 5 }, (_, index) => (
        <span
          key={index}
          className={`material-symbols-outlined star-rating-display-star${
            index < rounded ? " star-rating-display-star--active" : ""
          }`}
          aria-hidden="true"
        >
          {index < rounded ? "star" : "star_border"}
        </span>
      ))}
    </span>
  );
}
