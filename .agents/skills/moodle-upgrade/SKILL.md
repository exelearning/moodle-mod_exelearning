---
name: moodle-upgrade
description: Modificar XMLDB, upgrade.php, versiones o metadatos registrables de mod_exelearning y comprobar su ciclo de datos.
---

# Upgrade de mod_exelearning

Leer `DEVELOPMENT.md` (Versioning and releases), `db/install.xml`, `db/upgrade.php`,
`version.php` y `scripts/check-version.sh`. Mantener Moodle 4.5/PHP 8.1 como mínimo.
No confundir `$plugin->requires` (compatibilidad) con `$plugin->version` (upgrade).

- Para una modificación de esquema, mantener instalación limpia y ruta de upgrade
  equivalentes. Usar XMLDB y el estilo de las etapas existentes, con comprobaciones
  de existencia cuando permitan reintentar una migración parcial.
- Añadir etapas; no borrar ni reescribir las históricas. Cada guard `$oldversion < N`
  culmina con `upgrade_mod_savepoint(true, N, 'exelearning')` tras el trabajo correcto.
- Elegir una versión real `YYYYMMDDXX`, mayor que la publicada y que los guards y
  savepoints, según el comprobador local. `release` permanece `dev` salvo preparación
  explícita de release; el packager valida y no reescribe `version.php`.
- También requieren detección de versión los cambios cacheables enumerados en
  DEVELOPMENT (clases, JS, strings, settings, capacidades, servicios, tareas).
  No elevar la versión por documentación/skills exclusivamente.

Si cambia un dato personal, tabla o filearea, seguir el dato por
`classes/privacy/provider.php`, `backup/moodle2/`, borrado/reset de actividad y
`docs/PRIVACY_BACKUP_FILES.md`. Declarar metadatos no implementa exportación/borrado.
Probar los tres caminos de borrado y el recálculo de notas; backup con/sin `userinfo`,
remapeo de usuarios y categorías, y no resucitar datos retirados. `gradesyncrev` se
omite deliberadamente para forzar el reescaneo tras restore.

Para servicios: `db/services.php` registra, pero no sustituye `validate_parameters`,
`validate_context` y permisos dentro de `execute`. `save_track` comparte la ingesta,
no introduce un segundo motor de notas.

Validar `make check-version`, `moodle-plugin-ci validate`, `moodle-plugin-ci savepoints`,
instalación/upgrade y tests de datos afectados (`backup_restore_test.php`,
`privacy/provider_test.php`, `external_test.php` según alcance). Reinicializar PHPUnit
cuando cambie el esquema/versión/capacidades. Un cambio destructivo requiere alcance
explícito, estrategia de datos y decisión documentada; no ejecutarlo en un sitio real
por el mero hecho de preparar código de upgrade.
