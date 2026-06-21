import type { ReactNode } from "react";
import { Link, type To } from "react-router-dom";

type Props = {
  name: string;
  description: string;
  imageUrl?: string;
  statusLabel?: string;
  statusUnavailable?: boolean;
  meta: string;
  ownerName: string;
  to?: To;
  onSelect?: () => void;
  fallbackIcon?: ReactNode;
};

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function OfferCard({
  name,
  description,
  imageUrl,
  statusLabel,
  statusUnavailable = false,
  meta,
  ownerName,
  to,
  onSelect,
  fallbackIcon
}: Props) {
  const content = (
    <>
      <div className="ds-workshop-card-media">
        {statusLabel && (
          <span className={`ds-workshop-card-badge ${statusUnavailable ? "unavailable" : ""}`.trim()}>
            {statusLabel}
          </span>
        )}
        {imageUrl ? (
          <img className="ds-workshop-card-image" src={imageUrl} alt={name} />
        ) : (
          <div className="ds-workshop-card-icon" aria-label={name} title={name}>
            {fallbackIcon ?? <span className="material-symbols-outlined">construction</span>}
          </div>
        )}
      </div>
      <div className="ds-workshop-card-body">
        <div className="ds-workshop-card-distance">{meta}</div>
        <h3>{name}</h3>
        <p className="ds-workshop-card-description">{description}</p>
        <div className="ds-workshop-card-divider" />
        <div className="ds-workshop-card-footer">
          <div className="ds-workshop-card-owner">
            <span className="ds-workshop-card-avatar">{getInitials(ownerName)}</span>
            <span>{ownerName}</span>
          </div>
          <span className="ds-workshop-card-details">Details</span>
        </div>
      </div>
    </>
  );

  if (to) {
    return (
      <Link to={to} className="ds-workshop-card card-enter card-link">
        {content}
      </Link>
    );
  }

  return (
    <article className="ds-workshop-card card-enter">
      <button
        type="button"
        className="offer-card-activation"
        onClick={onSelect}
        aria-label={`${name}: Details anzeigen`}
      />
      {content}
    </article>
  );
}
