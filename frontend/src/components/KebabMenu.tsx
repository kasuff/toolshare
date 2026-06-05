import { useEffect, useId, useRef, useState, type ReactNode } from "react";

export type KebabMenuItem = {
  id: string;
  label: string;
  onSelect: () => void;
  disabled?: boolean;
};

type Props = {
  items: KebabMenuItem[];
  ariaLabel?: string;
  align?: "left" | "right";
  trigger?: ReactNode;
};

export function KebabMenu({ items, ariaLabel = "Weitere Aktionen", align = "right", trigger }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className={`kebab-menu kebab-menu--${align}`} ref={rootRef}>
      <button
        type="button"
        className="kebab-menu-trigger icon-button"
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((prev) => !prev)}
      >
        {trigger ?? <span className="material-symbols-outlined">more_vert</span>}
      </button>
      {open && (
        <div id={menuId} className="kebab-menu-panel" role="menu">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              className="kebab-menu-item"
              disabled={item.disabled}
              onClick={() => {
                if (item.disabled) return;
                setOpen(false);
                item.onSelect();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
