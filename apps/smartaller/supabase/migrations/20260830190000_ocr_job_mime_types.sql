-- Jobs OCR de carga masiva se guardan como JSON en el mismo bucket de PDFs.
update storage.buckets
set allowed_mime_types = array[
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
  'text/plain',
  'application/json'
]
where id = 'vehiculos-documentos';
