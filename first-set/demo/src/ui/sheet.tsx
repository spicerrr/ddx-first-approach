import { useLayoutEffect, useRef, type ReactNode } from "react";

export function Sheet({ title, close, children }: { title: string; close: () => void; children: ReactNode }) {
  const panel = useRef<HTMLElement>(null);
  const restore = useRef(document.activeElement);
  useLayoutEffect(() => { panel.current?.querySelector("button")?.focus({ preventScroll: true }); }, [title]);
  useLayoutEffect(() => () => {
    const previous = restore.current;
    queueMicrotask(() => {
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true });
    });
  }, []);
  return (
    <div className="sheet-shade" onClick={(event) => { if (event.target === event.currentTarget) close(); }}>
      <section className="sheet-panel" role="dialog" aria-modal="true" aria-labelledby="sheet-title" ref={panel}
        onKeyDown={(event) => {
          if (event.key === "Escape") close();
          if (event.key !== "Tab") return;
          const buttons = panel.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)");
          if (!buttons?.length) return;
          const first = buttons[0], last = buttons[buttons.length - 1];
          if (event.shiftKey ? document.activeElement === first : document.activeElement === last) {
            event.preventDefault();
            (event.shiftKey ? last : first).focus();
          }
        }}>
        <h2 id="sheet-title">{title}</h2>
        {children}
      </section>
    </div>
  );
}
