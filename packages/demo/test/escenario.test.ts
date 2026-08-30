import { Database } from 'bun:sqlite'
import { describe, expect, test } from 'bun:test'
import { aplicarMigraciones, type Bd, type Context, type Core } from '@gps/core'
import { estructura } from '@gps/estructura/servidor'
import { personas } from '@gps/personas/servidor'
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
    // El demo siembra personas con fechas de nacimiento reales, asi que el reloj
    // no puede estar en 1970: con esa hora, nacer en 2020 seria nacer en el
    // futuro y la validacion rechazaria la siembra. Se usa una fecha fija
    // posterior a todas ellas, no la del sistema, para que el test no cambie de
    // resultado con el paso del tiempo.
    reloj: { ahora: () => new Date('2026-08-27T00:00:00Z') },
    bd,
    modulos: ['estructura', 'personas'],
    nuevoId: (prefijo) => `${prefijo}_${++contador}`,
  }

  aplicarMigraciones(core, [estructura, personas])
  // personas depende de estructura, asi que hay que construirla primero y
  // pasarsela: es el mismo cableado que hace crearServicios en la raiz de
  // composicion, a mano porque el test arma su propio contexto.
  const servicioDeEstructura = estructura.createServices(core, {})
  return {
    actor: null,
    estructura: servicioDeEstructura,
    personas: personas.createServices(core, { estructura: servicioDeEstructura }),
  } as Context
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

describe('sembrarEscenario: personas', () => {
  test('siembra las doce personas del grupo 42, el que tiene las seis ramas', async () => {
    const contexto = montarContexto()
    await sembrarEscenario(contexto)
    const distritos = await contexto.estructura.listarDistritos()
    const grupo42 = distritos.flatMap((d) => d.grupos).find((g) => g.numero === 42)
    expect(await contexto.personas.listarPersonas(grupo42?.id ?? '')).toHaveLength(12)
  })

  test('las edades cubren el rango entero, de castores a adulto mayor', async () => {
    // Un demo donde todas las personas tienen la misma edad no muestra si la
    // pantalla aguanta el numero de un digito ni el de dos.
    const contexto = montarContexto()
    await sembrarEscenario(contexto)

    const distritos = await contexto.estructura.listarDistritos()
    const grupo42 = distritos.flatMap((d) => d.grupos).find((g) => g.numero === 42)
    const anios = (await contexto.personas.listarPersonas(grupo42?.id ?? '')).map((persona) =>
      Number(persona.fechaDeNacimiento.slice(0, 4)),
    )
    expect(Math.min(...anios)).toBeLessThan(1970)
    expect(Math.max(...anios)).toBeGreaterThan(2018)
  })

  test('hay al menos un pasaporte entre los DNI', async () => {
    const contexto = montarContexto()
    await sembrarEscenario(contexto)

    const distritos = await contexto.estructura.listarDistritos()
    const grupo42 = distritos.flatMap((d) => d.grupos).find((g) => g.numero === 42)
    const tipos = (await contexto.personas.listarPersonas(grupo42?.id ?? '')).map(
      (persona) => persona.tipoDeDocumento,
    )
    expect(tipos).toContain('pasaporte')
    expect(tipos).toContain('dni')
  })

  test('la primera de la lista es la del apellido con acento', async () => {
    // Ávila antes que Bustos: si el orden fuera por bytes, "Ávila" caeria
    // ultima. Es el test que ejercita Intl.Collator con datos del demo.
    const contexto = montarContexto()
    await sembrarEscenario(contexto)

    const distritos = await contexto.estructura.listarDistritos()
    const grupo42 = distritos.flatMap((d) => d.grupos).find((g) => g.numero === 42)
    const listadas = await contexto.personas.listarPersonas(grupo42?.id ?? '')
    expect(listadas[0]?.apellidos).toBe('Ávila')
    expect(listadas.at(-1)?.apellidos).toBe('Zaballa')
  })

  test('reparte las personas en grupos, con un grupo lleno y uno vacio', async () => {
    const ctx = montarContexto()
    await sembrarEscenario(ctx)
    const distritos = await ctx.estructura.listarDistritos()
    const grupo42 = distritos.flatMap((d) => d.grupos).find((g) => g.numero === 42)
    const grupo88 = distritos.flatMap((d) => d.grupos).find((g) => g.numero === 88)

    // El 42 tiene las seis ramas abiertas: es el que ejercita la pantalla llena.
    expect((await ctx.personas.listarPersonas(grupo42?.id ?? '')).length).toBeGreaterThan(8)
    // El 88 no abrio ninguna rama: la pantalla tiene que resolver "no hay ramas"
    // y "no hay personas" a la vez.
    expect(await ctx.personas.listarPersonas(grupo88?.id ?? '')).toEqual([])
  })

  test('siembra un cargo vigente y uno vencido', async () => {
    const ctx = montarContexto()
    await sembrarEscenario(ctx)
    const distritos = await ctx.estructura.listarDistritos()
    const grupo42 = distritos.flatMap((d) => d.grupos).find((g) => g.numero === 42)
    const cargos = (await ctx.personas.listarPersonas(grupo42?.id ?? '')).flatMap((p) => p.cargos)

    // Los dos casos, para que estaVigente tenga con que trabajar en pantalla.
    expect(cargos.some((cargo) => cargo.hasta === null)).toBe(true)
    expect(cargos.some((cargo) => cargo.hasta !== null)).toBe(true)
  })
})
