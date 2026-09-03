import type { Config, Entorno } from '@gps/core'
import paquete from '../../../package.json'
import { crearBd } from './bd'
import { crearServidor } from './server'

function leerEntorno(valor: string | undefined): Entorno {
  if (valor === 'produccion' || valor === 'prueba' || valor === 'demo') return valor
  return 'desarrollo'
}

/** La ruta de la base es del backend, no de los modulos: no entra en Config.
 *  En demo es siempre memoria y no se puede configurar, para que un build de
 *  demostracion no pueda apuntar a datos reales. */
export function leerRutaDeBd(entorno: Entorno, valor: string | undefined): string {
  if (entorno === 'demo') return ':memory:'
  return valor ?? './gps.db'
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
  const bd = crearBd(leerRutaDeBd(config.entorno, process.env.BD))
  const { servidor, contexto } = await crearServidor(config, bd)

  // Las declaraciones ordinarias de afiliacion. Lo que corre a diario no es la
  // declaracion -que pasa dos veces al anio- sino la pregunta: un proceso no
  // tiene forma de enterarse de que paso una fecha si nada lo despierta a
  // mirar. Es idempotente y por grupo: no repite lo que ya esta declarado.
  //
  // El que hace el trabajo de verdad es este primer llamado: si el proceso
  // estuvo caido toda la semana del 1 de mayo, al volver declara mayo y sigue.
  // El intervalo es el seguro para el proceso que lleva meses en pie.
  //
  // Un setTimeout apuntado a la fecha exacta no sirve: guarda el delay en un
  // entero de 32 bits y se rompe arriba de ~24,8 dias. Un setTimeout a seis
  // meses dispara al instante.
  await contexto.afiliacion.declararPendientes()
  const UN_DIA = 24 * 60 * 60 * 1000
  setInterval(() => {
    // El del intervalo loguea y no propaga, al reves que el del arranque: un
    // fallo transitorio de la base a las 3am no tiene que tumbar un proceso que
    // lleva meses en pie. Una promesa rechazada sin catch lo tumbaria.
    contexto.afiliacion.declararPendientes().catch((error) => {
      console.error(
        JSON.stringify({
          nivel: 'error',
          mensaje: 'Fallo el barrido de declaraciones ordinarias',
          error: error instanceof Error ? error.message : String(error),
        }),
      )
    })
  }, UN_DIA)

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
