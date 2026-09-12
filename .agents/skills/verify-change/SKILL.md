---
name: verify-change
description: Seleccionar y ejecutar las validaciones pertinentes para un diff de mod_exelearning, antes de subir o revisar un cambio.
---

# Verificar un cambio

Revisar el diff completo respecto a la base del PR, incluidos archivos nuevos y cambios
locales; seguir los callers del código afectado. Usar `DEVELOPMENT.md`, `Makefile` y
`.github/workflows/ci.yml` para los comandos reales. Elegir por comportamiento además
de rutas: una edición de `lib.php` puede afectar notas, paquetes o callbacks.

| Cambio | Validación |
|---|---|
| PHP | PHPUnit de los comportamientos afectados y `vendor/bin/phpcs --standard=moodle <archivos>`; PHPDoc si cambia API/docblocks |
| `js/scorm_tracker.js` o sus tests | `make test-js`; pruebas PHP de tracking si cambia el contrato |
| `amd/src/` | Grunt AMD desde el checkout Moodle, limitado a `mod/exelearning`; revisar y guardar `amd/build/`; Behat del flujo |
| `db/`, datos de usuario o fileareas | `moodle-upgrade`; `moodle-plugin-ci validate` y `savepoints`; instalación/upgrade y backup/privacy afectados |
| `classes/external/` o `db/services.php` | `tests/external_test.php`, validación de parámetros/contexto/capacidades y retorno con `clean_returnvalue` |
| Strings, settings o metadatos cacheables | PHPCS y política de versión en DEVELOPMENT; `make check-version` |
| Templates o comportamiento visible | Mustache/Grunt según CI y escenarios Behat relevantes; justificar si PHPUnit ya cubre el cambio sin flujo UI |
| Paquetes/editor/release | Skill del área; comprobaciones de empaquetado si cambia la distribución |
| Solo Markdown/skills | Frontmatter, enlaces locales, descubrimiento y procedencia; no reconstruir el editor ni añadir tests de aplicación |
| Workflows | `actionlint <workflow>` y revisión de triggers, permisos e inputs |

PHPUnit local: `make test ARGS=mod/exelearning/tests/track_test.php` (ejemplo;
elegir el archivo adecuado). No pasar el directorio completo. Si hay desajuste de
versión del entorno de prueba, reinicializar con
`docker compose exec moodle php /var/www/html/admin/tool/phpunit/cli/init.php`.
No inicializar un sitio de producción para ejecutar tests.

Los fixtures reales están en `tests/fixtures/` y `research/fixtures/elpx/`;
el generador en `tests/generator/lib.php`. Los cambios de comportamiento añaden
regresiones significativas, sin excluir código testeable para mejorar cobertura.

Informar comando y resultado, fallos o dependencias ausentes. Distinguir comprobaciones
no aplicables de pendientes; no convertir una suite no ejecutada en PASS. La selección
local no elimina jobs de CI ni los criterios completos de una release.
