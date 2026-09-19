import type { Context } from '@gps/core'
import { getOperationAST } from 'graphql'
import type { Plugin } from 'graphql-yoga'

/** Audita toda mutation ejecutada con alcance global (`actor.estaElevado`).
 *  No es la única auditoría: cada módulo sigue registrando sus propios
 *  eventos de dominio (ver `eventos_de_autoridad` en personas). Esto agrega
 *  la marca "se escribió con sudo prendido", que ningún módulo puede saber
 *  por sí solo porque `estaElevado` es un hecho de la sesión, no del dominio.
 *
 *  No habilita sudo: sólo lo observa. `Alcance.esAdministrador` sigue
 *  viniendo únicamente de `estructura.expandirAlcance`, y este plugin no lo
 *  toca ni corre para pedidos internos -el barrido de afiliación, la siembra
 *  de demo- porque esos no pasan por Yoga. */
export function crearInterceptorDeEscriturasElevadas(): Plugin<Context> {
  return {
    onExecute({ args }) {
      const contexto = args.contextValue
      if (!contexto.actor?.estaElevado) return
      const operacion = getOperationAST(args.document, args.operationName)
      if (operacion?.operation !== 'mutation') return
      contexto.auth.auditarEscrituraElevada(
        contexto.actor.personaId,
        args.operationName ?? 'mutación anónima',
      )
    },
  }
}
