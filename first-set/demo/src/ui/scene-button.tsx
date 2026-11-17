import { useRef, type ComponentPropsWithoutRef } from "react";

type Props = Omit<ComponentPropsWithoutRef<"button">, "onClick"> & { onActivate: () => void };

export function SceneButton({ onActivate, ...props }: Props) {
  const start = useRef<{ id: number; x: number; y: number } | null>(null);
  const handled = useRef(false);
  return (
    <button {...props}
      onPointerDown={(event) => {
        handled.current = false;
        start.current = event.pointerType === "touch" && event.isPrimary
          ? { id: event.pointerId, x: event.clientX, y: event.clientY }
          : null;
      }}
      onPointerCancel={() => { start.current = null; }}
      onPointerUp={(event) => {
        const tap = start.current;
        start.current = null;
        if (!tap || tap.id !== event.pointerId || Math.hypot(event.clientX - tap.x, event.clientY - tap.y) > 14) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) return;
        // A touch tap can arrive without a compatibility click after a captured drag.
        handled.current = true;
        onActivate();
      }}
      onClick={(event) => {
        if (handled.current && event.detail > 0) {
          handled.current = false;
          return;
        }
        onActivate();
      }} />
  );
}
