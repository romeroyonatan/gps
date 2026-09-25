import type { CambioDeAuditoria, ValorDeAuditoria } from '@gps/core'
import { alcanceDe } from '@gps/core'
import type { Builder } from '@gps/core/graphql'
import { GraphQLError } from 'graphql'
import type { EventoDeAuditoria, PaginaDeAuditoria } from '../dominio'
import { AuditoriaDenegada } from './servicio'

interface Detalle {
  clave: string
  valor: string
}

function mostrar(valor: ValorDeAuditoria): string {
  return typeof valor === 'string' ? valor : JSON.stringify(valor)
}

export function registrarSchema(builder: Builder): void {
  const DetalleRef = builder.objectRef<Detalle>('DetalleDeAuditoria').implement({
    fields: (t) => ({ clave: t.exposeString('clave'), valor: t.exposeString('valor') }),
  })
  const CambioRef = builder.objectRef<CambioDeAuditoria>('CambioDeAuditoria').implement({
    fields: (t) => ({
      campo: t.exposeString('campo'),
      anterior: t.string({ resolve: (cambio) => mostrar(cambio.anterior) }),
      nuevo: t.string({ resolve: (cambio) => mostrar(cambio.nuevo) }),
    }),
  })
  const EventoRef = builder.objectRef<EventoDeAuditoria>('EventoDeAuditoria').implement({
    fields: (t) => ({
      id: t.exposeID('id'),
      ocurridoEn: t.string({ resolve: (evento) => evento.ocurridoEn.toISOString() }),
      actorPersonaId: t.exposeID('actorPersonaId', { nullable: true }),
      actorNombre: t.exposeString('actorNombre', { nullable: true }),
      origenInterno: t.exposeString('origenInterno', { nullable: true }),
      modulo: t.exposeString('modulo'),
      accion: t.exposeString('accion'),
      resultado: t.exposeString('resultado'),
      elevado: t.exposeBoolean('elevado'),
      grupoId: t.exposeID('grupoId', { nullable: true }),
      grupoNombre: t.exposeString('grupoNombre', { nullable: true }),
      entidadTipo: t.exposeString('entidadTipo', { nullable: true }),
      entidadId: t.exposeID('entidadId', { nullable: true }),
      objetivoPersonaId: t.exposeID('objetivoPersonaId', { nullable: true }),
      objetivoNombre: t.exposeString('objetivoNombre', { nullable: true }),
      resumen: t.field({
        type: [DetalleRef],
        resolve: (evento) =>
          Object.entries(evento.resumen).map(([clave, valor]) => ({
            clave,
            valor: mostrar(valor),
          })),
      }),
      cambios: t.field({ type: [CambioRef], resolve: (evento) => [...evento.cambios] }),
    }),
  })
  const PaginaRef = builder.objectRef<PaginaDeAuditoria>('PaginaDeAuditoria').implement({
    fields: (t) => ({
      eventos: t.field({ type: [EventoRef], resolve: (pagina) => [...pagina.eventos] }),
      cursorSiguiente: t.exposeString('cursorSiguiente', { nullable: true }),
    }),
  })

  builder.queryField('auditoria', (t) =>
    t.field({
      type: PaginaRef,
      args: {
        desde: t.arg.string(),
        hasta: t.arg.string(),
        grupoId: t.arg.id(),
        actorPersonaId: t.arg.id(),
        modulo: t.arg.string(),
        accion: t.arg.string(),
        cursor: t.arg.string(),
        limite: t.arg.int(),
      },
      resolve: async (_padre, args, contexto) => {
        try {
          return await contexto.auditoria.listar(alcanceDe(contexto), {
            desde: args.desde ? new Date(args.desde) : undefined,
            hasta: args.hasta ? new Date(args.hasta) : undefined,
            grupoId: args.grupoId === undefined ? undefined : String(args.grupoId),
            actorPersonaId:
              args.actorPersonaId === undefined ? undefined : String(args.actorPersonaId),
            modulo: args.modulo ?? undefined,
            accion: args.accion ?? undefined,
            cursor: args.cursor ?? undefined,
            limite: args.limite ?? undefined,
          })
        } catch (error) {
          if (error instanceof AuditoriaDenegada)
            throw new GraphQLError(error.message, { extensions: { code: 'SIN_PERMISO' } })
          throw error
        }
      },
    }),
  )
}
