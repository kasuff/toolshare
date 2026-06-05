import type { ReactNode } from "react";

type Props = {
  onBack: () => void;
  backLabel?: string;
  children?: ReactNode;
};

export function DetailTopBar({ onBack, backLabel = "← Zurück", children }: Props) {
  return (
    <div className="detail-topbar">
      <button type="button" onClick={onBack} className="back-button">
        {backLabel}
      </button>
      {children ? <div className="detail-topbar-actions">{children}</div> : null}
    </div>
  );
}
