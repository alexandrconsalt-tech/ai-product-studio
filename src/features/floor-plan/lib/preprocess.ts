export type SourcePage = { page: number; dataUrl: string; width: number; height: number; inkScore: number };
export type PreparedSource = { original: File; pages: SourcePage[]; selectedPage: number; format: string };
export const MAX_FLOOR_PLAN_FILE_BYTES = 20 * 1024 * 1024;

function validateSource(file: File): void {
  const extension = file.name.toLowerCase().split(".").pop();
  const supported = file.type === "image/jpeg" || file.type === "image/png" || file.type === "application/pdf"
    || extension === "jpg" || extension === "jpeg" || extension === "png" || extension === "pdf";
  if (!supported) throw new Error("Поддерживаются только JPG, JPEG, PNG и PDF.");
  if (file.size <= 0) throw new Error("Файл пуст или повреждён.");
  if (file.size > MAX_FLOOR_PLAN_FILE_BYTES) throw new Error("Файл превышает максимальный размер 20 МБ.");
}

function canvasData(canvas: HTMLCanvasElement, grayscale: boolean, contrast: boolean): string {
  if (grayscale || contrast) {
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (context) {
      const image = context.getImageData(0, 0, canvas.width, canvas.height);
      for (let index = 0; index < image.data.length; index += 4) {
        let r = image.data[index], g = image.data[index + 1], b = image.data[index + 2];
        if (grayscale) r = g = b = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
        if (contrast) { r = (r - 128) * 1.12 + 128; g = (g - 128) * 1.12 + 128; b = (b - 128) * 1.12 + 128; }
        image.data[index] = r; image.data[index + 1] = g; image.data[index + 2] = b;
      }
      context.putImageData(image, 0, 0);
    }
  }
  return canvas.toDataURL("image/png");
}

function inkScore(canvas: HTMLCanvasElement): number {
  const sample = document.createElement("canvas"); sample.width = 128; sample.height = 128;
  const context = sample.getContext("2d", { willReadFrequently: true }); if (!context) return 0;
  context.drawImage(canvas, 0, 0, 128, 128); const data = context.getImageData(0, 0, 128, 128).data;
  let score = 0; for (let index = 0; index < data.length; index += 4) if ((data[index] + data[index + 1] + data[index + 2]) / 3 < 235) score += 1;
  return score / (128 * 128);
}

async function prepareImage(file: File, grayscale: boolean, contrast: boolean): Promise<SourcePage> {
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file, { imageOrientation: "from-image" }); }
  catch { throw new Error("Формат изображения не поддерживается этим браузером. Конвертируйте HEIC в JPEG/PNG или загрузите PDF."); }
  const scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas"); canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
  return { page: 1, dataUrl: canvasData(canvas, grayscale, contrast), width: canvas.width, height: canvas.height, inkScore: inkScore(canvas) };
}

async function preparePdf(file: File, grayscale: boolean, contrast: boolean): Promise<SourcePage[]> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages: SourcePage[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber); const base = page.getViewport({ scale: 1 });
    const scale = Math.min(2, 1800 / Math.max(base.width, base.height)); const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas"); canvas.width = Math.round(viewport.width); canvas.height = Math.round(viewport.height);
    const context = canvas.getContext("2d"); if (!context) throw new Error("Браузер не поддерживает Canvas 2D.");
    await page.render({ canvas, canvasContext: context, viewport }).promise;
    pages.push({ page: pageNumber, dataUrl: canvasData(canvas, grayscale, contrast), width: canvas.width, height: canvas.height, inkScore: inkScore(canvas) });
  }
  return pages;
}

export async function prepareSource(file: File, options: { grayscale: boolean; contrast: boolean }): Promise<PreparedSource> {
  validateSource(file);
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  let pages: SourcePage[];
  try { pages = isPdf ? await preparePdf(file, options.grayscale, options.contrast) : [await prepareImage(file, options.grayscale, options.contrast)]; }
  catch (error) {
    if (error instanceof Error && error.message.startsWith("Поддерживаются")) throw error;
    throw new Error(isPdf ? "PDF повреждён или не содержит доступных страниц." : "Изображение повреждено или не поддерживается браузером.");
  }
  const selectedPage = [...pages].sort((a, b) => b.inkScore - a.inkScore)[0]?.page ?? 1;
  return { original: file, pages, selectedPage, format: isPdf ? "PDF" : (file.type.split("/")[1] || file.name.split(".").pop() || "image").toUpperCase() };
}

export async function dataUrlToFile(dataUrl: string, name: string): Promise<File> {
  const blob = await (await fetch(dataUrl)).blob(); return new File([blob], name.replace(/\.[^.]+$/, "") + ".png", { type: "image/png" });
}
