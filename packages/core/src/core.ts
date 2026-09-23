import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core'
import type { BusDeEventos } from './eventos'

export type Entorno = 'desarrollo' | 'produccion' | 'prueba' | 'demo'

export interface ConfigDeAuth {
  readonly origenPublico: string
  readonly google: {
    readonly clienteWebId: string
    readonly clienteIosId: string
    readonly clienteAndroidId: string
    readonly clienteSecreto: string
  }
  readonly apple: {
    readonly servicioId: string
    readonly bundleId: string
    readonly equipoId: string
    readonly claveId: string
    readonly clavePrivada: string
  }
}

export interface Config {
  readonly version: string
  readonly entorno: Entorno
  readonly puerto: number
  /** null fuera de produccion permite tests y demo sin proveedores externos. */
  readonly auth?: ConfigDeAuth | null
}

export interface Logger {
  info(mensaje: string, datos?: Record<string, unknown>): void
  error(mensaje: string, datos?: Record<string, unknown>): void
}

export interface Reloj {
  ahora(): Date
}

/** La base, sin atarse al driver: bun:sqlite en el servidor, expo-sqlite en el
 *  telefono. Quien la abre es la raiz de composicion; un modulo la recibe ya
 *  abierta y no sabe cual es. */
export type Bd = BaseSQLiteDatabase<'sync', unknown>

export type ValorDeAuditoria = string | number | boolean | null | readonly ValorDeAuditoria[]

export interface CambioDeAuditoria {
  readonly campo: string
  readonly anterior: ValorDeAuditoria
  readonly nuevo: ValorDeAuditoria
}

/** Un hecho que los modulos entregan ya reducido a datos de negocio. Nunca
 *  recibe argumentos GraphQL completos: asi secretos y bytes no entran por
 *  accidente al registro. */
export interface DatosDeAuditoria {
  readonly actorPersonaId: string | null
  readonly origenInterno?: string | null
  readonly modulo: string
  readonly accion: string
  readonly resultado?: 'exitoso' | 'rechazado'
  readonly elevado?: boolean
  readonly grupoId?: string | null
  readonly entidadTipo?: string | null
  readonly entidadId?: string | null
  readonly objetivoPersonaId?: string | null
  readonly resumen?: Readonly<Record<string, ValorDeAuditoria>>
  readonly cambios?: readonly CambioDeAuditoria[]
}

/** Tanto `Bd` como una transaccion SQLite exponen `run`; alcanza para insertar
 *  el evento sin filtrar el resto de la base por esta interfaz transversal. */
export type EjecutorDeAuditoria = Pick<Bd, 'run'>

export interface RegistroDeAuditoria {
  registrar(datos: DatosDeAuditoria, ejecutor?: EjecutorDeAuditoria): string
}

/** Un sello: la prueba de que unos datos se sellaron con una clave nuestra, y
 *  cual. El `claveId` viaja con el sello y se guarda con el: sin el, rotar la
 *  clave invalidaria todo lo sellado antes. */
export interface Sello {
  readonly sello: string
  readonly claveId: string
}

/** Sella datos con una clave secreta que no sale del servidor, para que una
 *  fila alterada en la base no pueda hacerse pasar por legitima.
 *
 *  Con un hash pelado no alcanzaria: no tiene secreto, asi que quien alcanza la
 *  base recalcula el hash de lo que escribio y el sello no prueba nada. Cuesta
 *  lo mismo y ataja eso.
 *
 *  Vive en Core y no en un modulo por la regla de portabilidad: `/servidor` no
 *  puede importar `node:crypto`, y `crypto.subtle` no existe en Hermes. */
export interface Sellador {
  sellar(datos: string): Sello
  /** `false` -y no una excepcion- cuando el sello no cierra o cuando la clave
   *  con que se sello ya no esta configurada: las dos son "no puedo afirmar que
   *  esto sea legitimo", que es lo que el consumidor muestra. */
  verificar(datos: string, sello: Sello): boolean
}

/** Los bytes de los archivos que suben los usuarios. No van a la base: una foto
 *  de un permiso son varios megabytes, y ahi adentro inflan los backups y
 *  arruinan la replicacion (spec base §9.1).
 *
 *  La clave es opaca: quien guarda decide como se llama y quien lee usa la
 *  misma. Hoy es un archivo en disco; el dia que sea S3 no cambia ningun
 *  modulo. */
export interface Almacenamiento {
  guardar(clave: string, contenido: Uint8Array): Promise<void>
  leer(clave: string): Promise<Uint8Array>
  eliminar(clave: string): Promise<void>
}

/** Convierte imagenes a JPEG. Existe por un solo caso: las fotos de iPhone
 *  salen en HEIC, que `pdf-lib` no sabe leer, y quien sube el escaneo de un
 *  permiso firmado suele sacarlo con el telefono.
 *
 *  Convertir del lado del servidor y no del cliente cubre el caso que el
 *  cliente no cubre: la web desde una Mac, que sube el `.heic` tal cual.
 *
 *  Vive en Core por la regla de portabilidad, igual que el sellador. */
export interface ConversorDeImagenes {
  /** Devuelve los bytes en JPEG. Tira si no puede decodificar la entrada. */
  aJpeg(contenido: Uint8Array): Promise<Uint8Array>
}

/** Lo que el core le provee a todo modulo. Es la unica via de un modulo
 *  hacia la plataforma: ver la regla de portabilidad en AGENT.md. */
export interface Core {
  readonly config: Config
  readonly logger: Logger
  readonly reloj: Reloj
  readonly bd: Bd
  readonly eventos: BusDeEventos
  readonly auditoria: RegistroDeAuditoria
  readonly sellador: Sellador
  readonly almacenamiento: Almacenamiento
  readonly conversorDeImagenes: ConversorDeImagenes
  /** Nombres de los modulos registrados, en orden de dependencias. */
  readonly modulos: readonly string[]
  /** Identificador nuevo para una entidad, con su prefijo:
   *      grupo_01a04035-7e28-7428-afbd-021d928ae01c
   *  El prefijo se guarda en la base, no se codifica: un id en un log dice de
   *  que entidad es sin ir a buscarlo. Es del dominio, asi que va en espanol y
   *  en singular. Va en Core por la misma razon que reloj.ahora(): generar un
   *  UUID es tocar la plataforma. */
  nuevoId(prefijo: string): string
  /** Secreto criptografico nuevo codificado como hexadecimal. La plataforma lo
   *  genera para que sesiones, invitaciones y PKCE sigan siendo portables. */
  nuevoSecreto(bytes?: number): string
  /** sha256 en hexadecimal. Va en Core por la regla de portabilidad, igual que
   *  el sellador, pero es otra cosa: un hash no lleva secreto, asi que dice si
   *  unos bytes cambiaron y no quien los escribio. Es lo que se necesita para
   *  identificar el contenido de un archivo o anclar un PDF a la firma que lo
   *  firma; para probar autoria esta `sellador`. */
  hash(contenido: Uint8Array | string): string
}
