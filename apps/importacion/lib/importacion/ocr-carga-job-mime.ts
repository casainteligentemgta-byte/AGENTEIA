/** El bucket `vehiculos-documentos` no admite application/json. */
export const OCR_JOB_CONTENT_TYPES = [
  "text/plain",
  "application/pdf",
  "application/json",
] as const;

export function isStorageMimeRejected(message: string): boolean {
  return /mime type|not supported|invalid.*content.?type|allowed_mime/i.test(
    message
  );
}
