---
name: gradebook-tracking
description: Cambiar o depurar SCORM, intentos, gradebook, completion y servicios de tracking de mod_exelearning.
---

# Notas y tracking

Seguir `view.php` / `js/scorm_tracker.js` → `track.php` /
`classes/local/tracking_endpoint.php` → `classes/local/track.php` →
`classes/local/attempts.php` y `classes/grades/`. `classes/external/save_track.php`
reutiliza `track::ingest()`. Leer `docs/GRADEBOOK.md` para columnas/recálculo y
`docs/TRACKING.md` / `docs/scorm-shim-current-flow.md` para ingesta/bridge.
`docs/tracking-architecture.md` explica la retirada de xAPI (DEC-122-01).

Invariantes que deben sobrevivir:

- `objectid` estable → `itemnumber` estable, no índice local de página. Reaparición
  conserva número; desaparición marca borrado sin perder historia. Tope de 100
  columnas y strings `grade_idevice1_name`…`grade_idevice100_name` más overall.
- `peritem` solo tiene columnas por iDevice: no crear un overall oculto/excluido
  (modelo histórico sustituido por DEC-25-01). `overall` solo publica itemnumber 0.
- Preview autorizado no persiste; el cliente no elige identidad ni crea grade items.
  Filtrar `itemscores` a objectids de la instancia, limitar tamaño, normalizar y
  acotar notas; recomputar overall con las ponderaciones del contrato actual.
- Un `sessiontoken` agrupa commits del mismo intento; preservar lock, límite de
  intentos y agregaciones highest/average/first/last/lowest.
- Las filas `gradable = 0` registran participación, pero no se convierten en notas
  ni consumen el cupo de intentos evaluables (DEC-124-03). Comprobar código y tests
  si algún documento anterior dice que al activar notas se recalcula toda la historia.
- Mantener completion por nota y por estado; no convertir estado sin score en cero.
  Cambio de modelo, borrado de intentos y privacy deben recalcular coherentemente.
- Sesión, sesskey en el cuerpo JSON y permisos por actividad en web; validación de
  parámetros/contexto/capacidades y esquema de retorno en servicios externos.
  SCORM del navegador y móvil comparten reglas sin duplicarlas.

Tests candidatos: `track_test.php`, `attempts_test.php`, `grades_test.php`,
`grademodel_test.php`, `completion_test.php`, `external_test.php`,
`local/tracking_endpoint_test.php` y `tests/js/scorm_tracker.test.js`.
Elegir según el cambio; para el flujo visible reutilizar Behat de notas.
