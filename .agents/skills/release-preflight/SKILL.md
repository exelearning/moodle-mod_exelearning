---
name: release-preflight
description: Auditar preparación de una release de mod_exelearning y su ZIP, sin crear tags ni publicar por defecto.
---

# Preflight de release

Usar `docs/RELEASE_CHECKLIST.md`, `DEVELOPMENT.md` (Packaging y Versioning),
`.github/workflows/release.yml` y los scripts reales como fuente; no duplicar la
checklist completa aquí. Obtener la versión objetivo del encargo o del PR de
preparación; pedirla solo si no está determinada. Auditar no autoriza publicar.

- Revisar changelog orientado a administradores con la skill `changelog` y PRs
  fusionados; señalar omisiones sin inventar versiones o entradas.
- `version.php` real y monótona, release final, `.editor-version` y pin de Playground
  coherentes; `make check-version` y `make check-release-version RELEASE=X.Y.Z`.
- Bundle del tag correcto del editor, con assets válidos. La release se dispara por
  el cambio de `.editor-version` en main; no modificarlo para probar un workflow.
- Comprobar `scripts/check-release-workflow.sh` y `scripts/check-package.sh` si se
  audita distribución. Para verificar el artefacto real: `make package RELEASE=X.Y.Z`
  requiere metadatos de release válidos y editor construido, no marcadores `dev`.
- Inspeccionar el ZIP: raíz `exelearning/`, editor y `thirdpartylibs.xml` presentes;
  `.agents/`, `.claude/`, research, dependencias y tooling de desarrollo ausentes
  según `.distignore`. El empaquetado no cambia la versión comprometida.
- Revisar resultados de la matriz PHPUnit/Behat, Vitest, linters y los casos de
  backup/privacy/upgrade del checklist. Un resultado antiguo o no ejecutado no
  satisface el gate de la versión candidata.

Entregar PASS/FAIL/PENDIENTE con evidencia y versión/commit; solo declarar lista para
release si se cumplieron los criterios aplicables. No crear tags, publicar releases
ni mezclar un PR sin autorización del usuario; respetar la autorización ya existente.
