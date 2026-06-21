import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";

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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const menuId = useId();

  const closeMenu = (restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) {
      window.requestAnimationFrame(() => triggerRef.current?.focus());
    }
  };

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        closeMenu();
      }
    };
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") closeMenu(true);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      itemRefs.current.find((item) => item && !item.disabled)?.focus();
    }
  }, [open]);

  const handleMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const enabledItems = itemRefs.current.filter((item): item is HTMLButtonElement => Boolean(item && !item.disabled));
    if (enabledItems.length === 0) return;
    const currentIndex = enabledItems.findIndex((item) => item === document.activeElement);
    let nextIndex = currentIndex;
    if (event.key === "ArrowDown") nextIndex = (currentIndex + 1) % enabledItems.length;
    else if (event.key === "ArrowUp") nextIndex = currentIndex <= 0 ? enabledItems.length - 1 : currentIndex - 1;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = enabledItems.length - 1;
    else if (event.key === "Tab") {
      closeMenu();
      return;
    } else {
      return;
    }
    event.preventDefault();
    enabledItems[nextIndex].focus();
  };

  return (
    <div className={`kebab-menu kebab-menu--${align}`} ref={rootRef}>
      <button
        ref={triggerRef}
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
        <div id={menuId} className="kebab-menu-panel" role="menu" tabIndex={-1} onKeyDown={handleMenuKeyDown}>
          {items.map((item, index) => (
            <button
              ref={(element) => {
                itemRefs.current[index] = element;
              }}
              key={item.id}
              type="button"
              role="menuitem"
              className="kebab-menu-item"
              disabled={item.disabled}
              onClick={() => {
                if (item.disabled) return;
                closeMenu(true);
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
