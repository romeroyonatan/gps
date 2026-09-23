import type { Actor, Core } from '@gps/core'
import type { Estructura } from '@gps/estructura/dominio'
import type { Personas } from '@gps/personas/dominio'
import { and, eq, inArray } from 'drizzle-orm'
import type { Permiso } from '../dominio/modelos'
import {
  candidatos,
  esResponsablePosible,
  marcaSegunCategoria,
  type Problema,
  sePuedeEditar,
  validarDatos,
} from '../dominio/permisos'
import { participantes, permisos, unidadesDelPermiso } from './tablas'

/** Los datos del permiso no pasan las reglas de /dominio. Lleva los problemas
 *  adentro para que el resolver los pueda publicar campo por campo, igual que
 *  DatosInvalidos en personas. */
export class PermisoInvalido extends Error {
  readonly problemas: readonly Problema[]

  constructor(problemas: readonly Problema[]) {
    super(problemas.map((problema) => problema.mensaje).join(' '))
    this.name = 'PermisoInvalido'
    this.problemas = problemas
  }
}

/** El permiso no existe, o esta en un estado que no admite lo que se pidio. */
export class PermisoNoEditable extends Error {
  constructor(motivo: string) {
    super(motivo)
    this.name = 'PermisoNoEditable'
  }
}

export interface DatosDelPermiso {
  readonly lugar: string
  readonly direccion: string
  readonly localidad: string
  readonly provincia: string
  readonly telefono: string
  readonly desde: string
  readonly hasta: string
  readonly comoSeViaja?: string | null
}

export function crearOperacionesDeBorrador(core: Core, personas: Personas, estructura: Estructura) {
  /** El permiso, o un error si no existe. Devolver null obligaria a cada
   *  llamador a decidir el mensaje, y todos dirian lo mismo. */
  function permisoDe(permisoId: string): Permiso {
    const fila = core.bd.select().from(permisos).where(eq(permisos.id, permisoId)).get()
    if (!fila) throw new PermisoNoEditable('No hay ningun permiso con ese id.')
    return fila
  }

  function exigirBorrador(permisoId: string): Permiso {
    const permiso = permisoDe(permisoId)
    if (!sePuedeEditar(permiso.estado)) {
      throw new PermisoNoEditable(
        `Un permiso ${permiso.estado} no se edita: lo que se firma tiene que seguir diciendo lo mismo. Anulalo y re-emitilo.`,
      )
    }
    return permiso
  }

  /** Las unidades elegidas, que son de donde salen los candidatos. */
  function unidadesElegidas(permisoId: string): readonly string[] {
    return core.bd
      .select({ unidadId: unidadesDelPermiso.unidadId })
      .from(unidadesDelPermiso)
      .where(eq(unidadesDelPermiso.permisoId, permisoId))
      .all()
      .map((fila) => fila.unidadId)
  }

  /** Quienes pueden ir: los del grupo ese dia, filtrados por las unidades
   *  elegidas con la regla del dominio -que deja pasar a los adultos sin
   *  unidad-. La pantalla llama a la misma funcion pura con la misma lista. */
  async function quienesPuedenIr(grupoId: string, fecha: string, unidades: readonly string[]) {
    const delGrupo = await personas.miembrosDelGrupo(grupoId, fecha)
    return candidatos(
      delGrupo.map((uno) => ({
        ...uno,
        pertenencia: { unidadId: uno.unidadId, categoria: uno.categoria },
      })),
      unidades,
    )
  }

  /** Los anotados hoy, con lo unico que decide quien puede quedar a cargo. */
  function anotados(permisoId: string) {
    return core.bd
      .select({ personaId: participantes.personaId, marca: participantes.marca })
      .from(participantes)
      .where(eq(participantes.permisoId, permisoId))
      .all()
  }

  /** Suelta al responsable si dejo de ir. Se llama desde los dos lados que
   *  sacan gente -quitar a alguien y desmarcar su unidad-: si no, el permiso
   *  quedaria a cargo de quien la pantalla ya no muestra. */
  function soltarResponsableAusente(permisoId: string): void {
    const permiso = permisoDe(permisoId)
    if (permiso.responsableId === null) return
    if (esResponsablePosible(anotados(permisoId), permiso.responsableId)) return
    core.bd
      .update(permisos)
      .set({ responsableId: null, actualizadoEn: core.reloj.ahora() })
      .where(eq(permisos.id, permisoId))
      .run()
  }

  return {
    permisoDe,
    exigirBorrador,
    unidadesElegidas,
    quienesPuedenIr,

    async crearPermiso(actor: Actor, grupoId: string, datos: DatosDelPermiso): Promise<Permiso> {
      // Primero el grupo: sin el no tiene sentido validar lo demas. Que exista
      // y este abierto lo dice estructura, no una foreign key.
      if (!(await estructura.obtenerGrupo(grupoId))) {
        throw new PermisoNoEditable('El grupo no existe o esta cerrado.')
      }
      const problemas = validarDatos(datos)
      if (problemas.length > 0) throw new PermisoInvalido(problemas)

      const ahora = core.reloj.ahora()
      const permiso: Permiso = {
        id: core.nuevoId('permiso'),
        grupoId,
        estado: 'borrador',
        lugar: datos.lugar.trim(),
        direccion: datos.direccion.trim(),
        localidad: datos.localidad.trim(),
        provincia: datos.provincia.trim(),
        telefono: datos.telefono.trim(),
        desde: datos.desde,
        hasta: datos.hasta,
        comoSeViaja: datos.comoSeViaja?.trim() || null,
        responsableId: null,
        anioDeExpediente: null,
        numeroDeExpediente: null,
        pdfId: null,
        hashDelPdf: null,
        hashDelContenido: null,
        reemplazaA: null,
        creadoEn: ahora,
        actualizadoEn: ahora,
      }
      core.bd.transaction((tx) => {
        tx.insert(permisos).values(permiso).run()
        core.auditoria.registrar(
          {
            actorPersonaId: actor.personaId,
            modulo: 'salidas',
            accion: 'crearPermiso',
            elevado: actor.estaElevado,
            grupoId,
            entidadTipo: 'permiso',
            entidadId: permiso.id,
            resumen: { lugar: permiso.lugar, desde: permiso.desde, hasta: permiso.hasta },
          },
          tx,
        )
      })
      return permiso
    },

    async editarPermiso(actor: Actor, permisoId: string, datos: DatosDelPermiso): Promise<Permiso> {
      const anterior = exigirBorrador(permisoId)
      const problemas = validarDatos(datos)
      if (problemas.length > 0) throw new PermisoInvalido(problemas)

      const ahora = core.reloj.ahora()
      const nuevos = {
        lugar: datos.lugar.trim(),
        direccion: datos.direccion.trim(),
        localidad: datos.localidad.trim(),
        provincia: datos.provincia.trim(),
        telefono: datos.telefono.trim(),
        desde: datos.desde,
        hasta: datos.hasta,
        comoSeViaja: datos.comoSeViaja?.trim() || null,
      }
      core.bd.transaction((tx) => {
        tx.update(permisos)
          .set({ ...nuevos, actualizadoEn: ahora })
          .where(eq(permisos.id, permisoId))
          .run()
        core.auditoria.registrar(
          {
            actorPersonaId: actor.personaId,
            modulo: 'salidas',
            accion: 'editarPermiso',
            elevado: actor.estaElevado,
            grupoId: anterior.grupoId,
            entidadTipo: 'permiso',
            entidadId: permisoId,
            cambios: Object.entries(nuevos)
              .filter(([campo, nuevo]) => anterior[campo as keyof Permiso] !== nuevo)
              .map(([campo, nuevo]) => ({
                campo,
                anterior: anterior[campo as keyof Permiso] as string | null,
                nuevo,
              })),
          },
          tx,
        )
      })
      return permisoDe(permisoId)
    },

    /** Reemplaza las unidades que van y anota a toda la gente de las que se
     *  acaban de elegir. Después se quita sólo a quien no viaja: en un
     *  campamento grande es mucho menos trabajo que marcar a todos de a uno.
     *
     *  Quita tambien a los participantes que quedaron fuera de las unidades
     *  elegidas: si no, desmarcar una tropa dejaria a su gente en la lista y el
     *  PDF diria algo que la pantalla no muestra. */
    async elegirUnidades(
      actor: Actor,
      permisoId: string,
      unidadIds: readonly string[],
    ): Promise<void> {
      const permiso = exigirBorrador(permisoId)
      const grupo = await estructura.obtenerGrupo(permiso.grupoId)
      if (!grupo) throw new PermisoNoEditable('El grupo del permiso ya no esta abierto.')

      const abiertas = new Set(grupo.unidades.map((unidad) => unidad.id))
      const ajenas = unidadIds.filter((id) => !abiertas.has(id))
      if (ajenas.length > 0) {
        throw new PermisoInvalido([
          { campo: 'unidades', mensaje: 'Elegiste una unidad que no es de este grupo.' },
        ])
      }

      const ahora = core.reloj.ahora()
      const elegidas = [...new Set(unidadIds)]
      const anteriores = new Set(unidadesElegidas(permisoId))
      const puedenIr = await quienesPuedenIr(permiso.grupoId, permiso.desde, elegidas)
      const admitidos = new Set(puedenIr.map((uno) => uno.persona.id))
      const aAgregar =
        elegidas.length === 0
          ? []
          : puedenIr.filter(
              (uno) =>
                uno.pertenencia.unidadId !== null && !anteriores.has(uno.pertenencia.unidadId),
            )

      core.bd.transaction((tx) => {
        tx.delete(unidadesDelPermiso).where(eq(unidadesDelPermiso.permisoId, permisoId)).run()
        if (elegidas.length > 0) {
          tx.insert(unidadesDelPermiso)
            .values(elegidas.map((unidadId) => ({ permisoId, unidadId, creadoEn: ahora })))
            .run()
        }

        const puestos = tx
          .select({ personaId: participantes.personaId })
          .from(participantes)
          .where(eq(participantes.permisoId, permisoId))
          .all()
          .map((fila) => fila.personaId)
        const sobran = puestos.filter((personaId) => !admitidos.has(personaId))
        if (sobran.length > 0) {
          tx.delete(participantes)
            .where(
              and(eq(participantes.permisoId, permisoId), inArray(participantes.personaId, sobran)),
            )
            .run()
        }

        const yaPuestos = new Set(puestos)
        const faltan = aAgregar.filter((uno) => !yaPuestos.has(uno.persona.id))
        if (faltan.length > 0) {
          tx.insert(participantes)
            .values(
              faltan.map((uno) => ({
                permisoId,
                personaId: uno.persona.id,
                marca: marcaSegunCategoria(uno.categoria),
                creadoEn: ahora,
              })),
            )
            .run()
        }
        core.auditoria.registrar(
          {
            actorPersonaId: actor.personaId,
            modulo: 'salidas',
            accion: 'elegirUnidades',
            elevado: actor.estaElevado,
            grupoId: permiso.grupoId,
            entidadTipo: 'permiso',
            entidadId: permisoId,
            cambios: [{ campo: 'unidades', anterior: [...anteriores], nuevo: elegidas }],
          },
          tx,
        )
      })
      soltarResponsableAusente(permisoId)
    },

    /** Suma a alguien. La marca no se elige: sale de su categoria. */
    async agregarParticipante(actor: Actor, permisoId: string, personaId: string): Promise<void> {
      const permiso = exigirBorrador(permisoId)
      const suyo = (
        await quienesPuedenIr(permiso.grupoId, permiso.desde, unidadesElegidas(permisoId))
      ).find((uno) => uno.persona.id === personaId)
      if (!suyo) {
        throw new PermisoInvalido([
          {
            campo: 'participantes',
            mensaje: 'Esa persona no está en el grupo o su unidad no va a esta salida.',
          },
        ])
      }

      core.bd.transaction((tx) => {
        tx.insert(participantes)
          .values({
            permisoId,
            personaId,
            marca: marcaSegunCategoria(suyo.categoria),
            creadoEn: core.reloj.ahora(),
          })
          .onConflictDoNothing()
          .run()
        core.auditoria.registrar(
          {
            actorPersonaId: actor.personaId,
            modulo: 'salidas',
            accion: 'agregarParticipante',
            elevado: actor.estaElevado,
            grupoId: permiso.grupoId,
            entidadTipo: 'permiso',
            entidadId: permisoId,
            objetivoPersonaId: personaId,
            cambios: [{ campo: 'participantes', anterior: [], nuevo: [personaId] }],
          },
          tx,
        )
      })
    },

    async quitarParticipante(actor: Actor, permisoId: string, personaId: string): Promise<void> {
      const permiso = exigirBorrador(permisoId)
      core.bd.transaction((tx) => {
        tx.delete(participantes)
          .where(
            and(eq(participantes.permisoId, permisoId), eq(participantes.personaId, personaId)),
          )
          .run()
        core.auditoria.registrar(
          {
            actorPersonaId: actor.personaId,
            modulo: 'salidas',
            accion: 'quitarParticipante',
            elevado: actor.estaElevado,
            grupoId: permiso.grupoId,
            entidadTipo: 'permiso',
            entidadId: permisoId,
            objetivoPersonaId: personaId,
            cambios: [{ campo: 'participantes', anterior: [personaId], nuevo: [] }],
          },
          tx,
        )
      })
      soltarResponsableAusente(permisoId)
    },

    /** Quien queda a cargo. Tiene que ser uno de los dirigentes que van: el
     *  papel lo imprime como el contacto de la salida, y alguien que no viaja
     *  no le sirve a nadie. */
    async elegirResponsable(actor: Actor, permisoId: string, personaId: string): Promise<void> {
      const permiso = exigirBorrador(permisoId)
      if (!esResponsablePosible(anotados(permisoId), personaId)) {
        throw new PermisoInvalido([
          {
            campo: 'responsable',
            mensaje: 'El responsable tiene que ser uno de los dirigentes que van.',
          },
        ])
      }
      core.bd.transaction((tx) => {
        tx.update(permisos)
          .set({ responsableId: personaId, actualizadoEn: core.reloj.ahora() })
          .where(eq(permisos.id, permisoId))
          .run()
        core.auditoria.registrar(
          {
            actorPersonaId: actor.personaId,
            modulo: 'salidas',
            accion: 'elegirResponsable',
            elevado: actor.estaElevado,
            grupoId: permiso.grupoId,
            entidadTipo: 'permiso',
            entidadId: permisoId,
            objetivoPersonaId: personaId,
            cambios: [
              { campo: 'responsableId', anterior: permiso.responsableId, nuevo: personaId },
            ],
          },
          tx,
        )
      })
    },
  }
}
