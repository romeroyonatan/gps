import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { usePersonaActual } from './auth'

/** Lo mínimo que el persister de TanStack le pide a un almacén: el de la web
 *  es IndexedDB y el de mobile `AsyncStorage`, y los dos entran acá. */
export interface AlmacenDelCache {
  getItem(clave: string): Promise<string | null>
  setItem(clave: string, valor: string): Promise<void>
  removeItem(clave: string): Promise<void>
}

/** El cache persistido, partido por persona.
 *
 *  Dos cosas distintas y las dos hacen falta. La partición: cada persona
 *  escribe bajo su propia clave, así lo que quedó en el disco de un teléfono
 *  compartido no lo lee la siguiente. Y la purga: al cambiar de persona se
 *  tira lo que está en memoria, porque el `QueryClient` sobrevive al cambio y
 *  sus datos son de la sesión anterior.
 *
 *  El servidor filtra siempre; esto es para que el cache de un dispositivo no
 *  muestre datos de otra persona antes de que llegue la primera respuesta. */
export function almacenPorPersona(almacen: AlmacenDelCache) {
  let persona = 'anonimo'
  const conPersona = (clave: string) => `${clave}:${persona}`

  return {
    almacen: {
      getItem: (clave: string) => almacen.getItem(conPersona(clave)),
      setItem: (clave: string, valor: string) => almacen.setItem(conPersona(clave), valor),
      removeItem: (clave: string) => almacen.removeItem(conPersona(clave)),
    } satisfies AlmacenDelCache,

    /** Cambia la partición activa. Lo llama `useParticionDelCache`. */
    usar(personaId: string | null) {
      persona = personaId ?? 'anonimo'
    },
  }
}

export type ParticionDelCache = ReturnType<typeof almacenPorPersona>

/** Mantiene la partición apuntando a quien tiene la sesión abierta, y tira el
 *  cache en memoria cada vez que eso cambia: cerrar sesión, entrar con otra
 *  persona, o recuperar una identidad -que revoca todas las sesiones y obliga
 *  a entrar de nuevo-. */
export function useParticionDelCache(particion: ParticionDelCache): void {
  const clienteDeQueries = useQueryClient()
  const sesion = usePersonaActual()
  const personaId = sesion.data?.personaActual?.personaId ?? null
  const anterior = useRef<string | null | undefined>(undefined)

  useEffect(() => {
    // Mientras no se sabe quién es, no se toca nada: `undefined` es "todavía
    // no contestó", que no es lo mismo que "nadie".
    if (sesion.isPending) return
    if (anterior.current === personaId) return

    const habiaOtra = anterior.current !== undefined
    anterior.current = personaId
    particion.usar(personaId)
    // En el primer arranque no hay nada que tirar: lo que se restauró es de
    // esta misma persona, que es justamente para lo que sirve la partición.
    if (habiaOtra) {
      clienteDeQueries.removeQueries({
        predicate: (query) => query.queryKey[0] !== 'personaActual',
      })
    }
  }, [sesion.isPending, personaId, particion, clienteDeQueries])
}
