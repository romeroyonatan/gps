import { describe, expect, test } from 'bun:test'
import { QueryClient, QueryObserver } from '@tanstack/react-query'
import { limpiarCacheDeSesion } from '../src/auth'

/** Una pantalla montada mirando `personaActual`, que es lo que decide si se
 *  dibuja la app o el login. Junta los avisos que recibe: que le avisen es
 *  justamente lo que estaba faltando. */
function pantallaMontada(cliente: QueryClient, contesta: () => unknown) {
  const observador = new QueryObserver(cliente, {
    queryKey: ['personaActual'],
    queryFn: async () => contesta(),
    staleTime: 0,
  })
  const avisos: unknown[] = []
  const desuscribir = observador.subscribe((resultado) => avisos.push(resultado.data))
  return { observador, avisos, desuscribir }
}

const unLatido = () => new Promise((seguir) => setTimeout(seguir, 20))

describe('limpiarCacheDeSesion', () => {
  test('la pantalla montada se entera de que ya no hay nadie', async () => {
    const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    let quien: unknown = { personaActual: { personaId: 'persona_1' } }
    const pantalla = pantallaMontada(cliente, () => quien)
    await unLatido()
    expect(pantalla.observador.getCurrentResult().data).toEqual({
      personaActual: { personaId: 'persona_1' },
    })

    // Cerrar sesión: el servidor ya la revocó, así que desde acá se contesta
    // anónimo.
    quien = { personaActual: null }
    await limpiarCacheDeSesion(cliente)
    await unLatido()

    // Lo que no pasaba con `clear()`: vaciaba el cache sin avisarle a nadie y
    // la pantalla seguía dibujando a quien ya había salido.
    expect(pantalla.observador.getCurrentResult().data).toEqual({ personaActual: null })
    pantalla.desuscribir()
  })

  test('lo de la sesión anterior no queda en el cache', async () => {
    const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    cliente.setQueryData(['personas', 'grupo_1'], { personas: ['la de antes'] })

    await limpiarCacheDeSesion(cliente)

    expect(cliente.getQueryData(['personas', 'grupo_1'])).toBeUndefined()
  })
})
