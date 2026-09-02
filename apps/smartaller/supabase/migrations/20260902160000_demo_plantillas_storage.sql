-- Plantillas PDF de la demo SmartImport (ya viven en la nube).
-- Ruta: vehiculos-documentos/demo-plantillas/{tipo}.pdf
-- El primer folder NO es taller_id; la política de taller no las vería.

drop policy if exists "vehiculos-docs select demo plantillas" on storage.objects;
create policy "vehiculos-docs select demo plantillas"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'vehiculos-documentos'
    and name like 'demo-plantillas/%'
  );
