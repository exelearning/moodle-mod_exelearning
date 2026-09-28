---
id: DEC-159-01
title: "Propósito del módulo: MOD_PURPOSE_INTERACTIVECONTENT como primario y ASSESSMENT como secundario"
status: Accepted
date: 2026-09-28
tracking_issue: 159
supersedes: [DEC-37-01]
deciders:
  - erseco
  - claude-code
sources:
  - REPO-004
related:
  adrs: [DEC-13-07, DEC-0-15]
ai_assistance:
  tool: claude-code
  model: claude-opus-5-5
---

# DEC-159-01: Propósito del módulo: MOD_PURPOSE_INTERACTIVECONTENT como primario y ASSESSMENT como secundario

## Contexto

`DEC-37-01` mantuvo `MOD_PURPOSE_ASSESSMENT` comparándolo solo con `RESOURCE`/`CONTENT`.
No valoró `MOD_PURPOSE_INTERACTIVECONTENT`, que es el propósito que core usa para los
módulos más parecidos. Como efecto secundario, el propósito teñía el icono de rosa
(exelearning/exelearning issue 2453); `exelearning_is_branded()` ya lo evita, así que el
propósito solo decide dónde aparece la actividad en el selector y en su filtro por
propósito. La propuesta es el issue exelearning/exelearning#2454 (los issues del plugin
se centralizan allí); como no hay issue en este repositorio, el ADR usa el número del
PR 159.

## Evidencia

Consultado en `moodle/moodle` el 2026-09-28 (`gh api repos/moodle/moodle/contents/...`):

- `FEATURE_MOD_OTHERPURPOSE` se define en `public/lib/moodlelib.php:488` de
  `MOODLE_501_STABLE` y `lib/moodlelib.php:488` de `MOODLE_502_STABLE`; no existe en
  `MOODLE_405_STABLE` ni en `MOODLE_500_STABLE`.
- `MOD_PURPOSE_INTERACTIVECONTENT` existe en todas las ramas soportadas (4.5–5.2).
- `public/mod/h5pactivity/lib.php:58-59` (`MOODLE_501_STABLE`) declara
  `FEATURE_MOD_PURPOSE => MOD_PURPOSE_INTERACTIVECONTENT` y
  `FEATURE_MOD_OTHERPURPOSE => MOD_PURPOSE_ASSESSMENT`, sin archetype propio.

| Módulo | Propósito primario | Secundario (5.1+) |
|---|---|---|
| `mod_scorm` | `INTERACTIVECONTENT` | `CONTENT` |
| `mod_h5pactivity` | `INTERACTIVECONTENT` | `ASSESSMENT` |
| `mod_lesson` | `INTERACTIVECONTENT` | `ASSESSMENT` |

## Decisión

- Propósito primario: `MOD_PURPOSE_INTERACTIVECONTENT`.
- Propósito secundario: `MOD_PURPOSE_ASSESSMENT`, como H5P y Lesson. `CONTENT` (el de
  SCORM) encaja peor: el plugin califica por iDevice y sincroniza con el gradebook.
- `FEATURE_MOD_OTHERPURPOSE` se comprueba con `defined()` antes del `switch` de
  `exelearning_supports()`. Evaluar la constante como `case` lanzaría un `Error` en 4.5
  y 5.0 para cualquier feature no reconocida.
- Se retira `MOD_ARCHETYPE_ASSIGNMENT` y el módulo usa el archetype por defecto
  (`MOD_ARCHETYPE_OTHER`), como SCORM, H5P, Lesson y la propia Tarea. En 4.5 y 5.0 el
  selector reparte las pestañas por archetype: `course/amd/src/activitychooser.js:261-262`
  (imagen `erseco/alpine-moodle:v5.0.7`) filtra "Actividades" con `archetype === 0` y
  "Recursos" con `archetype === 1`. Con el valor 2 el módulo solo salía en "Todos".
  Core no usa `MOD_ARCHETYPE_ASSIGNMENT` en ningún otro sitio (solo lo define en
  `lib/moodlelib.php:481`), así que los valores por defecto de grupos y finalización
  que citaba `DEC-37-01` vienen de sus propias features, no del archetype.

## Consecuencias

- **Positivas:** la actividad aparece junto a SCORM y H5P, que es donde la buscan los
  docentes; en 4.5 y 5.0 vuelve a salir en la pestaña "Actividades"; sigue la taxonomía
  de core; en 5.1+ también aparece bajo evaluación.
- **Negativas:** en 4.5 y 5.0 solo aparece como contenido interactivo. En sitios
  existentes la actividad cambia de categoría en el selector.
- **Sin riesgo visual:** el icono es de marca y no se tiñe.

## Validación

`tests/supports_test.php` fija el archetype por defecto, el propósito primario y, cuando la constante existe, el
secundario (en 4.5 y 5.0 ese caso se omite). La matriz de CI cubre 4.5–5.2.
