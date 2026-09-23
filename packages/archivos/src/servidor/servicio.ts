import type { Alcance, Core } from '@gps/core'
import { and, eq } from 'drizzle-orm'
import {
  esTipoAdmitido,
  necesitaConversion,
  TAMANO_MAXIMO,
  type TipoAdmitido,
} from '../dominio/archivos'
import type { Archivo } from '../dominio/modelos'
import type { Archivos } from '../dominio/publico'
import { archivos } from './tablas'

/** Lo que se pidio subir no se puede aceptar: el tipo no esta admitido, el
 *  tamaño se pasa, o falta el dueño. */
export class SubidaInvalida extends Error {
  constructor(motivo: string) {
    super(motivo)
    this.name = 'SubidaInvalida'
  }
}

/** El token de subida no sirve: no corresponde a ese archivo, o vencio. */
export class SubidaNoAutorizada extends Error {
  constructor(motivo: string) {
    super(motivo)
    this.name = 'SubidaNoAutorizada'
  }
}

/** Nadie puede decir si esta descarga esta permitida: el modulo dueño del
 *  archivo no registro un autorizador. Es deliberadamente un error y no un
 *  "si": un archivo que nadie reclama no se entrega. */
export class SinAutorizador extends Error {
  constructor(modulo: string) {
    super(`El modulo "${modulo}" no registro como autorizar sus archivos.`)
    this.name = 'SinAutorizador'
  }
}

/** Cuanto vale una URL de subida. Corto porque el cliente la usa enseguida: la
 *  pide y manda los bytes. */
const VENCIMIENTO_MS = 15 * 60 * 1000

/** Lo que cada modulo dueño tiene que contestar para que sus archivos se puedan
 *  descargar. `archivos` no conoce ninguna regla de permisos: pregunta.
 *
 *  Recibe `actor` aunque hoy sea siempre null: cuando exista auth, la firma no
 *  cambia y cada dueño decide con quien esta preguntando. */
/** Lo que el modulo dueño de un recurso contesta antes de que se entreguen sus
 *  bytes. Recibe el alcance del pedido -null si no hay sesion- porque la
 *  descarga tiene que filtrar igual que la consulta GraphQL: una URL no
 *  esquiva el filtro del dueño. */
export type Autorizador = (recursoId: string, alcance: Alcance | null) => Promise<boolean>

/** Lo que este modulo hace, que es mas que lo que publica: ver Archivos en
 *  /dominio/publico.ts. `extends` es lo que hace que la implementacion no pueda
 *  quedar corta sin que TypeScript se entere. */
export interface ServicioDeArchivos extends Archivos {
  /** Primer paso: reserva un id y devuelve por donde mandar los bytes. */
  solicitarSubida(datos: {
    nombre: string
    tipo: string
    tamano: number
    modulo: string
    recursoId: string
  }, alcance?: Alcance | null): Promise<{ id: string; url: string; expira: Date }>

  /** Segundo paso, desde la ruta HTTP: valida el token y guarda los bytes. */
  recibirBytes(id: string, token: string, contenido: Uint8Array): Promise<void>

  /** Tercer paso: valida lo recibido, convierte si hace falta, y lo deja usable. */
  confirmarSubida(id: string, alcance?: Alcance | null): Promise<Archivo>
}

/** Los bytes van a Almacenamiento y el registro a la base. La clave del
 *  almacenamiento es el id: no hace falta que diga nada mas, y asi no hay dos
 *  nombres que puedan quedar desincronizados. */
export function crearServicioDeArchivos(
  core: Core,
  autorizadores: Readonly<Record<string, Autorizador>>,
): ServicioDeArchivos {
  /** El token es un sello sobre el id y el vencimiento: no hay que guardarlo,
   *  porque se puede recalcular. El prefijo separa este uso del de las firmas,
   *  asi la misma clave no puede servir para lo otro. */
  function tokenDe(id: string, expira: number): string {
    const { sello, claveId } = core.sellador.sellar(`subida|${id}|${expira}`)
    return `${expira}.${claveId}.${sello}`
  }

  function verificarToken(id: string, token: string): void {
    const [expira, claveId, sello] = token.split('.')
    if (expira === undefined || claveId === undefined || sello === undefined) {
      throw new SubidaNoAutorizada('El token de subida esta mal formado.')
    }
    if (!core.sellador.verificar(`subida|${id}|${expira}`, { sello, claveId })) {
      throw new SubidaNoAutorizada('El token de subida no corresponde a este archivo.')
    }
    if (Number(expira) < core.reloj.ahora().getTime()) {
      throw new SubidaNoAutorizada('La URL de subida vencio. Pedi una nueva.')
    }
  }

  function filaDe(id: string) {
    return core.bd.select().from(archivos).where(eq(archivos.id, id)).get()
  }

  return {
    async solicitarSubida(datos, alcance = null) {
      if (!esTipoAdmitido(datos.tipo)) {
        throw new SubidaInvalida(`No se pueden subir archivos de tipo "${datos.tipo}".`)
      }
      if (datos.tamano <= 0 || datos.tamano > TAMANO_MAXIMO) {
        throw new SubidaInvalida(
          `El archivo tiene que pesar entre 1 byte y ${TAMANO_MAXIMO} bytes.`,
        )
      }
      // Sin dueño no se puede autorizar despues: no habria a quien preguntarle.
      if (datos.modulo.trim() === '' || datos.recursoId.trim() === '') {
        throw new SubidaInvalida('Un archivo necesita saber de que modulo y de que recurso es.')
      }

      const ahora = core.reloj.ahora()
      const id = core.nuevoId('archivo')
      core.bd.transaction((tx) => {
        tx.insert(archivos)
          .values({
            id,
            nombre: datos.nombre,
            tipo: datos.tipo as TipoAdmitido,
            // El tamaño declarado; al confirmar se reemplaza por el real.
            tamano: datos.tamano,
            sha256: '',
            modulo: datos.modulo,
            recursoId: datos.recursoId,
            confirmado: false,
            creadoEn: ahora,
            actualizadoEn: ahora,
          })
          .run()
        core.auditoria.registrar(
          {
            actorPersonaId: alcance?.actor.personaId ?? null,
            origenInterno: alcance ? null : 'servidor',
            modulo: 'archivos',
            accion: 'solicitarSubida',
            elevado: alcance?.actor.estaElevado ?? false,
            entidadTipo: 'archivo',
            entidadId: id,
            resumen: {
              nombre: datos.nombre,
              tipo: datos.tipo,
              tamano: datos.tamano,
              moduloDueno: datos.modulo,
              recursoId: datos.recursoId,
            },
          },
          tx,
        )
      })

      const expira = new Date(ahora.getTime() + VENCIMIENTO_MS)
      return { id, url: `/archivos/${id}?token=${tokenDe(id, expira.getTime())}`, expira }
    },

    async recibirBytes(id, token, contenido) {
      verificarToken(id, token)
      const fila = filaDe(id)
      if (!fila) throw new SubidaNoAutorizada('No hay ninguna subida pedida con ese id.')
      if (fila.confirmado) throw new SubidaNoAutorizada('Esa subida ya esta confirmada.')
      if (contenido.length !== fila.tamano) {
        throw new SubidaInvalida(
          `Se declararon ${fila.tamano} bytes y llegaron ${contenido.length}.`,
        )
      }
      await core.almacenamiento.guardar(id, contenido)
    },

    async confirmarSubida(id, alcance = null) {
      const fila = filaDe(id)
      if (!fila) throw new SubidaInvalida('No hay ninguna subida pedida con ese id.')
      if (fila.confirmado) throw new SubidaInvalida('Esa subida ya esta confirmada.')

      let contenido: Uint8Array
      try {
        contenido = await core.almacenamiento.leer(id)
      } catch {
        throw new SubidaInvalida('Todavia no llegaron los bytes de esa subida.')
      }

      let tipo = fila.tipo
      // Se convierte al confirmar y no al recibir: recibir solo guarda lo que
      // llego, y asi un reintento no convierte dos veces.
      if (necesitaConversion(tipo)) {
        contenido = await core.conversorDeImagenes.aJpeg(contenido)
        tipo = 'image/jpeg'
        await core.almacenamiento.guardar(id, contenido)
      }

      const ahora = core.reloj.ahora()
      const confirmado = {
        ...fila,
        tipo,
        tamano: contenido.length,
        sha256: core.hash(contenido),
        confirmado: true,
        actualizadoEn: ahora,
      }
      core.bd.transaction((tx) => {
        tx.update(archivos)
          .set({
            tipo: confirmado.tipo,
            tamano: confirmado.tamano,
            sha256: confirmado.sha256,
            confirmado: true,
            actualizadoEn: ahora,
          })
          .where(eq(archivos.id, id))
          .run()
        core.auditoria.registrar(
          {
            actorPersonaId: alcance?.actor.personaId ?? null,
            origenInterno: alcance ? null : 'servidor',
            modulo: 'archivos',
            accion: 'confirmarSubida',
            elevado: alcance?.actor.estaElevado ?? false,
            entidadTipo: 'archivo',
            entidadId: id,
            resumen: {
              nombre: fila.nombre,
              tipo: confirmado.tipo,
              tamano: confirmado.tamano,
              moduloDueno: fila.modulo,
              recursoId: fila.recursoId,
            },
          },
          tx,
        )
      })
      return confirmado
    },

    /** Los tres pasos de una vez, para el contenido que genera el servidor: ya
     *  tiene los bytes en la mano, asi que pedir la subida y confirmarla por
     *  separado seria ceremonia sin nadie del otro lado. */
    async guardarContenido(datos) {
      const subida = await this.solicitarSubida({
        nombre: datos.nombre,
        tipo: datos.tipo,
        tamano: datos.contenido.length,
        modulo: datos.modulo,
        recursoId: datos.recursoId,
      })
      await core.almacenamiento.guardar(subida.id, datos.contenido)
      return await this.confirmarSubida(subida.id)
    },

    async descargar(id, alcance) {
      const fila = filaDe(id)
      if (!fila?.confirmado) {
        throw new SubidaInvalida('No hay ningun archivo confirmado con ese id.')
      }
      const autorizador = autorizadores[fila.modulo]
      if (!autorizador) throw new SinAutorizador(fila.modulo)
      if (!(await autorizador(fila.recursoId, alcance))) {
        throw new SubidaNoAutorizada('No estas autorizado a ver este archivo.')
      }
      return {
        contenido: await core.almacenamiento.leer(id),
        tipo: fila.tipo,
        nombre: fila.nombre,
      }
    },

    async eliminar(id, modulo, recursoId) {
      if (!(await this.esDe(id, modulo, recursoId))) return false
      // El registro primero: si falla al borrar los bytes queda un archivo
      // huerfano -basura- y no una fila apuntando a bytes que ya no estan.
      core.bd.delete(archivos).where(eq(archivos.id, id)).run()
      await core.almacenamiento.eliminar(id)
      return true
    },

    async obtener(id) {
      const fila = filaDe(id)
      return fila?.confirmado ? fila : null
    },

    async esDe(id, modulo, recursoId) {
      return (
        core.bd
          .select({ id: archivos.id })
          .from(archivos)
          .where(
            and(
              eq(archivos.id, id),
              eq(archivos.modulo, modulo),
              eq(archivos.recursoId, recursoId),
              eq(archivos.confirmado, true),
            ),
          )
          .get() !== undefined
      )
    },
  }
}
