import type { Actor, Rol } from './actor'

/** Si el actor ejerce alguna de esas funciones en ese ámbito concreto.
 *
 *  Vive en un subpath propio y no en el índice de `@gps/core` porque lo usan
 *  las políticas, que son `/dominio` y las importa el navegador: el índice
 *  arrastra Pothos y Drizzle con imports de valor. */
export function tieneRol(
  actor: Actor,
  roles: readonly Rol[],
  tipo: 'grupo' | 'distrito' | 'diocesis',
  id: string | null,
): boolean {
  return actor.roles.some(
    (funcion) =>
      roles.includes(funcion.rol) && funcion.ambito.tipo === tipo && funcion.ambito.id === id,
  )
}
