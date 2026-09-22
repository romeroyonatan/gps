import type { Archivos } from '@gps/archivos/dominio'
import type { Core } from '@gps/core'
import { aFechaDeCalendario } from '@gps/core/fechas'
import type { Estructura } from '@gps/estructura/dominio'
import { nombreDeLaUnidad } from '@gps/estructura/dominio'
import { nombreDelCargo, type Personas } from '@gps/personas/dominio'
import { and, eq, max } from 'drizzle-orm'
import { avisoDeAnticipacion } from '../dominio/anticipacion'
import { firmantesRequeridos } from '../dominio/firmas'
import type { Aviso, Permiso } from '../dominio/modelos'
import { contenidoDelPermiso, puedeTransicionar, validarParticipantes } from '../dominio/permisos'
import type { crearOperacionesDeBorrador } from './borradores'
import { PermisoInvalido, PermisoNoEditable } from './borradores'
import { armarPdf } from './pdf'
import {
  adjuntos,
  participantes,
  participantesEmitidos,
  permisos,
  unidadesDelPermiso,
} from './tablas'

export function crearOperacionesDeEmision(
  core: Core,
  personas: Personas,
  estructura: Estructura,
  archivos: Archivos,
  borradores: ReturnType<typeof crearOperacionesDeBorrador>,
) {
  return {
    /** Congela el permiso y genera su PDF.
     *
     *  La fotografia de los participantes se toma aca y no al agregarlos: el
     *  papel tiene que decir los datos del dia de la emision, y si en dos anios
     *  alguien corrige un apellido, el permiso se sigue leyendo como se leia.
     *  Es el mismo patron que Afiliado. */
    async emitir(permisoId: string): Promise<{ permiso: Permiso; avisos: readonly Aviso[] }> {
      const permiso = borradores.exigirBorrador(permisoId)

      const elegidos = core.bd
        .select()
        .from(participantes)
        .where(eq(participantes.permisoId, permisoId))
        .all()
      const problemas = validarParticipantes(elegidos, permiso.responsableId)
      if (problemas.length > 0) throw new PermisoInvalido(problemas)

      const grupo = await estructura.obtenerGrupo(permiso.grupoId)
      if (!grupo) throw new PermisoNoEditable('El grupo del permiso ya no esta abierto.')

      const delGrupo = await personas.miembrosDelGrupo(permiso.grupoId, permiso.desde)
      const porId = new Map(delGrupo.map((uno) => [uno.persona.id, uno]))
      const unidadesPorId = new Map(grupo.unidades.map((unidad) => [unidad.id, unidad]))

      const foto = elegidos.map((elegido) => {
        const miembro = porId.get(elegido.personaId)
        if (!miembro) {
          throw new PermisoInvalido([
            {
              campo: 'participantes',
              mensaje: 'Alguien de la lista ya no pertenece al grupo. Sacalo y volvé a emitir.',
            },
          ])
        }
        const unidad = miembro.unidadId === null ? null : unidadesPorId.get(miembro.unidadId)
        return {
          permisoId,
          personaId: elegido.personaId,
          marca: elegido.marca,
          tipoDeDocumento: miembro.persona.tipoDeDocumento,
          numeroDeDocumento: miembro.persona.numeroDeDocumento,
          nombres: miembro.persona.nombres,
          apellidos: miembro.persona.apellidos,
          // Los adherentes no tienen unidad: van igual, con la raya.
          unidad: unidad ? nombreDeLaUnidad(unidad) : '-',
        }
      })

      const nombresDeUnidades = borradores.unidadesElegidas(permisoId).map((id) => {
        const unidad = unidadesPorId.get(id)
        return unidad ? nombreDeLaUnidad(unidad) : id
      })

      // Las tres lineas van vacias, con el nombre de quien ocupa cada cargo el
      // dia de la emision: es lo que se imprime para llevar a firmar.
      const lineas = await Promise.all(
        firmantesRequeridos(grupo.id, grupo.distritoId).map(async (requerido) => {
          const ocupantes = await personas.ocupantesDelCargo(
            requerido.cargo,
            requerido.ambitoId,
            aFechaDeCalendario(core.reloj.ahora()),
          )
          const quien = ocupantes[0]
          return {
            cargo: nombreDelCargo(requerido.cargo),
            nombre: quien ? `${quien.apellidos}, ${quien.nombres}` : 'Sin ocupante',
            firma: null,
          }
        }),
      )

      // El numero de expediente se reserva antes de dibujar: va impreso en el
      // PDF, asi que tiene que existir antes de armarlo. La reserva es leer el
      // mayor del anio y escribir el siguiente, las dos cosas en la misma
      // transaccion y sin nada asincronico en el medio; el UNIQUE de la tabla
      // es lo que hace que dos emisiones a la vez no se queden con el mismo.
      //
      // Si despues falla el PDF, el numero queda sin usar: una serie con
      // huecos es lo normal en un registro de expedientes, y dos papeles con
      // el mismo numero no.
      //
      // El anio es el de la emision y no el de la salida: la serie la abre el
      // dia que se registra, igual que en un libro de mesa de entradas. Una
      // salida de enero presentada en diciembre entra en la serie de diciembre.
      const ahora = core.reloj.ahora()
      const anioDeExpediente = Number(aFechaDeCalendario(ahora).slice(0, 4))
      const numeroDeExpediente = core.bd.transaction((tx) => {
        const fila = tx
          .select({ mayor: max(permisos.numeroDeExpediente) })
          .from(permisos)
          .where(eq(permisos.anioDeExpediente, anioDeExpediente))
          .get()
        const siguiente = (fila?.mayor ?? 0) + 1
        tx.update(permisos)
          .set({ anioDeExpediente, numeroDeExpediente: siguiente, actualizadoEn: ahora })
          .where(eq(permisos.id, permisoId))
          .run()
        return siguiente
      })
      const conExpediente = { ...permiso, anioDeExpediente, numeroDeExpediente }

      // La huella se calcula antes de dibujar: es de lo que el papel dice, no
      // de como quedo dibujado, y el PDF la imprime en el pie.
      const huella = core.hash(
        contenidoDelPermiso({
          permiso: conExpediente,
          unidades: borradores.unidadesElegidas(permisoId),
          participantes: foto,
        }),
      )

      const pdf = await armarPdf({
        permiso: conExpediente,
        huella,
        // Recien emitido: la huella es la que se acaba de calcular.
        alterado: false,
        grupo,
        unidades: nombresDeUnidades,
        participantes: foto,
        responsable: foto.find((uno) => uno.personaId === permiso.responsableId) ?? null,
        firmas: lineas,
        escaneos: [],
      })

      const guardado = await archivos.guardarContenido({
        nombre: `permiso-${permisoId}.pdf`,
        tipo: 'application/pdf',
        contenido: pdf,
        modulo: 'salidas',
        recursoId: permisoId,
      })

      core.bd.transaction((tx) => {
        if (foto.length > 0) {
          tx.insert(participantesEmitidos)
            .values(foto.map((uno) => ({ ...uno, creadoEn: ahora })))
            .run()
        }
        tx.update(permisos)
          .set({
            estado: 'emitido',
            pdfId: guardado.id,
            hashDelPdf: guardado.sha256,
            hashDelContenido: huella,
            actualizadoEn: ahora,
          })
          .where(eq(permisos.id, permisoId))
          .run()
      })

      const aviso = avisoDeAnticipacion(aFechaDeCalendario(ahora), permiso.desde)
      return { permiso: borradores.permisoDe(permisoId), avisos: aviso ? [aviso] : [] }
    },

    async anular(permisoId: string): Promise<Permiso> {
      const permiso = borradores.permisoDe(permisoId)
      if (!puedeTransicionar(permiso.estado, 'anulado')) {
        throw new PermisoNoEditable(`Un permiso ${permiso.estado} no se anula.`)
      }
      const ahora = core.reloj.ahora()
      core.bd
        .update(permisos)
        .set({ estado: 'anulado', actualizadoEn: ahora })
        .where(eq(permisos.id, permisoId))
        .run()
      return borradores.permisoDe(permisoId)
    },

    /** Un borrador nuevo con los mismos datos, unidades y participantes. No
     *  revive el anulado: lo que se firmo queda como esta, y lo nuevo es otro
     *  permiso que recuerda de cual salio. */
    async reEmitir(permisoId: string): Promise<Permiso> {
      const anulado = borradores.permisoDe(permisoId)
      if (anulado.estado !== 'anulado' || anulado.pdfId === null) {
        throw new PermisoNoEditable('Solo se re-emite un permiso emitido y anulado.')
      }
      if (
        core.bd
          .select({ id: permisos.id })
          .from(permisos)
          .where(eq(permisos.reemplazaA, permisoId))
          .get()
      ) {
        throw new PermisoNoEditable('Este permiso ya fue re-emitido.')
      }

      const ahora = core.reloj.ahora()
      const nuevo: Permiso = {
        ...anulado,
        id: core.nuevoId('permiso'),
        estado: 'borrador',
        anioDeExpediente: null,
        numeroDeExpediente: null,
        pdfId: null,
        hashDelPdf: null,
        hashDelContenido: null,
        reemplazaA: anulado.id,
        creadoEn: ahora,
        actualizadoEn: ahora,
      }

      const unidades = borradores.unidadesElegidas(permisoId)
      const suyos = core.bd
        .select()
        .from(participantes)
        .where(eq(participantes.permisoId, permisoId))
        .all()

      core.bd.transaction((tx) => {
        tx.insert(permisos).values(nuevo).run()
        if (unidades.length > 0) {
          tx.insert(unidadesDelPermiso)
            .values(
              unidades.map((unidadId) => ({ permisoId: nuevo.id, unidadId, creadoEn: ahora })),
            )
            .run()
        }
        if (suyos.length > 0) {
          tx.insert(participantes)
            .values(suyos.map((uno) => ({ ...uno, permisoId: nuevo.id, creadoEn: ahora })))
            .run()
        }
      })
      return nuevo
    },

    /** Saca un adjunto y borra su archivo.
     *
     *  Se puede en cualquier estado, incluso firmado: un adjunto no entra en el
     *  PDF ni en el hash que sellan las firmas, asi que sacarlo no invalida
     *  nada. Los escaneos de las firmas no son adjuntos y no se tocan por aca:
     *  esos son la prueba de lo que se firmo. */
    async quitarAdjunto(permisoId: string, adjuntoId: string): Promise<void> {
      const adjunto = core.bd
        .select()
        .from(adjuntos)
        .where(and(eq(adjuntos.id, adjuntoId), eq(adjuntos.permisoId, permisoId)))
        .get()
      if (!adjunto) throw new PermisoNoEditable('Ese adjunto no es de este permiso.')

      core.bd.delete(adjuntos).where(eq(adjuntos.id, adjuntoId)).run()
      await archivos.eliminar(adjunto.archivoId, 'salidas', permisoId)
    },

    /** Cuelga un archivo ya subido. En cualquier estado: una planificacion
     *  puede llegar despues de firmado, y no toca lo que se firmo. */
    async adjuntar(permisoId: string, archivoId: string): Promise<void> {
      borradores.permisoDe(permisoId)
      if (!(await archivos.esDe(archivoId, 'salidas', permisoId))) {
        throw new PermisoNoEditable('Ese archivo no esta confirmado o no es de este permiso.')
      }
      const ahora = core.reloj.ahora()
      core.bd
        .insert(adjuntos)
        .values({
          id: core.nuevoId('adjunto'),
          permisoId,
          archivoId,
          creadoEn: ahora,
          actualizadoEn: ahora,
        })
        .run()
    },
  }
}
