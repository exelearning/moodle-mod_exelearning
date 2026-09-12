---
name: elpx-package
description: Modificar parsing de content.xml, extracción, reemplazo o servido de paquetes ELPX del plugin Moodle.
---

# Paquetes ELPX

Leer `docs/ELPX_PACKAGE.md`; contrastar con `classes/local/package.php`,
`package_manager.php`, `zip_utils.php`, `mod_form.php` y los callers de `lib.php`
y `editor/save.php`. Archivo válido: ZIP v4 con `content.xml` raíz, sea `.elpx` o `.zip`.

- Usar el packer/File API de Moodle y las comprobaciones de rutas existentes.
  Validar contenido real, no fiarse de extensión/MIME. No crear otro extractor.
- La revisión nueva se guarda y valida antes de activar el puntero y podar la
  anterior. Un fallo elimina solo lo recién preparado; preservar paquete, contenido,
  revisión y notas previos. Reutilizar `store_and_activate_revision()` donde aplique.
- DOM por `local-name()` conserva namespaces, CDATA y orden; mantener el fallback
  controlado para XML malformado y las pruebas con exports reales.
- Aceptar `DOCTYPE ... SYSTEM "content.dtd"` sin resolverlo: `LIBXML_NONET`, sin
  `LIBXML_DTDLOAD` ni `LIBXML_NOENT`; conservar defensa frente a entidades internas.
  No rechazar todos los DOCTYPE ni habilitar expansión para arreglar un fixture.
- Detectar por `isScorm > 0`, DataGame cifrado y marcador GeoGebra según el parser,
  no por la lista histórica de tipos. Preservar objectid y hash semántico que ignora
  metadatos volátiles de exportación.
- Servir mediante el callback/File API con contexto y acceso del área; no exponer
  rutas del dataroot. Consultar el contrato SCORM antes de alterar inyecciones o sandbox.

Elegir tests de `package_test.php`, `package_legacy_test.php`, `zip_utils_test.php`,
`lib_extract_test.php`, `local/package_manager*_test.php` y regresiones de notas
cuando cambie detección/sync. Incluir fallo de reemplazo que conserva el estado anterior.
