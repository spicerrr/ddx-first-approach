export const benchModelUrl = import.meta.env.BASE_URL + "art/bench.glb";

let modelRequest: Promise<ArrayBuffer> | undefined;

export function benchModel() {
  modelRequest ??= fetch(benchModelUrl)
    .then((response) => {
      if (!response.ok) throw new Error("Не удалось загрузить модель скамьи.");
      return response.arrayBuffer();
    })
    .catch((error: unknown) => {
      modelRequest = undefined;
      throw error;
    });
  return modelRequest;
}
