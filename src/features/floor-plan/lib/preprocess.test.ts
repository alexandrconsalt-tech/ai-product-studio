// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { MAX_FLOOR_PLAN_FILE_BYTES, prepareSource } from "./preprocess";

describe("prepareSource validation", () => {
  it("отклоняет неподдерживаемый формат до декодирования", async () => {
    await expect(prepareSource(new File(["x"], "plan.webp", { type: "image/webp" }), { grayscale: false, contrast: false })).rejects.toThrow("JPG, JPEG, PNG и PDF");
  });

  it("отклоняет пустой и слишком большой файл", async () => {
    await expect(prepareSource(new File([], "plan.png", { type: "image/png" }), { grayscale: false, contrast: false })).rejects.toThrow("пуст");
    const large = new File([new Uint8Array(MAX_FLOOR_PLAN_FILE_BYTES + 1)], "plan.jpg", { type: "image/jpeg" });
    await expect(prepareSource(large, { grayscale: false, contrast: false })).rejects.toThrow("20 МБ");
  });
});
