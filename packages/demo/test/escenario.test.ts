import { Database } from 'bun:sqlite'
import { describe, expect, test } from 'bun:test'
import { aplicarMigraciones, type Bd, type Context, type Core } from '@gps/core'
import { estructura } from '@gps/estructura/servidor'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { sembrarEscenario } from '../src/servidor/escenario'

function montarContexto(): Context {
  const base = new Database(':memory:')
  base.exec('PRAGMA foreign_keys = ON')
  const bd: Bd = drizzle(base)

  let contador = 0
  const core: Core = {
    config: { version: '0.0.0', entorno: 'demo', puerto: 0 },
    logger: { info: () => {}, error: () => {} },
    reloj: { ahora: () => new Date('1970-01-01T00:00:00Z') },
    bd,
    modulos: ['estructura'],
    nuevoId: (prefijo) => `${prefijo}_${++contador}`,
  }

  aplicarMigraciones(core, [estructura])
  return { actor: null, estructura: estructura.createServices(core) } as Context
}

describe('sembrarEscenario', () => {
  test('siembra la diocesis entera pasando por los servicios publicos', async () => {
    // Que pase por los servicios y no por SQL es la propiedad que importa: los
    // datos del demo cruzan las mismas reglas que los reales, asi que es
    // imposible sembrar algo que el sistema consideraria invalido.
    const contexto = montarContexto()
    await sembrarEscenario(contexto)

    const arbol = await contexto.estructura.listarDistritos()
    expect(arbol).toHaveLength(4)
    expect(arbol.flatMap((distrito) => distrito.grupos)).toHaveLength(12)
  })

  test('deja al menos un grupo con las seis ramas y otro sin ninguna', async () => {
    // El demo existe para mirar pantallas: si todos los grupos fueran iguales
    // no mostraria ni el caso lleno ni el vacio, que son los que se rompen.
    const contexto = montarContexto()
    await sembrarEscenario(contexto)

    const todos = (await contexto.estructura.listarDistritos()).flatMap((d) => d.grupos)
    expect(todos.some((grupo) => grupo.ramas.length === 6)).toBe(true)
    expect(todos.some((grupo) => grupo.ramas.length === 0)).toBe(true)
  })

  test('el grupo cerrado no aparece en el arbol', async () => {
    // Ejercita el filtro de listarDistritos con datos sembrados por el demo,
    // no armados a mano en el test.
    const contexto = montarContexto()
    await sembrarEscenario(contexto)

    const todos = (await contexto.estructura.listarDistritos()).flatMap((d) => d.grupos)
    expect(todos.some((grupo) => grupo.numero === 19)).toBe(false)
  })
})
