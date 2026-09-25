import type { Alcance, CambioDeAuditoria, Core, ValorDeAuditoria } from '@gps/core'
import type { Estructura } from '@gps/estructura/dominio'
import type { Personas } from '@gps/personas/dominio'
import { and, desc, eq, gte, inArray, lt, lte, or, type SQL } from 'drizzle-orm'
import {
  type EventoDeAuditoria,
  type FiltrosDeAuditoria,
  gruposAuditables,
  type PaginaDeAuditoria,
} from '../dominio'
import { eventosDeAuditoria } from './tablas'

export class AuditoriaDenegada extends Error {
  override name = 'AuditoriaDenegada'
}

interface Fila {
  id: string
  ocurridoEn: Date
  actorPersonaId: string | null
  origenInterno: string | null
  modulo: string
  accion: string
  resultado: 'exitoso' | 'rechazado'
  elevado: boolean
  grupoId: string | null
  entidadTipo: string | null
  entidadId: string | null
  objetivoPersonaId: string | null
  resumen: string
  cambios: string
}

export interface ServicioDeAuditoria {
  listar(alcance: Alcance, filtros?: FiltrosDeAuditoria): Promise<PaginaDeAuditoria>
}

function cursorDe(fila: Fila): string {
  return `${fila.ocurridoEn.getTime()}:${fila.id}`
}

function leerCursor(cursor: string): { fecha: Date; id: string } | null {
  const separador = cursor.indexOf(':')
  const tiempo = Number(cursor.slice(0, separador))
  if (separador < 1 || !Number.isFinite(tiempo)) return null
  return { fecha: new Date(tiempo), id: cursor.slice(separador + 1) }
}

function objeto(texto: string): Readonly<Record<string, ValorDeAuditoria>> {
  try {
    const valor = JSON.parse(texto)
    return valor && typeof valor === 'object' && !Array.isArray(valor) ? valor : {}
  } catch {
    return {}
  }
}

function cambios(texto: string): readonly CambioDeAuditoria[] {
  try {
    const valor = JSON.parse(texto)
    return Array.isArray(valor) ? valor : []
  } catch {
    return []
  }
}

export function crearServicioDeAuditoria(
  core: Core,
  personas: Personas,
  estructura: Estructura,
): ServicioDeAuditoria {
  return {
    async listar(alcance, filtros = {}) {
      const permitidos = gruposAuditables(alcance.actor)
      if (permitidos !== null && permitidos.length === 0)
        return { eventos: [], cursorSiguiente: null }
      if (filtros.grupoId && permitidos !== null && !permitidos.includes(filtros.grupoId)) {
        throw new AuditoriaDenegada('No tenés acceso a la auditoría de ese grupo.')
      }

      const condiciones: SQL[] = []
      if (permitidos !== null)
        condiciones.push(inArray(eventosDeAuditoria.grupoId, [...permitidos]))
      if (filtros.grupoId) condiciones.push(eq(eventosDeAuditoria.grupoId, filtros.grupoId))
      if (filtros.actorPersonaId)
        condiciones.push(eq(eventosDeAuditoria.actorPersonaId, filtros.actorPersonaId))
      if (filtros.modulo) condiciones.push(eq(eventosDeAuditoria.modulo, filtros.modulo))
      if (filtros.accion) condiciones.push(eq(eventosDeAuditoria.accion, filtros.accion))
      if (filtros.desde) condiciones.push(gte(eventosDeAuditoria.ocurridoEn, filtros.desde))
      if (filtros.hasta) condiciones.push(lte(eventosDeAuditoria.ocurridoEn, filtros.hasta))
      if (filtros.cursor) {
        const cursor = leerCursor(filtros.cursor)
        if (cursor) {
          condiciones.push(
            or(
              lt(eventosDeAuditoria.ocurridoEn, cursor.fecha),
              and(
                eq(eventosDeAuditoria.ocurridoEn, cursor.fecha),
                lt(eventosDeAuditoria.id, cursor.id),
              ),
            ) as SQL,
          )
        }
      }

      const limite = Math.min(Math.max(filtros.limite ?? 30, 1), 100)
      const filas = core.bd
        .select()
        .from(eventosDeAuditoria)
        .where(condiciones.length ? and(...condiciones) : undefined)
        .orderBy(desc(eventosDeAuditoria.ocurridoEn), desc(eventosDeAuditoria.id))
        .limit(limite + 1)
        .all() as Fila[]
      const hayMas = filas.length > limite
      const pagina = filas.slice(0, limite)
      const nombres = new Map<string, string | null>()
      await Promise.all(
        [
          ...new Set(
            pagina.flatMap((fila) =>
              [fila.actorPersonaId, fila.objetivoPersonaId].filter(
                (id): id is string => id !== null,
              ),
            ),
          ),
        ].map(async (id) => {
          const persona = await personas.nombreDe(id)
          nombres.set(id, persona ? `${persona.nombres} ${persona.apellidos}` : null)
        }),
      )
      const grupos = new Map(
        (await estructura.listarGrupos()).map((grupo) => [
          grupo.id,
          `Grupo Nº${grupo.numero} · ${grupo.nombre}`,
        ]),
      )
      const eventos: EventoDeAuditoria[] = pagina.map((fila) => ({
        ...fila,
        actorNombre: fila.actorPersonaId ? (nombres.get(fila.actorPersonaId) ?? null) : null,
        objetivoNombre: fila.objetivoPersonaId
          ? (nombres.get(fila.objetivoPersonaId) ?? null)
          : null,
        grupoNombre: fila.grupoId ? (grupos.get(fila.grupoId) ?? null) : null,
        resumen: objeto(fila.resumen),
        cambios: cambios(fila.cambios),
      }))
      return {
        eventos,
        cursorSiguiente:
          hayMas && pagina.length ? cursorDe(pagina[pagina.length - 1] as Fila) : null,
      }
    },
  }
}
