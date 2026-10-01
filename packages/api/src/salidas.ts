import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AdjuntarAPermisoDocument,
  AgregarParticipanteDocument,
  AnularPermisoDocument,
  ConfirmarSubidaDocument,
  CrearPermisoDocument,
  ElegirResponsableDocument,
  ElegirUnidadesDocument,
  EmitirPermisoDocument,
  FirmarEnAppDocument,
  FirmarEnPapelDocument,
  PermisosDocument,
  QuitarAdjuntoDocument,
  QuitarParticipanteDocument,
  ReEmitirPermisoDocument,
  SolicitarSubidaDocument,
} from './generated/graphql'
import { useMutacion, useTransporte } from './proveedor'

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
const PERMISOS = ['permisos']

export const useCrearPermiso = () => useMutacion(CrearPermisoDocument, PERMISOS)
export const useElegirResponsable = () => useMutacion(ElegirResponsableDocument, PERMISOS)
export const useElegirUnidades = () => useMutacion(ElegirUnidadesDocument, PERMISOS)
export const useAgregarParticipante = () => useMutacion(AgregarParticipanteDocument, PERMISOS)
export const useQuitarParticipante = () => useMutacion(QuitarParticipanteDocument, PERMISOS)
export const useEmitirPermiso = () => useMutacion(EmitirPermisoDocument, PERMISOS)
export const useFirmarEnApp = () => useMutacion(FirmarEnAppDocument, PERMISOS)
export const useFirmarEnPapel = () => useMutacion(FirmarEnPapelDocument, PERMISOS)
export const useQuitarAdjunto = () => useMutacion(QuitarAdjuntoDocument, PERMISOS)
export const useAnularPermiso = () => useMutacion(AnularPermisoDocument, PERMISOS)
export const useReEmitirPermiso = () => useMutacion(ReEmitirPermisoDocument, PERMISOS)

/** Sube un archivo y lo cuelga del permiso. Los tres pasos juntos: la pantalla
 *  elige un archivo y espera que quede subido, no quiere saber del protocolo.
 *
 *  Los bytes van por PUT y no por GraphQL: acopla la transferencia de binarios
 *  al lenguaje de consultas y transmite mal (spec base §9.2). */
export function useSubirArchivo() {
  const transporte = useTransporte()
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: async (variables: {
      permisoId: string
      archivo: File
      adjuntar: boolean
    }): Promise<string> => {
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
    onSuccess: () => cliente.invalidateQueries({ queryKey: PERMISOS }),
  })
}
