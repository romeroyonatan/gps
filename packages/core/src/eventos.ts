declare const vacio: unique symbol

export interface Eventos {
  readonly [vacio]?: never
}

export interface BusDeEventos<E extends object = Eventos> {
  suscribir<K extends keyof E>(
    nombre: K,
    handler: (evento: E[K]) => void | Promise<void>,
  ): () => void
  publicar<K extends keyof E>(nombre: K, evento: E[K]): Promise<void>
}

/** Bus minimo: los handlers corren en este proceso y publicar espera a todos. */
export function crearBusDeEventos<E extends object = Eventos>(): BusDeEventos<E> {
  const handlers = new Map<keyof E, Set<(evento: E[keyof E]) => void | Promise<void>>>()

  return {
    suscribir(nombre, handler) {
      const delEvento = handlers.get(nombre) ?? new Set()
      delEvento.add(handler as (evento: E[keyof E]) => void | Promise<void>)
      handlers.set(nombre, delEvento)
      return () => delEvento.delete(handler as (evento: E[keyof E]) => void | Promise<void>)
    },

    async publicar(nombre, evento) {
      await Promise.all([...(handlers.get(nombre) ?? [])].map((handler) => handler(evento)))
    },
  }
}
