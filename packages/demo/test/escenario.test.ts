import { Database } from 'bun:sqlite'
import { describe, expect, test } from 'bun:test'
import { afiliacion } from '@gps/afiliacion/servidor'
import { archivos, autorizadores } from '@gps/archivos/servidor'
import {
  alcanceSinLimites,
  aplicarMigraciones,
  type Bd,
  type Context,
  type Core,
  crearBusDeEventos,
} from '@gps/core'
import { aFechaDeCalendario } from '@gps/core/fechas'
import { ramasDeLasUnidades } from '@gps/estructura/dominio'
import { estructura } from '@gps/estructura/servidor'
import { personas } from '@gps/personas/servidor'
import { salidas } from '@gps/salidas/servidor'
import { tesoreria } from '@gps/tesoreria/servidor'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { sembrarEscenario } from '../src/servidor/escenario'

/** El dia que ven los tests. Fija y no la del sistema para que el resultado no
 *  cambie con el paso del tiempo, y posterior a todas las fechas de nacimiento
 *  que siembra el demo. */
const HORA = new Date('2026-08-27T12:00:00Z')

function montarContexto(hora = HORA): Context {
  const base = new Database(':memory:')
  base.exec('PRAGMA foreign_keys = ON')
  const bd: Bd = drizzle(base)

  let contador = 0
  const core: Core = {
    config: { version: '0.0.0', entorno: 'demo', puerto: 0, auth: null },
    logger: { info: () => {}, error: () => {} },
    // El demo siembra personas con fechas de nacimiento reales, asi que el reloj
    // no puede estar en 1970: con esa hora, nacer en 2020 seria nacer en el
    // futuro y la validacion rechazaria la siembra. Se usa una fecha fija
    // posterior a todas ellas, no la del sistema, para que el test no cambie de
    // resultado con el paso del tiempo. Al mediodia y no a medianoche:
    // aFechaDeCalendario usa componentes locales, asi que un instante a las
    // 00:00 UTC cae en el dia anterior al oeste de Greenwich.
    reloj: { ahora: () => hora },
    bd,
    eventos: crearBusDeEventos(),
    modulos: ['estructura', 'personas', 'afiliacion', 'tesoreria', 'archivos', 'salidas'],
    // Falso pero con el comportamiento que importa: sellar y verificar cierran
    // entre si, y un dato alterado no verifica.
    sellador: {
      sellar: (datos: string) => ({ sello: `sellado:${datos}`, claveId: 'prueba' }),
      verificar: (datos: string, sello: { sello: string; claveId: string }) =>
        sello.claveId === 'prueba' && sello.sello === `sellado:${datos}`,
    },
    almacenamiento: {
      guardar: async () => {},
      leer: async () => new Uint8Array(),
      eliminar: async () => {},
    },
    conversorDeImagenes: { aJpeg: async (contenido: Uint8Array) => contenido },
    // Falso pero estable y sensible al contenido, que es lo que los tests miran.
    hash: (contenido: Uint8Array | string) =>
      `hash:${typeof contenido === 'string' ? contenido : contenido.join(',')}`,
    nuevoId: (prefijo) => `${prefijo}_${++contador}`,
    nuevoSecreto: () => `secreto_${++contador}`,
  }

  aplicarMigraciones(core, [estructura, personas, afiliacion, tesoreria, archivos, salidas])
  // personas depende de estructura y afiliacion de las dos, asi que se
  // construyen en ese orden: es el mismo cableado que hace crearServicios en la
  // raiz de composicion, a mano porque el test arma su propio contexto.
  const servicioDeEstructura = estructura.createServices(core, {})
  const servicioDePersonas = personas.createServices(core, { estructura: servicioDeEstructura })
  const servicioDeAfiliacion = afiliacion.createServices(core, {
    personas: servicioDePersonas,
    estructura: servicioDeEstructura,
  })
  // Lo que hace la raiz de composicion: sin esto, `archivos` no entrega nada
  // porque nadie reclama los archivos de salidas.
  autorizadores.salidas = async () => true
  const servicioDeArchivos = archivos.createServices(core, {})
  return {
    actor: null,
    alcance: null,
    estructura: servicioDeEstructura,
    personas: servicioDePersonas,
    afiliacion: servicioDeAfiliacion,
    tesoreria: tesoreria.createServices(core, {
      afiliacion: servicioDeAfiliacion,
      estructura: servicioDeEstructura,
    }),
    archivos: servicioDeArchivos,
    salidas: salidas.createServices(core, {
      personas: servicioDePersonas,
      estructura: servicioDeEstructura,
      archivos: servicioDeArchivos,
    }),
  } as Context
}

describe('sembrarEscenario', () => {
  test('siembra la diocesis entera pasando por los servicios publicos', async () => {
    // Que pase por los servicios y no por SQL es la propiedad que importa: los
    // datos del demo cruzan las mismas reglas que los reales, asi que es
    // imposible sembrar algo que el sistema consideraria invalido.
    const contexto = montarContexto()
    await sembrarEscenario(contexto, HORA)

    const arbol = await contexto.estructura.listarDistritos(alcanceSinLimites())
    expect(arbol).toHaveLength(4)
    expect(arbol.flatMap((distrito) => distrito.grupos)).toHaveLength(12)
  })

  test('deja al menos un grupo con las seis ramas y otro sin ninguna', async () => {
    // El demo existe para mirar pantallas: si todos los grupos fueran iguales
    // no mostraria ni el caso lleno ni el vacio, que son los que se rompen.
    const contexto = montarContexto()
    await sembrarEscenario(contexto, HORA)

    const todos = (await contexto.estructura.listarDistritos(alcanceSinLimites())).flatMap(
      (d) => d.grupos,
    )
    expect(todos.some((grupo) => ramasDeLasUnidades(grupo.unidades).length === 6)).toBe(true)
    expect(todos.some((grupo) => grupo.unidades.length === 0)).toBe(true)
  })

  test('deja un grupo con dos tropas scout, que es lo que antes no se podia', async () => {
    const contexto = montarContexto()
    await sembrarEscenario(contexto, HORA)

    const todos = (await contexto.estructura.listarDistritos(alcanceSinLimites())).flatMap(
      (d) => d.grupos,
    )
    const scouts = todos
      .find((grupo) => grupo.numero === 42)
      ?.unidades.filter((unidad) => unidad.rama === 'scouts')
    expect(scouts?.map((unidad) => unidad.sexo).sort()).toEqual(['femenina', 'masculina'])
  })

  test('siembra los cargos que un permiso de salida necesita para firmarse', async () => {
    // Los tres firmantes: jefe de grupo y director del grupo, y comisionado del
    // distrito al que ese grupo pertenece.
    const contexto = montarContexto()
    await sembrarEscenario(contexto, HORA)

    const grupos = (await contexto.estructura.listarDistritos(alcanceSinLimites())).flatMap((d) =>
      d.grupos.map((grupo) => ({ ...grupo, distritoId: d.id })),
    )
    const g42 = grupos.find((grupo) => grupo.numero === 42)
    if (!g42) throw new Error('el escenario no tiene el grupo 42')
    const hoy = aFechaDeCalendario(new Date())

    for (const cargo of ['jefeDeGrupo', 'director'] as const) {
      expect((await contexto.personas.ocupantesDelCargo(cargo, g42.id, hoy)).length).toBe(1)
    }
    expect(
      (await contexto.personas.ocupantesDelCargo('comisionadoDeDistrito', g42.distritoId, hoy))
        .length,
    ).toBe(1)
  })

  test('siembra el cargo de la diocesis, que no apunta a ninguna entidad', async () => {
    const contexto = montarContexto()
    await sembrarEscenario(contexto, HORA)

    const ocupantes = await contexto.personas.ocupantesDelCargo(
      'jefeScoutDiocesano',
      null,
      aFechaDeCalendario(new Date()),
    )
    expect(ocupantes.length).toBe(1)
  })

  test('el grupo cerrado no aparece en el arbol', async () => {
    // Ejercita el filtro de listarDistritos con datos sembrados por el demo,
    // no armados a mano en el test.
    const contexto = montarContexto()
    await sembrarEscenario(contexto, HORA)

    const todos = (await contexto.estructura.listarDistritos(alcanceSinLimites())).flatMap(
      (d) => d.grupos,
    )
    expect(todos.some((grupo) => grupo.numero === 19)).toBe(false)
  })

  test('deja declaraciones para mirar: la ordinaria vencida y una extraordinaria', async () => {
    const contexto = montarContexto()
    await sembrarEscenario(contexto, HORA)

    const grupos = (await contexto.estructura.listarDistritos(alcanceSinLimites())).flatMap(
      (distrito) => distrito.grupos,
    )
    const grupo42 = grupos.find((grupo) => grupo.numero === 42)
    expect(grupo42).toBeDefined()

    const declaraciones = await contexto.afiliacion.listarDeclaraciones(grupo42?.id ?? '')
    // La ordinaria del 1 de mayo de 2026 y la extraordinaria del dia del reloj.
    expect(declaraciones.map((una) => una.fecha)).toEqual(['2026-08-27', '2026-05-01'])

    // En la ordinaria, que es la primera del periodo, todos son cobrables.
    const ordinaria = declaraciones[1]
    const nomina = await contexto.afiliacion.listarAfiliados(ordinaria?.id ?? '')
    expect(nomina).not.toHaveLength(0)
    expect(await contexto.afiliacion.listarACobrar(ordinaria?.id ?? '')).toEqual(nomina)

    // En la extraordinaria, la nomina es la misma y no hay nada que cobrar:
    // nadie ingreso entre mayo y agosto. Es el caso que la pantalla tiene que
    // saber dibujar.
    const extraordinaria = declaraciones[0]
    expect(await contexto.afiliacion.listarAfiliados(extraordinaria?.id ?? '')).toHaveLength(
      nomina.length,
    )
    expect(await contexto.afiliacion.listarACobrar(extraordinaria?.id ?? '')).toEqual([])
  })

  test('siembra igual los dos dias del anio que caen en una fecha ordinaria', async () => {
    // El 1 de mayo y el 1 de noviembre la ordinaria del grupo 42 ya lleva la
    // fecha de hoy, asi que la extraordinaria del escenario no puede emitirse.
    // Antes eso era un SQLiteError crudo y `bun run demo` no arrancaba.
    const contexto = montarContexto(new Date('2026-05-01T12:00:00Z'))
    await sembrarEscenario(contexto, HORA)

    const grupos = (await contexto.estructura.listarDistritos(alcanceSinLimites())).flatMap(
      (distrito) => distrito.grupos,
    )
    const grupo42 = grupos.find((grupo) => grupo.numero === 42)
    const declaraciones = await contexto.afiliacion.listarDeclaraciones(grupo42?.id ?? '')
    expect(declaraciones.map((una) => una.fecha)).toEqual(['2026-05-01'])
  })
})

describe('sembrarEscenario: personas', () => {
  test('siembra las doce personas del grupo 42, el que tiene las seis ramas', async () => {
    const contexto = montarContexto()
    await sembrarEscenario(contexto, HORA)
    const distritos = await contexto.estructura.listarDistritos(alcanceSinLimites())
    const grupo42 = distritos.flatMap((d) => d.grupos).find((g) => g.numero === 42)
    expect(
      await contexto.personas.listarPersonas(alcanceSinLimites(), grupo42?.id ?? ''),
    ).toHaveLength(12)
  })

  test('las edades cubren el rango entero, de castores a adulto mayor', async () => {
    // Un demo donde todas las personas tienen la misma edad no muestra si la
    // pantalla aguanta el numero de un digito ni el de dos.
    const contexto = montarContexto()
    await sembrarEscenario(contexto, HORA)

    const distritos = await contexto.estructura.listarDistritos(alcanceSinLimites())
    const grupo42 = distritos.flatMap((d) => d.grupos).find((g) => g.numero === 42)
    const anios = (
      await contexto.personas.listarPersonas(alcanceSinLimites(), grupo42?.id ?? '')
    ).map((persona) => Number(persona.fechaDeNacimiento.slice(0, 4)))
    expect(Math.min(...anios)).toBeLessThan(1970)
    expect(Math.max(...anios)).toBeGreaterThan(2018)
  })

  test('hay al menos un pasaporte entre los DNI', async () => {
    const contexto = montarContexto()
    await sembrarEscenario(contexto, HORA)

    const distritos = await contexto.estructura.listarDistritos(alcanceSinLimites())
    const grupo42 = distritos.flatMap((d) => d.grupos).find((g) => g.numero === 42)
    const tipos = (
      await contexto.personas.listarPersonas(alcanceSinLimites(), grupo42?.id ?? '')
    ).map((persona) => persona.tipoDeDocumento)
    expect(tipos).toContain('pasaporte')
    expect(tipos).toContain('dni')
  })

  test('la primera de la lista es la del apellido con acento', async () => {
    // Ávila antes que Bustos: si el orden fuera por bytes, "Ávila" caeria
    // ultima. Es el test que ejercita Intl.Collator con datos del demo.
    const contexto = montarContexto()
    await sembrarEscenario(contexto, HORA)

    const distritos = await contexto.estructura.listarDistritos(alcanceSinLimites())
    const grupo42 = distritos.flatMap((d) => d.grupos).find((g) => g.numero === 42)
    const listadas = await contexto.personas.listarPersonas(alcanceSinLimites(), grupo42?.id ?? '')
    expect(listadas[0]?.apellidos).toBe('Ávila')
    expect(listadas.at(-1)?.apellidos).toBe('Zaballa')
  })

  test('reparte las personas en grupos, con un grupo lleno y uno vacio', async () => {
    const ctx = montarContexto()
    await sembrarEscenario(ctx, HORA)
    const distritos = await ctx.estructura.listarDistritos(alcanceSinLimites())
    const grupo42 = distritos.flatMap((d) => d.grupos).find((g) => g.numero === 42)
    const grupo88 = distritos.flatMap((d) => d.grupos).find((g) => g.numero === 88)

    // El 42 tiene las seis ramas abiertas: es el que ejercita la pantalla llena.
    expect(
      (await ctx.personas.listarPersonas(alcanceSinLimites(), grupo42?.id ?? '')).length,
    ).toBeGreaterThan(8)
    // El 88 no abrio ninguna rama: la pantalla tiene que resolver "no hay ramas"
    // y "no hay personas" a la vez.
    expect(await ctx.personas.listarPersonas(alcanceSinLimites(), grupo88?.id ?? '')).toEqual([])
  })

  test('siembra un cargo vigente y uno vencido', async () => {
    const ctx = montarContexto()
    await sembrarEscenario(ctx, HORA)
    const distritos = await ctx.estructura.listarDistritos(alcanceSinLimites())
    const grupo42 = distritos.flatMap((d) => d.grupos).find((g) => g.numero === 42)
    const cargos = (
      await ctx.personas.listarPersonas(alcanceSinLimites(), grupo42?.id ?? '')
    ).flatMap((p) => p.cargos)

    // Los dos casos, para que estaVigente tenga con que trabajar en pantalla.
    expect(cargos.some((cargo) => cargo.hasta === null)).toBe(true)
    expect(cargos.some((cargo) => cargo.hasta !== null)).toBe(true)
  })

  test('siembra cuentas con pago parcial y saldo a favor', async () => {
    const ctx = montarContexto()
    await sembrarEscenario(ctx, HORA)

    const cuentas = await ctx.tesoreria.listarCuentas(alcanceSinLimites())
    expect(cuentas.some((cuenta) => cuenta.saldo > 0)).toBe(true)
    expect(cuentas.some((cuenta) => cuenta.saldo < 0)).toBe(true)
    expect((await ctx.tesoreria.resumenDePendientes(alcanceSinLimites())).cantidad).toBe(0)
  })
})
