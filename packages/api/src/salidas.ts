import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AdjuntarAPermisoDocument,
  AgregarParticipanteDocument,
  AnularPermisoDocument,
  ConfirmarSubidaDocument,
  CrearPermisoDocument,
  ElegirUnidadesDocument,
  EmitirPermisoDocument,
  FirmarEnAppDocument,
  FirmarEnPapelDocument,
  PermisosDocument,
  QuitarAdjuntoDocument,
  QuitarParticipanteDocument,
  ReEmitirPermisoDocument,
  SolicitarSubidaDocument,
  type TipoDeCargo,
} from './generated/graphql'
import { useTransporte } from './proveedor'

/** Los permisos de un grupo, del mas proximo al mas viejo. */
export function usePermisos(grupoId: string) {
  const transporte = useTransporte()
  return useQuery({
    queryKey: ['permisos', grupoId],
    queryFn: () => transporte.ejecutar(PermisosDocument, { grupoId }),
  })
}

/** Toda operacion sobre un permiso invalida la lista del grupo: el estado, las
 *  firmas y los participantes salen todos de ahi. Es una sola query, asi que
 *  invalidarla entera cuesta lo mismo que afinar cual.  */
function useMutacionDePermiso<Variables, Resultado>(
  correr: (
    transporte: ReturnType<typeof useTransporte>,
    variables: Variables,
  ) => Promise<Resultado>,
) {
  const transporte = useTransporte()
  const clienteDeQueries = useQueryClient()
  return useMutation({
    mutationFn: (variables: Variables) => correr(transporte, variables),
    onSuccess: () => {
      clienteDeQueries.invalidateQueries({ queryKey: ['permisos'] })
    },
  })
}

export function useCrearPermiso() {
  return useMutacionDePermiso(
    (
      transporte,
      variables: {
        grupoId: string
        lugar: string
        desde: string
        hasta: string
        comoSeViaja?: string | null
      },
    ) => transporte.ejecutar(CrearPermisoDocument, variables),
  )
}

export function useElegirUnidades() {
  return useMutacionDePermiso((transporte, variables: { permisoId: string; unidadIds: string[] }) =>
    transporte.ejecutar(ElegirUnidadesDocument, variables),
  )
}

export function useAgregarParticipante() {
  return useMutacionDePermiso((transporte, variables: { permisoId: string; personaId: string }) =>
    transporte.ejecutar(AgregarParticipanteDocument, variables),
  )
}

export function useQuitarParticipante() {
  return useMutacionDePermiso((transporte, variables: { permisoId: string; personaId: string }) =>
    transporte.ejecutar(QuitarParticipanteDocument, variables),
  )
}

export function useEmitirPermiso() {
  return useMutacionDePermiso((transporte, variables: { permisoId: string }) =>
    transporte.ejecutar(EmitirPermisoDocument, variables),
  )
}

export function useFirmarEnApp() {
  return useMutacionDePermiso(
    (transporte, variables: { permisoId: string; cargo: TipoDeCargo; trazos: string }) =>
      transporte.ejecutar(FirmarEnAppDocument, variables),
  )
}

export function useFirmarEnPapel() {
  return useMutacionDePermiso(
    (transporte, variables: { permisoId: string; cargos: TipoDeCargo[]; escaneoId: string }) =>
      transporte.ejecutar(FirmarEnPapelDocument, variables),
  )
}

export function useQuitarAdjunto() {
  return useMutacionDePermiso((transporte, variables: { permisoId: string; adjuntoId: string }) =>
    transporte.ejecutar(QuitarAdjuntoDocument, variables),
  )
}

export function useAnularPermiso() {
  return useMutacionDePermiso((transporte, variables: { permisoId: string }) =>
    transporte.ejecutar(AnularPermisoDocument, variables),
  )
}

export function useReEmitirPermiso() {
  return useMutacionDePermiso((transporte, variables: { permisoId: string }) =>
    transporte.ejecutar(ReEmitirPermisoDocument, variables),
  )
}

/** Sube un archivo y lo cuelga del permiso. Los tres pasos juntos: la pantalla
 *  elige un archivo y espera que quede subido, no quiere saber del protocolo.
 *
 *  Los bytes van por PUT y no por GraphQL: acopla la transferencia de binarios
 *  al lenguaje de consultas y transmite mal (spec base §9.2). */
export function useSubirArchivo() {
  return useMutacionDePermiso(
    async (
      transporte,
      variables: { permisoId: string; archivo: File; adjuntar: boolean },
    ): Promise<string> => {
      const { solicitarSubida } = await transporte.ejecutar(SolicitarSubidaDocument, {
        nombre: variables.archivo.name,
        tipo: variables.archivo.type,
        tamano: variables.archivo.size,
        modulo: 'salidas',
        recursoId: variables.permisoId,
      })

      // El origen del transporte y no la URL relativa que devuelve el servidor:
      // en el navegador daria igual, pero React Native no tiene contra que
      // resolverla.
      const puesto = await fetch(`${transporte.origen}${solicitarSubida.url}`, {
        method: 'PUT',
        body: variables.archivo,
      })
      if (!puesto.ok) throw new Error(await puesto.text())

      await transporte.ejecutar(ConfirmarSubidaDocument, { id: solicitarSubida.id })
      if (variables.adjuntar) {
        await transporte.ejecutar(AdjuntarAPermisoDocument, {
          permisoId: variables.permisoId,
          archivoId: solicitarSubida.id,
        })
      }
      return solicitarSubida.id
    },
  )
}
