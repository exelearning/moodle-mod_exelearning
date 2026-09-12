---
name: behat-test
description: Crear o depurar escenarios Behat de profesor, alumno y administración en mod_exelearning.
---

# Behat del plugin

Leer el escenario más cercano en `tests/behat/` y los pasos existentes en
`tests/behat/behat_mod_exelearning.php`. Usar `@mod_exelearning`; `@javascript` cuando
el flujo requiera navegador/JS. Reutilizar generadores de cursos, usuarios,
matrículas y `tests/generator/lib.php` con fixtures reales.

El paso `the following eXeLearning SCORM scores exist` siembra notas por la ingesta
real para probar informes de forma determinista; no demuestra que el bridge JS haya
funcionado. Si cambia el bridge, ejercitar también el iframe `exelearningobject` y
el tracker, con el usuario/permiso correcto. Volver al frame padre cuando corresponda.

Esperar por estado observable/pending de Moodle, no introducir sleeps para ocultar
carreras. Buscar pasos core antes de añadir uno propio. Si se necesitan entidades
custom, su registro pertenece a una clase `behat_*_generator` en `tests/generator/`,
no a un método `get_creatable_entities` suelto en el contexto de pasos.

Ejecutar en un Moodle de pruebas con Selenium y configuración Behat inicializada:
`vendor/bin/behat --tags @mod_exelearning` (o feature/escenario afectado con su config).
CI usa `moodle-plugin-ci behat --profile chrome`; consultar `DEVELOPMENT.md`.
Regenerar configuración con `admin/tool/behat/cli/init.php` tras cambiar pasos/features.
No afirmar que un fixture sembrado prueba una interacción real del navegador.
