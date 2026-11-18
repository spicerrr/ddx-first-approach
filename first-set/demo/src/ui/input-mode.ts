export type InputMode = "touch" | "mouse" | "keyboard";

export function initialInputMode(): InputMode {
  return window.matchMedia("(pointer: coarse)").matches
    || (navigator.maxTouchPoints > 0 && !window.matchMedia("(any-pointer: fine)").matches)
    ? "touch" : "mouse";
}
