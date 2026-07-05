"use client";

/**
 * Per-product "Хранилище входящих данных" (input data storage): lets a
 * user attach documents (e.g. a call-quality checklist, a property
 * listing card) that become part of the input a pipeline receives when
 * testing it -- alongside the raw text/JSON in the "Вход" textarea, not
 * instead of it. Mirrors the equivalent vanilla-JS feature added to
 * public/pipeline-lab-v3.html (same localStorage key convention,
 * `aiProductStudio.inputFiles.<productId>`) so both surfaces stay
 * consistent and, if a user switches between them, see the same files.
 *
 * Only .txt/.svg are read as real text (`textExtractable: true`) --
 * there's no OCR/document parser in this MVP, so .docx/.pdf/.jpg/.png
 * are stored (as a data URL, for potential future use) but their
 * `content` is intentionally omitted from the pipeline-facing context
 * (see `storedFilesForContext`) so a prompt never hallucinates text
 * content that was never actually extracted.
 */

export type StoredInputFileFormat = "txt" | "docx" | "pdf" | "jpg" | "png" | "svg";

export type StoredInputFile = Readonly<{
  id: string;
  name: string;
  format: StoredInputFileFormat;
  sizeBytes: number;
  content: string;
  textExtractable: boolean;
  uploadedAt: string;
}>;

export const ACCEPTED_INPUT_FILE_EXTENSIONS = ".txt,.docx,.pdf,.jpg,.jpeg,.png,.svg";
export const MAX_INPUT_FILE_BYTES = 2 * 1024 * 1024;

const TEXT_EXTRACTABLE_FORMATS: readonly StoredInputFileFormat[] = ["txt", "svg"];

function detectFormat(filename: string): StoredInputFileFormat | null {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext === "txt") return "txt";
  if (ext === "docx") return "docx";
  if (ext === "pdf") return "pdf";
  if (ext === "jpg" || ext === "jpeg") return "jpg";
  if (ext === "png") return "png";
  if (ext === "svg") return "svg";
  return null;
}

function readAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error(`Не удалось прочитать файл: ${file.name}`));
    reader.readAsText(file);
  });
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error(`Не удалось прочитать файл: ${file.name}`));
    reader.readAsDataURL(file);
  });
}

export async function readFileAsStoredInputFile(file: File): Promise<StoredInputFile> {
  const format = detectFormat(file.name);
  if (!format) throw new Error(`Неподдерживаемый формат файла: ${file.name}. Поддерживаются: .txt, .docx, .pdf, .jpg, .png, .svg.`);
  if (file.size > MAX_INPUT_FILE_BYTES) throw new Error(`Файл «${file.name}» больше ${Math.round(MAX_INPUT_FILE_BYTES / 1024 / 1024)} МБ.`);
  const textExtractable = TEXT_EXTRACTABLE_FORMATS.includes(format);
  const content = textExtractable ? await readAsText(file) : await readAsDataUrl(file);
  return {
    id: `file_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: file.name,
    format,
    sizeBytes: file.size,
    content,
    textExtractable,
    uploadedAt: new Date().toISOString(),
  };
}

function storageKey(productId: string): string {
  return `aiProductStudio.inputFiles.${productId}`;
}

export function loadInputFiles(productId: string): StoredInputFile[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey(productId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveInputFiles(productId: string, files: readonly StoredInputFile[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(productId), JSON.stringify(files));
}

export type StoredFileContext = Readonly<{ name: string; format: StoredInputFileFormat; textExtractable: boolean; content?: string }>;

/** What a pipeline actually sees via `{{ctx.stored_files}}` -- content only for text-extractable formats, never a fabricated read of a binary file. */
export function storedFilesForContext(files: readonly StoredInputFile[]): readonly StoredFileContext[] {
  return files.map((file) => ({
    name: file.name,
    format: file.format,
    textExtractable: file.textExtractable,
    content: file.textExtractable ? file.content : undefined,
  }));
}
