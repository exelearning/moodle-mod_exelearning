# mod_exelearning

Módulo de actividad Moodle para paquetes eXeLearning v4 (`.elpx` o `.zip` con
`content.xml`). Compatibilidad: `version.php` y la matriz de `.github/workflows/ci.yml`
(Moodle 4.5–5.2, PHP mínimo 8.1). No elevar mínimos para seguir un ejemplo externo.

## Orientación

- `lib.php` expone callbacks; la implementación vive en `classes/local/` y `classes/grades/`.
- `view.php` + `js/scorm_tracker.js` → `track.php` → `classes/local/track.php` →
  intentos, gradebook y finalización. La API móvil comparte `track::ingest()`.
- `classes/local/package.php` interpreta el manifiesto; `package_manager.php` gestiona
  revisiones y extracción; `editor/` integra el editor precompilado de `dist/static/`.
- El código y los tests son la autoridad del comportamiento. Consultar
  [ARCHITECTURE](docs/ARCHITECTURE.md) y los documentos del área; los ADRs históricos
  pueden describir caminos sustituidos. No cargar todo `research/` de entrada.

## Reglas del proyecto

- SCORM 1.2 es el único canal de tracking del navegador (DEC-122-01). No restaurar
  xAPI, LRS, cmi5 ni eXeLearning Online sin un cambio explícito de alcance.
- Preservar sidebar nativa, separación preview/grading y permisos por actividad.
  El sandbox same-origin tiene riesgos aceptados y dependencias reales del bridge;
  consultar [TRACKING](docs/TRACKING.md) antes de cambiar permisos del iframe.
- Solo ODE 2.0 v4; no `.elp` legacy ni `iteexe_online`. No incorporar repositorios
  externos al código del plugin. La instalación autorizada de skills en `.agents/`
  es tooling excluido del ZIP, no una dependencia de producción.
- Los cambios de comportamiento incluyen tests de regresión, caso feliz y bordes
  relevantes: PHPUnit para PHP y Vitest para el tracker. Elegir las comprobaciones
  mediante `verify-change`; documentación sola no necesita tests de aplicación nuevos.
- Código y comentarios en inglés; `research/` en español. Usar strings traducibles,
  con claves de `lang/en/exelearning.php` en orden alfabético estricto, sin generarlas
  mediante bucles en runtime. ATE significa Área de Tecnología Educativa.
- PHPCS: `vendor/bin/phpcs --standard=moodle <archivos>` debe quedar en 0/0; no usar
  el ruleset local para ocultar errores. PHPDoc completo; explicar decisiones no
  triviales junto al código y citar el DEC/FTE aplicable.
- Regenerar `amd/build/` con Grunt de Moodle después de editar `amd/src/`; nunca a mano.
  `js/scorm_tracker.js` mantiene `window.API` síncrona y se prueba con Vitest, no Jest.
- `version.php` lleva una versión real y monótona; `release = 'dev'` en desarrollo.
  Aplicar [DEVELOPMENT](DEVELOPMENT.md#versioning-and-releases) cuando Moodle deba
  detectar cambios en código o metadatos. No usar centinelas ni cambiar la versión
  por una edición exclusivamente documental.
- Ramas en inglés con `feature/` o `hotfix/`. Las instrucciones del usuario sobre
  publicación y mezcla se mantienen durante la tarea; una skill no amplía permisos.

## Skills por tarea

Leer solo las que correspondan. Las propias contienen invariantes locales; las
externas aportan ejemplos generales y no sustituyen el código ni la documentación oficial.

| Skill en `.agents/skills/` | Cuándo usarla |
|---|---|
| [verify-change](.agents/skills/verify-change/SKILL.md) | Seleccionar y ejecutar validaciones del diff |
| [moodle-upgrade](.agents/skills/moodle-upgrade/SKILL.md) | XMLDB, savepoints, versiones y ciclo de datos |
| [gradebook-tracking](.agents/skills/gradebook-tracking/SKILL.md) | Notas, intentos, completion, endpoint y servicios de tracking |
| [elpx-package](.agents/skills/elpx-package/SKILL.md) | Parsing, extracción, sustitución y servido de paquetes |
| [embedded-editor](.agents/skills/embedded-editor/SKILL.md) | Bootstrap, guardado y distribución del editor |
| [behat-test](.agents/skills/behat-test/SKILL.md) | Escenarios Moodle y pruebas de flujos visibles |
| [release-preflight](.agents/skills/release-preflight/SKILL.md) | Auditar preparación de una release, sin publicarla |
| [changelog](.agents/skills/changelog/SKILL.md) | Borrador del changelog basado en PRs fusionados |
| [moodle-phpunit-testing](.agents/skills/moodle-phpunit-testing/SKILL.md) | Patrones PHPUnit; ejecutar con el harness de este proyecto |
| [moodle-amd-javascript](.agents/skills/moodle-amd-javascript/SKILL.md) | AMD de Moodle, no tracker ni editor upstream |
| [github-actions-hardening](.agents/skills/github-actions-hardening/SKILL.md) | Crear o revisar workflows y sus permisos |

Antes de usar ejemplos externos, leer los límites de compatibilidad en
[external-skills](.agents/references/external-skills.md). Conservar las skills
instaladas con `gh skills` sin modificaciones; las correcciones locales viven fuera
para que las actualizaciones no las borren. `.claude/skills/` contiene enlaces a la
misma copia canónica; `CLAUDE.md` dirige aquí.

El workflow `update-agent-skills.yml` propone actualizaciones los lunes o manualmente.
Revisar contenido, procedencia y licencias del diff; no mezclar automáticamente.
Los PRs creados con `GITHUB_TOKEN` no activan CI automáticamente. Preferencia del
mantenedor: acciones por etiquetas, nunca SHA; checkout `v7`, create-pull-request `v8`
y update-agent-skills `v13.3.3` hasta que upstream publique la etiqueta flotante `v13`.

## Documentación y comandos

[DEVELOPMENT](DEVELOPMENT.md) contiene los comandos; Makefile y CI resuelven discrepancias.
`make test ARGS=mod/exelearning/tests/track_test.php`, `make test-js`, `make check-version`.
No apuntar PHPUnit al directorio completo del plugin: su `vendor/` puede colisionar.

Para decisiones arquitectónicas, leer [research/AGENTS.md](research/AGENTS.md) y
[la guía de decisiones](research/decisiones/README.md). Identificadores por issue/PR,
no un contador global; no reescribir ADRs históricos. Regenerar índices cuando cambien
registros. Para APIs consultar Context7 y la documentación oficial de la versión soportada.

Actualizar esta guía cuando cambien la arquitectura, los comandos o el catálogo de skills;
el historial de sesiones y estados ya está en Git y `research/`, no se duplica aquí.
