"use client";

import FileUpload from "@/components/kokonutui/file-upload";

export interface BulkTarget {
  url?: string;
  html?: string;
  label: string;
}

/** URL из строки CSV/TXT; поддерживает колонку со списком и голые адреса. */
function extractUrl(line: string): string | null {
  const candidates = line.split(/[,;\t]+/).map((part) => part.trim());
  for (const candidate of candidates) {
    if (/^(https?:\/\/)?[\w-]+(\.[\w-]+)+([/?#].*)?$/i.test(candidate)) {
      return candidate;
    }
  }
  return null;
}

/**
 * Массовая проверка: file-upload принимает CSV/TXT со списком URL
 * или HTML-файл; каждый файл разбирается и уходит на сканирование.
 */
export default function BulkUpload({
  onScan,
  maxFiles = 3,
}: {
  onScan: (target: BulkTarget) => Promise<void>;
  maxFiles?: number;
}) {
  const handleFile = async (
    file: File,
    helpers: { onProgress: (percent: number) => void }
  ) => {
    helpers.onProgress(15);
    const text = await file.text();
    helpers.onProgress(35);

    if (/\.html?$/i.test(file.name)) {
      helpers.onProgress(60);
      await onScan({ html: text, label: file.name });
      helpers.onProgress(100);
      return;
    }

    const urls = Array.from(
      new Set(
        text
          .split(/\r?\n/)
          .map((line) => extractUrl(line))
          .filter((url): url is string => Boolean(url))
      )
    ).slice(0, 10);

    if (!urls.length) {
      throw new Error("В файле не найдено ни одного URL");
    }

    for (let index = 0; index < urls.length; index += 1) {
      await onScan({ url: urls[index], label: urls[index] });
      helpers.onProgress(35 + Math.round(((index + 1) / urls.length) * 65));
    }
  };

  return (
    <FileUpload
      acceptedFileTypes={[".csv", ".txt", ".html", ".htm"]}
      maxFileSize={2 * 1024 * 1024}
      maxFiles={maxFiles}
      multiple
      onUpload={handleFile}
    />
  );
}
