import { describe, expect, test } from 'bun:test'
import type { Config } from '@gps/core'
import { execute, parse } from 'graphql'
import { crearAlmacenamientoEnMemoria } from '../src/almacenamiento'
import { crearBd } from '../src/bd'
import { componer } from '../src/composicion'
import { crearContexto } from '../src/context'
import { crearConversorDeImagenes } from '../src/conversor'
import { crearSellador } from '../src/sellador'

/** Las pruebas de seguridad del cambio completo, contra la app compuesta de
 *  verdad: el mismo esquema, el mismo contexto por pedido y la misma
 *  derivación de cargos y equipos que sirve la API.
 *
 *  Todas preguntan lo mismo: cuando algo falla, ¿falla cerrado? Un test que
 *  sólo mira el camino feliz no contesta eso.
 *
 *  Corren en entorno demo porque ahí existe el proveedor de un clic, que
 *  recorre exactamente el mismo camino que Google: transacción sellada,
 *  `state`, callback y sesión opaca. Sin él haría falta salir a la red. */
const config: Config = { version: '0.0.0', entorno: 'demo', puerto: 0, auth: null }
const sellador = crearSellador({ prueba: 'una-clave' }, 'prueba')

async function montar() {
  const { esquema, contexto, reloj } = await componer(
    config,
    crearBd(':memory:'),
    sellador,
    crearAlmacenamientoEnMemoria(),
    crearConversorDeImagenes(),
  )
  const porPedido = crearContexto(contexto, reloj)

  /** Entra con un perfil del demo y devuelve el secreto de su sesión. */
  const entrar = async (perfil: string) => {
    const inicio = contexto.auth.iniciarLogin(
      'demo',
      'web',
      `http://gps.test/auth/demo/callback?perfil=${perfil}`,
    )
    return await contexto.auth.completarLogin({
      transaccion: inicio.transaccion,
      stateRecibido: new URL(inicio.url).searchParams.get('state') ?? '',
      code: 'demo',
    })
  }

  /** Un pedido con el secreto en el header, igual que el transporte mobile. */
  const como = (secreto: string | null) =>
    porPedido({
      request: new Request('http://gps.test/graphql', {
        headers: secreto ? { authorization: `Bearer ${secreto}` } : undefined,
      }),
    })

  const consultar = async (secreto: string | null, consulta: string, variables = {}) =>
    await execute({
      schema: esquema,
      document: parse(consulta),
      contextValue: await como(secreto),
      variableValues: variables,
    })

  return { contexto, consultar, entrar, como }
}

/** El largo de una lista que el test ya verificó que vino sin errores. */
const cuantos = (valor: unknown) => (Array.isArray(valor) ? valor.length : -1)

/** El grupo propio de quien pregunta: sale de `cuentasDeGrupos`, que sí va por
 *  alcance. El árbol de distritos es el directorio y los trae todos. */
const primerGrupo = (datos: unknown): string => {
  const cuentas = (datos as { cuentasDeGrupos?: { grupoId: string }[] } | null)?.cuentasDeGrupos
  return cuentas?.[0]?.grupoId ?? ''
}

const codigos = (resultado: { errors?: readonly { extensions?: unknown }[] }) =>
  (resultado.errors ?? []).map(
    (error) => (error.extensions as { code?: string } | undefined)?.code ?? '',
  )

describe('sesiones', () => {
  test('un secreto manipulado no autentica nada', async () => {
    const { consultar, entrar } = await montar()
    const sesion = await entrar('jefatura')

    // Un carácter cambiado: el servidor guarda el hash, así que no hay forma de
    // acercarse al original.
    const adulterado = `${sesion.secreto.slice(0, -1)}${sesion.secreto.endsWith('a') ? 'b' : 'a'}`
    const resultado = await consultar(adulterado, '{ personaActual { personaId } }')
    expect(resultado.data).toEqual({ personaActual: null })

    // Y el pedido queda anónimo de verdad: un módulo protegido lo rechaza.
    expect(codigos(await consultar(adulterado, '{ distritos { id } }'))).toEqual(['NO_AUTENTICADO'])
  })

  test('una sesión revocada deja de servir en el pedido siguiente', async () => {
    const { contexto, consultar, entrar } = await montar()
    const sesion = await entrar('jefatura')
    expect((await consultar(sesion.secreto, '{ distritos { id } }')).errors).toBeUndefined()

    await contexto.auth.revocarSesion(sesion.sesionId)

    expect(codigos(await consultar(sesion.secreto, '{ distritos { id } }'))).toEqual([
      'NO_AUTENTICADO',
    ])
  })

  test('sin sesión, lo público sigue público y lo demás no', async () => {
    const { consultar } = await montar()
    expect((await consultar(null, '{ version { numero } }')).errors).toBeUndefined()
    expect((await consultar(null, '{ personaActual { personaId } }')).errors).toBeUndefined()
    expect(codigos(await consultar(null, '{ distritos { id } }'))).toEqual(['NO_AUTENTICADO'])
  })
})

describe('invitaciones', () => {
  test('un enlace no se puede volver a usar', async () => {
    const { contexto, entrar } = await montar()
    const sesion = await entrar('jefatura')
    const quien = await contexto.auth.resolverSesion(sesion.secreto)
    const alcance = await contexto.estructura.expandirAlcance({
      personaId: quien?.personaId ?? '',
      roles: await contexto.personas.funcionesVigentes(quien?.personaId ?? '', '2026-01-01'),
      esAdministradorDesignado: false,
      estaElevado: false,
    })
    const [alguien] = await contexto.personas.listarPersonas(
      alcance,
      alcance.gruposVisibles[0] ?? '',
    )

    const invitacion = await contexto.auth.emitirInvitacion(alcance.actor, {
      tipo: 'activacion',
      personaId: alguien?.id ?? '',
    })

    const consumir = () => {
      const inicio = contexto.auth.iniciarLogin(
        'demo',
        'web',
        'http://gps.test/auth/demo/callback?perfil=nuevo-1',
      )
      return contexto.auth.consumirActivacion(invitacion.secreto, {
        transaccion: inicio.transaccion,
        stateRecibido: new URL(inicio.url).searchParams.get('state') ?? '',
        code: 'demo',
      })
    }

    await consumir()
    // Replay: el mismo enlace, otra vez.
    await expect(consumir()).rejects.toThrow()
  })

  test('dos consumos simultáneos del mismo enlace dejan una sola identidad', async () => {
    const { contexto, entrar } = await montar()
    const sesion = await entrar('jefatura')
    const quien = await contexto.auth.resolverSesion(sesion.secreto)
    const alcance = await contexto.estructura.expandirAlcance({
      personaId: quien?.personaId ?? '',
      roles: await contexto.personas.funcionesVigentes(quien?.personaId ?? '', '2026-01-01'),
      esAdministradorDesignado: false,
      estaElevado: false,
    })
    const [alguien] = await contexto.personas.listarPersonas(
      alcance,
      alcance.gruposVisibles[0] ?? '',
    )
    const invitacion = await contexto.auth.emitirInvitacion(alcance.actor, {
      tipo: 'activacion',
      personaId: alguien?.id ?? '',
    })

    const consumirCon = (perfil: string) => {
      const inicio = contexto.auth.iniciarLogin(
        'demo',
        'web',
        `http://gps.test/auth/demo/callback?perfil=${perfil}`,
      )
      return contexto.auth.consumirActivacion(invitacion.secreto, {
        transaccion: inicio.transaccion,
        stateRecibido: new URL(inicio.url).searchParams.get('state') ?? '',
        code: 'demo',
      })
    }

    const resultados = await Promise.allSettled([consumirCon('uno'), consumirCon('dos')])
    expect(resultados.filter((una) => una.status === 'fulfilled')).toHaveLength(1)
  })

  test('una identidad ya vinculada a otra persona no se reasigna', async () => {
    const { contexto, entrar } = await montar()
    const sesion = await entrar('jefatura')
    const quien = await contexto.auth.resolverSesion(sesion.secreto)
    const alcance = await contexto.estructura.expandirAlcance({
      personaId: quien?.personaId ?? '',
      roles: await contexto.personas.funcionesVigentes(quien?.personaId ?? '', '2026-01-01'),
      esAdministradorDesignado: false,
      estaElevado: false,
    })
    const [alguien] = await contexto.personas.listarPersonas(
      alcance,
      alcance.gruposVisibles[0] ?? '',
    )
    const invitacion = await contexto.auth.emitirInvitacion(alcance.actor, {
      tipo: 'activacion',
      personaId: alguien?.id ?? '',
    })

    // El subject `jefatura` ya es de otra persona: el escenario lo sembró.
    const inicio = contexto.auth.iniciarLogin(
      'demo',
      'web',
      'http://gps.test/auth/demo/callback?perfil=jefatura',
    )
    await expect(
      contexto.auth.consumirActivacion(invitacion.secreto, {
        transaccion: inicio.transaccion,
        stateRecibido: new URL(inicio.url).searchParams.get('state') ?? '',
        code: 'demo',
      }),
    ).rejects.toThrow()
  })
})

describe('alcance entre grupos', () => {
  test('la jefatura de un grupo ve el directorio pero no toca el de al lado', async () => {
    const { contexto, consultar, entrar } = await montar()
    const jefatura = await entrar('jefatura')

    // El árbol es el directorio de la asociación: lo ve entero, con los jefes
    // de cada grupo. Lo que no ve son los datos de un grupo ajeno.
    const arbol = await consultar(jefatura.secreto, '{ distritos { grupos { id } } }')
    const ids = (arbol.data?.distritos as { grupos: { id: string }[] }[] | undefined)?.flatMap(
      (distrito) => distrito.grupos.map((grupo) => grupo.id),
    )
    expect((ids ?? []).length).toBeGreaterThan(1)

    const propio = await consultar(jefatura.secreto, '{ cuentasDeGrupos { grupoId } }')
    const suyo = primerGrupo(propio.data)
    const ajeno = (ids ?? []).find((id) => id !== suyo) ?? ''
    expect(ajeno).not.toBe('')

    // Leer el grupo ajeno: nada.
    const personasAjenas = await consultar(
      jefatura.secreto,
      'query ($g: ID!) { personas(grupoId: $g) { id } }',
      { g: ajeno },
    )
    expect(personasAjenas.data).toEqual({ personas: [] })

    const cuentaAjena = await consultar(
      jefatura.secreto,
      'query ($g: ID!) { movimientosDeTesoreria(grupoId: $g) { id } }',
      { g: ajeno },
    )
    expect(cuentaAjena.data).toEqual({ movimientosDeTesoreria: [] })

    // Escribirlo: rechazo explícito.
    const [alguien] = await contexto.personas.listarPersonas(
      { ...(await contexto.estructura.expandirAlcance(alcanceElevado)), esAdministrador: true },
      ajeno,
    )
    const nombramiento = await consultar(
      jefatura.secreto,
      'mutation ($p: ID!, $g: ID!) { asignarCargo(personaId: $p, cargo: jefeDeGrupo, ambitoId: $g, desde: "2026-01-01") { id } }',
      { p: alguien?.id ?? '', g: ajeno },
    )
    expect(codigos(nombramiento)).toEqual(['CambioDeAutoridadDenegado'])
  })

  test('un campo denegado no se lleva puesta la respuesta entera', async () => {
    // La pantalla de Tesorería pide la cuenta del grupo y el panorama de la
    // diócesis en la misma query. Cuando los campos diocesanos lanzaban, el
    // error se propagaba a la raíz -son no-nulables- y la jefatura perdía
    // también su propia cuenta, que sí puede ver.
    const { consultar, entrar } = await montar()
    const jefatura = await entrar('jefatura')

    const resultado = await consultar(
      jefatura.secreto,
      '{ cuentasDeGrupos { numero saldo } deudasPendientes { cantidad } periodosConfigurablesDeAfiliacion }',
    )

    expect(resultado.errors).toBeUndefined()
    expect(cuantos(resultado.data?.cuentasDeGrupos)).toBe(1)
    expect(resultado.data?.deudasPendientes).toBeNull()
    expect(resultado.data?.periodosConfigurablesDeAfiliacion).toBeNull()
  })

  test('Tesorería diocesana sí recibe los dos campos', async () => {
    const { consultar, entrar } = await montar()
    const tesoreria = await entrar('tesoreria')
    const resultado = await consultar(
      tesoreria.secreto,
      '{ deudasPendientes { cantidad } periodosConfigurablesDeAfiliacion }',
    )
    expect(resultado.errors).toBeUndefined()
    expect(resultado.data?.deudasPendientes).not.toBeNull()
    expect(resultado.data?.periodosConfigurablesDeAfiliacion).not.toBeNull()
  })

  test('la jefatura ve las salidas y la cuenta de su propio grupo', async () => {
    const { consultar, entrar } = await montar()
    for (const perfil of ['jefatura', 'secretaria']) {
      const sesion = await entrar(perfil)
      // Su grupo sale de `cuentasDeGrupos`, que sí va por alcance: el árbol de
      // distritos es el directorio y los trae todos.
      const suyo = await consultar(sesion.secreto, '{ cuentasDeGrupos { grupoId } }')
      const grupo = primerGrupo(suyo.data)
      expect(grupo).not.toBe('')

      const permisos = await consultar(
        sesion.secreto,
        'query ($g: ID!) { permisos(grupoId: $g) { id } }',
        { g: grupo },
      )
      expect(permisos.errors).toBeUndefined()
      expect(cuantos(permisos.data?.permisos)).toBeGreaterThan(0)

      const cuenta = await consultar(
        sesion.secreto,
        'query ($g: ID!) { movimientosDeTesoreria(grupoId: $g) { id } }',
        { g: grupo },
      )
      expect(cuenta.errors).toBeUndefined()
      expect(cuantos(cuenta.data?.movimientosDeTesoreria)).toBeGreaterThan(0)
    }
  })

  test('el alcance viaja al cliente para que no ofrezca lo que no va a poder', async () => {
    // La pantalla del directorio lista todos los grupos pero sólo enlaza los
    // que se pueden abrir. Para decidirlo usa `puedeVerGrupo` con este mismo
    // alcance, en vez de reimplementar la expansión de ámbitos.
    const { consultar, entrar } = await montar()
    const jefatura = await entrar('jefatura')
    const tesoreria = await entrar('tesoreria')

    const consulta = '{ personaActual { alcance { gruposVisibles esAdministrador } } }'
    const suyo = await consultar(jefatura.secreto, consulta)
    const diocesana = await consultar(tesoreria.secreto, consulta)

    const gruposDe = (datos: unknown) =>
      (datos as { personaActual?: { alcance: { gruposVisibles: string[] } } } | null)?.personaActual
        ?.alcance.gruposVisibles ?? []

    expect(gruposDe(suyo.data)).toHaveLength(1)
    expect(gruposDe(diocesana.data).length).toBeGreaterThan(1)

    // Y un anónimo no recibe alcance ninguno.
    const anonimo = await consultar(null, consulta)
    expect(anonimo.data).toEqual({ personaActual: null })
  })

  test('sólo Tesorería diocesana registra un pago', async () => {
    const { consultar, entrar } = await montar()
    const jefatura = await entrar('jefatura')
    const tesoreria = await entrar('tesoreria')

    const suyo = await consultar(jefatura.secreto, '{ cuentasDeGrupos { grupoId } }')
    const grupo = primerGrupo(suyo.data)

    const pago = `mutation ($g: ID!) { registrarPago(grupoId: $g, fecha: "2026-05-01", importe: 1000, medioDePago: efectivo) { id } }`
    expect(codigos(await consultar(jefatura.secreto, pago, { g: grupo }))).toEqual([
      'OperacionDenegada',
    ])
    expect((await consultar(tesoreria.secreto, pago, { g: grupo })).errors).toBeUndefined()
  })
})

/** Un actor elevado para leer el grupo ajeno en el test de arriba: hace falta
 *  para conseguir el id de alguien de ese grupo, que es el dato que la
 *  jefatura no debería poder usar. */
const alcanceElevado = {
  personaId: 'interno',
  roles: [],
  esAdministradorDesignado: false,
  estaElevado: true,
}
