import type { Config, ConfigDeAuth, Entorno } from '@gps/core'
import paquete from '../../../package.json'
import { crearAlmacenamientoEnDisco, crearAlmacenamientoEnMemoria } from './almacenamiento'
import { crearBd } from './bd'
import { crearConversorDeImagenes } from './conversor'
import { crearSellador } from './sellador'
import { crearServidor } from './server'

export function leerEntorno(valor: string | undefined): Entorno {
  if (valor === undefined) return 'desarrollo'
  if (valor === 'desarrollo' || valor === 'produccion' || valor === 'prueba' || valor === 'demo') {
    return valor
  }
  throw new Error(
    `ENTORNO invalido: "${valor}". Tiene que ser desarrollo, produccion, prueba o demo.`,
  )
}

/** La ruta de la base es del backend, no de los modulos: no entra en Config.
 *  En demo es siempre memoria y no se puede configurar, para que un build de
 *  demostracion no pueda apuntar a datos reales. */
export function leerRutaDeBd(entorno: Entorno, valor: string | undefined): string {
  if (entorno === 'demo') return ':memory:'
  return valor ?? './gps.db'
}

/** Las claves con las que se sellan las firmas, en `id=clave` separados por
 *  coma, y cual esta activa. Del backend y no de Config por la misma razon que
 *  la ruta de la base: ningun modulo las lee -usan core.sellador ya armado- y
 *  meterlas en Config las expondria a todos.
 *
 *  Fuera de produccion hay una clave fija, para que levantar el proyecto no
 *  pida configurar nada. En produccion faltar es un error al arrancar y no un
 *  default silencioso: una clave de desarrollo en produccion hace que los
 *  sellos no prueben nada, y nadie se entera. */
const CLAVE_DE_DESARROLLO = { id: 'dev', clave: 'clave-de-sello-solo-para-desarrollo' }

export function leerClavesDeSello(
  entorno: Entorno,
  valor: string | undefined,
  activa: string | undefined,
): { claves: Record<string, string>; activa: string } {
  if (valor === undefined || valor === '') {
    if (entorno === 'produccion') {
      throw new Error('Falta CLAVES_DE_SELLO. En produccion no hay clave por defecto.')
    }
    return { claves: { [CLAVE_DE_DESARROLLO.id]: CLAVE_DE_DESARROLLO.clave }, activa: 'dev' }
  }

  const claves: Record<string, string> = {}
  for (const par of valor.split(',')) {
    // Solo el primer `=`: una clave puede tener `=` adentro, como cualquier
    // base64.
    const corte = par.indexOf('=')
    const id = par.slice(0, corte).trim()
    const clave = par.slice(corte + 1)
    if (corte < 1 || clave === '') {
      throw new Error(`CLAVES_DE_SELLO invalida: "${par}". El formato es id=clave,id=clave.`)
    }
    claves[id] = clave
  }

  const elegida = activa ?? Object.keys(claves)[0]
  if (elegida === undefined || claves[elegida] === undefined) {
    throw new Error(
      `CLAVE_DE_SELLO_ACTIVA "${activa}" no esta en CLAVES_DE_SELLO (${Object.keys(claves).join(', ')}).`,
    )
  }
  return { claves, activa: elegida }
}

/** Donde se guardan los bytes de los archivos subidos. Mismo criterio que la
 *  ruta de la base: en demo no se puede configurar, asi que un build de
 *  demostracion no puede escribir sobre archivos de verdad. */
export function leerDirectorioDeArchivos(entorno: Entorno, valor: string | undefined): string {
  if (entorno === 'demo') return ''
  return valor ?? './archivos'
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

const VARIABLES_DE_AUTH = [
  'ORIGEN_PUBLICO',
  'GOOGLE_CLIENTE_WEB_ID',
  'GOOGLE_CLIENTE_IOS_ID',
  'GOOGLE_CLIENTE_ANDROID_ID',
  'GOOGLE_CLIENTE_SECRETO',
  'APPLE_SERVICIO_ID',
  'APPLE_BUNDLE_ID',
  'APPLE_EQUIPO_ID',
  'APPLE_CLAVE_ID',
  'APPLE_CLAVE_PRIVADA',
] as const

export function leerConfigDeAuth(
  entorno: Entorno,
  variables: Record<string, string | undefined>,
): ConfigDeAuth | null {
  const faltantes = VARIABLES_DE_AUTH.filter((nombre) => !variables[nombre])
  if (faltantes.length === VARIABLES_DE_AUTH.length && entorno !== 'produccion') return null
  if (faltantes.length > 0) {
    throw new Error(`Faltan variables de auth: ${faltantes.join(', ')}`)
  }

  const origenPublico = variables.ORIGEN_PUBLICO as string
  const origen = new URL(origenPublico)
  if (entorno === 'produccion' && origen.protocol !== 'https:') {
    throw new Error('ORIGEN_PUBLICO tiene que usar https en produccion.')
  }

  return {
    origenPublico: origen.origin,
    google: {
      clienteWebId: variables.GOOGLE_CLIENTE_WEB_ID as string,
      clienteIosId: variables.GOOGLE_CLIENTE_IOS_ID as string,
      clienteAndroidId: variables.GOOGLE_CLIENTE_ANDROID_ID as string,
      clienteSecreto: variables.GOOGLE_CLIENTE_SECRETO as string,
    },
    apple: {
      servicioId: variables.APPLE_SERVICIO_ID as string,
      bundleId: variables.APPLE_BUNDLE_ID as string,
      equipoId: variables.APPLE_EQUIPO_ID as string,
      claveId: variables.APPLE_CLAVE_ID as string,
      clavePrivada: (variables.APPLE_CLAVE_PRIVADA as string).replaceAll('\\n', '\n'),
    },
  }
}

export function leerConfig(): Config {
  const entorno = leerEntorno(process.env.ENTORNO)
  return {
    version: paquete.version,
    entorno,
    puerto: leerPuerto(process.env.PUERTO),
    auth: leerConfigDeAuth(entorno, process.env),
  }
}

if (import.meta.main) {
  const config = leerConfig()
  const bd = crearBd(leerRutaDeBd(config.entorno, process.env.BD))
  const claves = leerClavesDeSello(
    config.entorno,
    process.env.CLAVES_DE_SELLO,
    process.env.CLAVE_DE_SELLO_ACTIVA,
  )
  // En demo los archivos viven en memoria, igual que su base: un build de
  // demostracion no deja nada en el disco de nadie.
  const { servidor, contexto } = await crearServidor(
    config,
    bd,
    crearSellador(claves.claves, claves.activa),
    config.entorno === 'demo'
      ? crearAlmacenamientoEnMemoria()
      : crearAlmacenamientoEnDisco(
          leerDirectorioDeArchivos(config.entorno, process.env.DIRECTORIO_DE_ARCHIVOS),
        ),
    crearConversorDeImagenes(),
  )

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
