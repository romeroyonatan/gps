import type { Context } from '@gps/core'
import { getOperationAST } from 'graphql'
import type { Plugin } from 'graphql-yoga'

/** Inventario explícito: una mutation nueva rompe el test hasta decidir cómo
 *  y dónde se registra. No contiene payloads ni reemplaza los eventos de cada
 *  caso de uso. */
export const ACCIONES_AUDITADAS = [
  'adjuntarAPermiso',
  'agregarParticipante',
  'anularPago',
  'anularPermiso',
  'asignarCargo',
  'cambiarDeUnidad',
  'cerrarSesion',
  'confirmarSubida',
  'crearPermiso',
  'crearPersona',
  'declararAfiliacion',
  'definirCuotaDeAfiliacion',
  'editarPersona',
  'elegirResponsable',
  'elegirUnidades',
  'emitirPermiso',
  'firmarEnApp',
  'firmarEnPapel',
  'generarDeudasPendientes',
  'integrarEquipo',
  'invitar',
  'quitarAdjuntoDePermiso',
  'quitarParticipante',
  'reEmitirPermiso',
  'registrarPago',
  'registrarPases',
  'revocarCargo',
  'revocarIntegranteDeEquipo',
  'revocarInvitacion',
  'solicitarSubida',
] as const

/** La cabecera sólo expresa qué creía el cliente al iniciar la mutation. La
 * autorización sigue dependiendo exclusivamente del Actor reconstruido por el
 * servidor. Si sudo venció durante el viaje y la operación fue rechazada,
 * conserva ese intento sensible sin convertir errores ordinarios en ruido. */
export function crearInterceptorDeIntentosElevados(): Plugin<Context> {
  return {
    onExecute({ args }) {
      const contexto = args.contextValue
      const actor = contexto.actor
      if (
        !contexto.intencionElevada ||
        !actor ||
        actor.estaElevado ||
        !actor.esAdministradorDesignado
      ) {
        return
      }
      const operacion = getOperationAST(args.document, args.operationName)
      if (operacion?.operation !== 'mutation') return
      const acciones = operacion.selectionSet.selections.flatMap((seleccion) =>
        seleccion.kind === 'Field' ? [seleccion.name.value] : [],
      )
      return {
        onExecuteDone({ result }) {
          if (Symbol.asyncIterator in result) return
          const rechazada = result.errors?.some((error) => error.extensions?.code === 'SIN_PERMISO')
          if (!rechazada) return
          for (const accion of acciones) {
            // `Core` no vive en Context; auth publica esta operación mínima
            // para registrar el rechazo desde la frontera GraphQL.
            contexto.auth.auditarIntentoElevadoRechazado(actor.personaId, accion)
          }
        },
      }
    },
  }
}
