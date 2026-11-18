import { useRef, type ComponentPropsWithoutRef } from "react";

type Props = Omit<ComponentPropsWithoutRef<"button">, "onClick" | "onTouchStart" | "onTouchEnd" | "onTouchCancel"> & {
  onActivate: (keyboard: boolean) => void;
};

export function SceneButton({ onActivate, ...props }: Props) {
  const start = useRef<{ id: number; x: number; y: number } | null>(null);
  return (
    <button {...props}
      onTouchStart={(event) => {
        const finger = event.changedTouches.item(0);
        start.current = event.touches.length === 1 && finger
          ? { id: finger.identifier, x: finger.clientX, y: finger.clientY }
          : null;
      }}
      onTouchCancel={() => { start.current = null; }}
      onTouchEnd={(event) => {
        const tap = start.current;
        start.current = null;
        if (!tap || event.currentTarget.disabled) return;
        const finger = Array.from(event.changedTouches).find((touch) => touch.identifier === tap.id);
        if (!finger || Math.hypot(finger.clientX - tap.x, finger.clientY - tap.y) > 14) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (finger.clientX < rect.left || finger.clientX > rect.right || finger.clientY < rect.top || finger.clientY > rect.bottom) return;
        // Cancel the compatibility click before navigation can replace the tapped element.
        event.preventDefault();
        onActivate(false);
      }}
      onClick={(event) => onActivate(event.detail === 0)} />
  );
}
