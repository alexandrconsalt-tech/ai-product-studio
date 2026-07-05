"use client";

import * as React from "react";
import { FileText, Trash2, Upload } from "lucide-react";
import { Alert, Badge } from "@/shared/ui";
import { ACCEPTED_INPUT_FILE_EXTENSIONS, loadInputFiles, readFileAsStoredInputFile, saveInputFiles, type StoredInputFile } from "@/shared/lib/input-file-storage";

export type InputFileStoragePanelProps = Readonly<{
  productId: string;
  onFilesChange?: (files: readonly StoredInputFile[]) => void;
}>;

/**
 * "Хранилище входящих данных": lets a user attach documents (a call-quality
 * checklist, a property listing card, etc.) that become part of the input a
 * pipeline receives when testing it. Reused as-is by every product's
 * Playground "Вход" card so the feature is consistent everywhere, not
 * product-specific.
 */
export function InputFileStoragePanel({ productId, onFilesChange }: InputFileStoragePanelProps) {
  const [files, setFiles] = React.useState<StoredInputFile[]>(() => loadInputFiles(productId));
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const onFilesChangeRef = React.useRef(onFilesChange);
  onFilesChangeRef.current = onFilesChange;

  React.useEffect(() => {
    const loaded = loadInputFiles(productId);
    setFiles(loaded);
    onFilesChangeRef.current?.(loaded);
  }, [productId]);

  const persist = (next: StoredInputFile[]) => {
    setFiles(next);
    saveInputFiles(productId, next);
    onFilesChangeRef.current?.(next);
  };

  const handleUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setError(null);
    try {
      const added = await Promise.all([...fileList].map(readFileAsStoredInputFile));
      persist([...files, ...added]);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Не удалось загрузить файл.");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const removeFile = (id: string) => persist(files.filter((file) => file.id !== id));

  return (
    <div className="grid gap-2 border-t border-border pt-3">
      <p className="text-xs font-medium text-text-muted">Хранилище входящих данных</p>
      <p className="text-xs text-text-muted">Загрузите документы (чек-лист, карточку объекта и т.п.) — их содержимое станет частью входных данных для пайплайна. Форматы: .txt, .docx, .pdf, .jpg, .png, .svg (до 2 МБ).</p>
      <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-xs hover:bg-hover">
        <Upload className="size-3.5" aria-hidden="true" />
        Загрузить файл
        <input ref={inputRef} type="file" multiple accept={ACCEPTED_INPUT_FILE_EXTENSIONS} className="hidden" onChange={(event) => void handleUpload(event.target.files)} />
      </label>
      {error ? <Alert tone="warning">{error}</Alert> : null}
      {files.length > 0 ? (
        <div className="grid gap-1">
          {files.map((file) => (
            <div key={file.id} className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface px-3 py-2 text-xs">
              <div className="flex min-w-0 items-center gap-2">
                <FileText className="size-3.5 shrink-0 text-text-muted" aria-hidden="true" />
                <span className="truncate">{file.name}</span>
                <Badge tone="neutral">{file.format}</Badge>
                {!file.textExtractable ? <Badge tone="warning">содержимое не распознаётся</Badge> : null}
              </div>
              <button type="button" className="shrink-0 text-text-muted hover:text-error" aria-label={`Удалить ${file.name}`} onClick={() => removeFile(file.id)}>
                <Trash2 className="size-3.5" aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
