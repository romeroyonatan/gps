import { describe, expect, test } from 'bun:test'
import type { Config, Context } from '@gps/core'
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
  test('la jefatura de un grupo no ve ni toca el de al lado', async () => {
    const { contexto, consultar, entrar } = await montar()
    const jefatura = await entrar('jefatura')
    const tesoreria = await entrar('tesoreria')

    // Tesorería diocesana ve todos los grupos; la jefatura, uno solo.
    const todos = await consultar(tesoreria.secreto, '{ distritos { grupos { id } } }')
    const idsDeTodos = (
      todos.data?.distritos as { grupos: { id: string }[] }[] | undefined
    )?.flatMap((distrito) => distrito.grupos.map((grupo) => grupo.id))
    const propios = await consultar(jefatura.secreto, '{ distritos { grupos { id } } }')
    const idsPropios = (
      propios.data?.distritos as { grupos: { id: string }[] }[] | undefined
    )?.flatMap((distrito) => distrito.grupos.map((grupo) => grupo.id))

    expect(idsPropios).toHaveLength(1)
    expect((idsDeTodos ?? []).length).toBeGreaterThan(1)

    const ajeno = (idsDeTodos ?? []).find((id) => id !== idsPropios?.[0]) ?? ''

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

  test('sólo Tesorería diocesana registra un pago', async () => {
    const { consultar, entrar } = await montar()
    const jefatura = await entrar('jefatura')
    const tesoreria = await entrar('tesoreria')

    const suyo = await consultar(jefatura.secreto, '{ distritos { grupos { id } } }')
    const grupo =
      (suyo.data?.distritos as { grupos: { id: string }[] }[] | undefined)?.[0]?.grupos[0]?.id ?? ''

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
