import { stations } from "./scenario";

const key = "ddx-first-approach-completed-v1";

export function readCompletedStations() {
  try {
    const count = Number(localStorage.getItem(key));
    return Number.isInteger(count) && count >= 0 && count <= stations.length ? count : 0;
  } catch {
    return 0;
  }
}

export function saveCompletedStations(count: number) {
  try {
    if (count > 0) localStorage.setItem(key, String(count));
    else localStorage.removeItem(key);
  } catch {
    // The route still works during this visit when browser storage is unavailable.
  }
}
