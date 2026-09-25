---
name: servidor-demo
description: Levantar y detener el servidor demo de GPS en un puerto libre aleatorio, sin colisionar con otros workspaces. Usar cuando pidan ver cambios en el navegador, iniciar un servidor local o apagarlo.
---

# Servidor demo aislado

Ejecutar desde la raíz del workspace. `PUERTO=0` hace que Bun elija un puerto libre y el backend imprime la URL real. Usar `ENTORNO=demo` para cargar datos de ejemplo en memoria, sin tocar la base ni los archivos del workspace. No usar `bun run demo` en segundo plano: su `--watch` crea procesos adicionales que complican detenerlo.

## Arrancar

```bash
logdir=$(mktemp -d "${TMPDIR:-/tmp}/gps-demo.XXXXXX")
cd services/backend || exit 1
ENTORNO=demo PUERTO=0 nohup bun src/index.ts > "$logdir/servidor.log" 2>&1 < /dev/null &
printf '%s\n' "$!" > "$logdir/servidor.pid"
```

Esperar a que aparezca `GPS escuchando` en `"$logdir/servidor.log"`. Extraer su campo `url`, comprobar `curl -fsS "$url/health"` y comunicar **URL y ruta absoluta de `logdir`** a quien pidió el servidor. En Orca el navegador puede mostrar una URL proxy `<workspace>.orca.localhost:<puerto-de-orca>` en lugar de `localhost:<puerto-de-bun>`; verificar su `/health` si se conoce y comunicar esa URL para usarla dentro de Orca. No asumir que ambos puertos coinciden. Si falla el arranque, mostrar el log. Este proceso no observa cambios de código: para aplicar nuevas ediciones, detenerlo y arrancar otro.

## Detener

Usar el `logdir` comunicado al arrancar (nunca matar por puerto ni usar `pkill bun`, que afectaría otros workspaces):

```bash
pid=$(<"$logdir/servidor.pid")
ps -p "$pid" -o command= # confirmar que todavía es bun src/index.ts
kill "$pid"
```

Si el PID ya no existe, no matar nada. El demo pierde los datos al detenerse porque usa memoria. El log queda en `"$logdir/servidor.log"`; borrar el directorio temporal después si ya no hace falta.
