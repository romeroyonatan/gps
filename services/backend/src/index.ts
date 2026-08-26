import type { Config, Entorno } from '@gps/core'
import paquete from '../../../package.json'
import { crearServidor } from './server'

function leerEntorno(valor: string | undefined): Entorno {
  if (valor === 'produccion' || valor === 'prueba') return valor
  return 'desarrollo'
}

export function leerPuerto(valor: string | undefined): number {
  if (valor === undefined) return 3000
  const puerto = Number(valor)
  // Sin esto, PUERTO=abc queda en NaN y Bun.serve elige un puerto al azar sin avisar.
  if (!Number.isInteger(puerto) || puerto < 0 || puerto > 65535) {
    throw new Error(`PUERTO invalido: "${valor}". Tiene que ser un entero entre 0 y 65535.`)
  }
  return puerto
}

export function leerConfig(): Config {
  return {
    version: paquete.version,
    entorno: leerEntorno(process.env.ENTORNO),
    puerto: leerPuerto(process.env.PUERTO),
  }
}

if (import.meta.main) {
  const config = leerConfig()
  const servidor = crearServidor(config)
  // Bun corre como PID 1 en el contenedor y el kernel ignora SIGTERM sin handler:
  // sin esto, `docker compose down` espera 10s y mata con SIGKILL (exit 137).
  process.on('SIGTERM', () => process.exit(0))
  console.log(
    JSON.stringify({
      nivel: 'info',
      mensaje: 'GPS escuchando',
      url: `http://localhost:${servidor.port}`,
      version: config.version,
      entorno: config.entorno,
    }),
  )
}
