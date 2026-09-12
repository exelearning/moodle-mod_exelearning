---
name: embedded-editor
description: Modificar la integración del editor embebido de mod_exelearning, su bootstrap, guardado o distribución.
---

# Editor embebido

Entradas: `editor/index.php`, `editor/static.php`, `editor/save.php`, `editor/styles.php`;
resolución en `classes/local/embedded_editor_source_resolver.php` y `editor_paths.php`.
Leer los tests del resolver, rutas y estilos antes de cambiar contratos.

El editor se distribuye precompilado en `dist/static/` (DEC-106-01), no se instala
ni actualiza desde el Moodle en ejecución. Respetar el interruptor global del editor
(modo reproductor, DEC-108-01); no recuperar instalador runtime ni modo Online/HMAC.

Guardado exige login, sesskey, contexto y capacidad de gestionar la actividad,
además de editor habilitado. La exportación pasa por la activación de revisión de
`package_manager` y después sincroniza iDevices/gradebook: un guardado corrupto no
puede sustituir el contenido válido. Cubrir cambios en esos límites con pruebas de
extracción y notas, no solo la respuesta HTTP.

La UI AMD del plugin se reconstruye con Grunt Moodle. Cambiar ese bootstrap no exige
compilar todo el editor upstream. `make build-editor` es necesario si el trabajo
requiere el bundle; en una release usar la referencia/tag que especifica el workflow,
coherente con `.editor-version`, nunca sustituirla por `main`. No editar `dist/static/`
a mano ni añadirlo al repositorio por una tarea documental.

Verificar que profesor y alumno mantienen acceso/denegación correctos, editor
deshabilitado sigue funcionando como reproductor y el contenido guardado se puede
volver a abrir. Consultar `release-preflight` si cambia el empaquetado.
