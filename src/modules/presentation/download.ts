export function createTranslationDownload(content: string) {
  return {
    fileName: "gms-translation.txt",
    mimeType: "text/plain;charset=utf-8",
    content
  };
}

export function downloadTranslation(content: string) {
  const download = createTranslationDownload(content);
  const blob = new Blob([download.content], { type: download.mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = download.fileName;
  link.click();
  URL.revokeObjectURL(url);
}
