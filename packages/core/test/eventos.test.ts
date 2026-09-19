import { describe, expect, test } from 'bun:test'
import { crearBusDeEventos } from '../src/eventos'

type EventosDePrueba = {
  saludo: { texto: string }
}

describe('bus de eventos', () => {
  test('publica a todos los suscriptores y permite desuscribirse', async () => {
    const bus = crearBusDeEventos<EventosDePrueba>()
    const recibidos: string[] = []
    const desuscribir = bus.suscribir('saludo', ({ texto }) => {
      recibidos.push(`uno: ${texto}`)
    })
    bus.suscribir('saludo', async ({ texto }) => {
      recibidos.push(`dos: ${texto}`)
    })

    await bus.publicar('saludo', { texto: 'hola' })
    desuscribir()
    await bus.publicar('saludo', { texto: 'chau' })

    expect(recibidos).toEqual(['uno: hola', 'dos: hola', 'dos: chau'])
  })

  test('propaga el error de un suscriptor', async () => {
    const bus = crearBusDeEventos<EventosDePrueba>()
    bus.suscribir('saludo', () => {
      throw new Error('fallo')
    })

    expect(bus.publicar('saludo', { texto: 'hola' })).rejects.toThrow('fallo')
  })
})
