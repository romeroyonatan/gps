import { describe, expect, test } from 'bun:test'
import { almacenPorPersona } from '../src/cache'

/** Un almacén de juguete: lo que importa es bajo qué clave termina cada cosa. */
function almacenFalso() {
  const guardado = new Map<string, string>()
  return {
    guardado,
    getItem: async (clave: string) => guardado.get(clave) ?? null,
    setItem: async (clave: string, valor: string) => {
      guardado.set(clave, valor)
    },
    removeItem: async (clave: string) => {
      guardado.delete(clave)
    },
  }
}

describe('almacenPorPersona', () => {
  test('cada persona escribe bajo su propia clave', async () => {
    const disco = almacenFalso()
    const particion = almacenPorPersona(disco)

    particion.usar('persona_1')
    await particion.almacen.setItem('gps-cache', 'lo de la primera')
    particion.usar('persona_2')
    await particion.almacen.setItem('gps-cache', 'lo de la segunda')

    expect([...disco.guardado.keys()].sort()).toEqual([
      'gps-cache:persona_1',
      'gps-cache:persona_2',
    ])
  })

  test('una persona no lee lo que dejó la anterior', async () => {
    const disco = almacenFalso()
    const particion = almacenPorPersona(disco)

    particion.usar('persona_1')
    await particion.almacen.setItem('gps-cache', 'lo de la primera')

    particion.usar('persona_2')
    expect(await particion.almacen.getItem('gps-cache')).toBeNull()

    particion.usar('persona_1')
    expect(await particion.almacen.getItem('gps-cache')).toBe('lo de la primera')
  })

  test('sin sesión se escribe en la partición anónima, no en la de nadie', async () => {
    const disco = almacenFalso()
    const particion = almacenPorPersona(disco)

    particion.usar('persona_1')
    await particion.almacen.setItem('gps-cache', 'lo de la primera')
    particion.usar(null)
    await particion.almacen.setItem('gps-cache', 'lo de nadie')

    expect(disco.guardado.get('gps-cache:persona_1')).toBe('lo de la primera')
    expect(disco.guardado.get('gps-cache:anonimo')).toBe('lo de nadie')
  })
})
