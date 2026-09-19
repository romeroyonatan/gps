import { Database } from 'bun:sqlite'
import { describe, expect, test } from 'bun:test'
import {
  aplicarMigraciones,
  type Bd,
  type Core,
  crearBusDeEventos,
  type Module,
  type Reloj,
} from '@gps/core'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migraciones } from '../src/servidor/migraciones'
import {
  type Autorizador,
  crearServicioDeArchivos,
  type ServicioDeArchivos,
  SinAutorizador,
  SubidaInvalida,
  SubidaNoAutorizada,
} from '../src/servidor/servicio'

const HORA = new Date('1970-01-01T00:00:00Z')
const BYTES = new Uint8Array([1, 2, 3, 4, 5])

/** Un servicio con la base migrada, almacenamiento en memoria y un Core de ids
 *  fijos. El reloj es fijo en epoch 1970 por default para que una hora del
 *  sistema colada se distinga de un vistazo; algun test lo adelanta para
 *  verificar el vencimiento. */
function montar(opciones: { reloj?: Reloj; autorizadores?: Record<string, Autorizador> } = {}): {
  servicio: ServicioDeArchivos
  guardados: Map<string, Uint8Array>
} {
  const base = new Database(':memory:')
  const bd: Bd = drizzle(base)
  const guardados = new Map<string, Uint8Array>()
  let contador = 0

  const core: Core = {
    config: { version: '0.0.0', entorno: 'prueba', puerto: 0 },
    logger: { info: () => {}, error: () => {} },
    reloj: opciones.reloj ?? { ahora: () => HORA },
    bd,
    eventos: crearBusDeEventos(),
    modulos: ['archivos'],
    sellador: {
      sellar: (datos) => ({ sello: `sellado:${datos}`, claveId: 'prueba' }),
      verificar: (datos, sello) => sello.claveId === 'prueba' && sello.sello === `sellado:${datos}`,
    },
    almacenamiento: {
      async guardar(clave, contenido) {
        guardados.set(clave, contenido)
      },
      async leer(clave) {
        const contenido = guardados.get(clave)
        if (!contenido) throw new Error(`no hay nada en ${clave}`)
        return contenido
      },
      async eliminar(clave) {
        guardados.delete(clave)
      },
    },
    // Falso que marca lo convertido, para poder afirmar que se convirtio.
    conversorDeImagenes: { aJpeg: async () => new Uint8Array([74, 80, 71]) },
    hash: (contenido) => `hash:${typeof contenido === 'string' ? contenido : contenido.join(',')}`,
    nuevoId: (prefijo) => `${prefijo}_${++contador}`,
    nuevoSecreto: () => `secreto_${++contador}`,
  }

  const modulo: Module<object> = {
    name: 'archivos',
    dependencies: [],
    migraciones,
    createServices: () => ({}),
    registerSchema: () => {},
  }
  aplicarMigraciones(core, [modulo])

  return {
    servicio: crearServicioDeArchivos(
      core,
      opciones.autorizadores ?? { salidas: async () => true },
    ),
    guardados,
  }
}

const pedido = {
  nombre: 'escaneo.jpg',
  tipo: 'image/jpeg',
  tamano: BYTES.length,
  modulo: 'salidas',
  recursoId: 'permiso_1',
}

/** Los tres pasos, que es como se sube de verdad. */
async function subir(servicio: ServicioDeArchivos, datos = pedido, contenido: Uint8Array = BYTES) {
  const subida = await servicio.solicitarSubida(datos)
  const token = new URL(subida.url, 'http://x').searchParams.get('token') ?? ''
  await servicio.recibirBytes(subida.id, token, contenido)
  return { ...subida, token, archivo: await servicio.confirmarSubida(subida.id) }
}

describe('solicitarSubida', () => {
  test('devuelve un id y una URL con token y vencimiento', async () => {
    const { servicio } = montar()
    const subida = await servicio.solicitarSubida(pedido)
    expect(subida.id).toBe('archivo_1')
    expect(subida.url).toContain('/archivos/archivo_1?token=')
    expect(subida.expira.getTime()).toBeGreaterThan(HORA.getTime())
  })

  test('un tipo que no esta admitido se rechaza', async () => {
    const { servicio } = montar()
    expect(servicio.solicitarSubida({ ...pedido, tipo: 'application/zip' })).rejects.toThrow(
      SubidaInvalida,
    )
  })

  test('mas grande que el maximo se rechaza', async () => {
    const { servicio } = montar()
    expect(servicio.solicitarSubida({ ...pedido, tamano: 26 * 1024 * 1024 })).rejects.toThrow(
      SubidaInvalida,
    )
  })

  test('sin modulo o sin recurso dueño se rechaza', async () => {
    // Un archivo que nace sin dueño no se puede autorizar despues: no hay a
    // quien preguntarle.
    const { servicio } = montar()
    expect(servicio.solicitarSubida({ ...pedido, modulo: '  ' })).rejects.toThrow(SubidaInvalida)
    expect(servicio.solicitarSubida({ ...pedido, recursoId: '' })).rejects.toThrow(SubidaInvalida)
  })
})

describe('los tres pasos', () => {
  test('una subida completa deja el archivo registrado con dueño, tamaño y hash', async () => {
    const { servicio } = montar()
    const { archivo } = await subir(servicio)
    expect(archivo).toMatchObject({
      nombre: 'escaneo.jpg',
      tipo: 'image/jpeg',
      tamano: BYTES.length,
      sha256: 'hash:1,2,3,4,5',
      modulo: 'salidas',
      recursoId: 'permiso_1',
      confirmado: true,
    })
  })

  test('un token de otra subida no sirve', async () => {
    const { servicio } = montar()
    const una = await servicio.solicitarSubida(pedido)
    const otra = await servicio.solicitarSubida(pedido)
    const token = new URL(otra.url, 'http://x').searchParams.get('token') ?? ''
    expect(servicio.recibirBytes(una.id, token, BYTES)).rejects.toThrow(SubidaNoAutorizada)
  })

  test('una URL vencida se rechaza', async () => {
    let ahora = HORA
    const { servicio } = montar({ reloj: { ahora: () => ahora } })
    const subida = await servicio.solicitarSubida(pedido)
    const token = new URL(subida.url, 'http://x').searchParams.get('token') ?? ''

    ahora = new Date(subida.expira.getTime() + 1000)
    expect(servicio.recibirBytes(subida.id, token, BYTES)).rejects.toThrow(SubidaNoAutorizada)
  })

  test('bytes que no coinciden con el tamaño declarado se rechazan', async () => {
    const { servicio } = montar()
    const subida = await servicio.solicitarSubida(pedido)
    const token = new URL(subida.url, 'http://x').searchParams.get('token') ?? ''
    expect(servicio.recibirBytes(subida.id, token, new Uint8Array([1, 2]))).rejects.toThrow(
      SubidaInvalida,
    )
  })

  test('confirmar sin que hayan llegado los bytes se rechaza', async () => {
    const { servicio } = montar()
    const subida = await servicio.solicitarSubida(pedido)
    expect(servicio.confirmarSubida(subida.id)).rejects.toThrow(SubidaInvalida)
  })

  test('confirmar dos veces se rechaza', async () => {
    const { servicio } = montar()
    const { id } = await subir(servicio)
    expect(servicio.confirmarSubida(id)).rejects.toThrow(SubidaInvalida)
  })
})

describe('conversion de HEIC', () => {
  test('una foto de iPhone queda registrada como JPEG', async () => {
    const { servicio, guardados } = montar()
    const { archivo, id } = await subir(servicio, { ...pedido, tipo: 'image/heic' })
    expect(archivo.tipo).toBe('image/jpeg')
    // El original no se conserva: lo guardado es lo convertido.
    expect(guardados.get(id)).toEqual(new Uint8Array([74, 80, 71]))
  })

  test('el tamaño y el hash registrados son los del JPEG, no los del HEIC', async () => {
    const { servicio } = montar()
    const { archivo } = await subir(servicio, { ...pedido, tipo: 'image/heic' })
    expect(archivo.tamano).toBe(3)
    expect(archivo.sha256).toBe('hash:74,80,71')
  })
})

describe('descargar', () => {
  test('el dueño autoriza y se devuelven los bytes con su tipo y su nombre', async () => {
    // El nombre viaja con los bytes: sin el, guardar el archivo lo deja
    // llamado como su id.
    const { servicio } = montar()
    const { id } = await subir(servicio)
    expect(await servicio.descargar(id, null)).toEqual({
      contenido: BYTES,
      tipo: 'image/jpeg',
      nombre: 'escaneo.jpg',
    })
  })

  test('el dueño no autoriza y se rechaza', async () => {
    const { servicio } = montar({ autorizadores: { salidas: async () => false } })
    const { id } = await subir(servicio)
    expect(servicio.descargar(id, null)).rejects.toThrow(SubidaNoAutorizada)
  })

  test('un archivo cuyo dueño no registro autorizador no se entrega', async () => {
    // Deliberadamente un error y no un "si": un archivo que nadie reclama no
    // se puede autorizar.
    const { servicio } = montar({ autorizadores: {} })
    const { id } = await subir(servicio)
    expect(servicio.descargar(id, null)).rejects.toThrow(SinAutorizador)
  })

  test('un archivo sin confirmar no se puede descargar', async () => {
    const { servicio } = montar()
    const subida = await servicio.solicitarSubida(pedido)
    const token = new URL(subida.url, 'http://x').searchParams.get('token') ?? ''
    await servicio.recibirBytes(subida.id, token, BYTES)
    expect(servicio.descargar(subida.id, null)).rejects.toThrow(SubidaInvalida)
  })
})

describe('eliminar', () => {
  test('borra el registro y los bytes', async () => {
    const { servicio, guardados } = montar()
    const { id } = await subir(servicio)
    expect(await servicio.eliminar(id, 'salidas', 'permiso_1')).toBe(true)
    expect(await servicio.obtener(id)).toBeNull()
    expect(guardados.has(id)).toBe(false)
  })

  test('un modulo no puede borrar los archivos de otro', async () => {
    // Sin el par modulo/recurso, cualquiera borraria lo ajeno con solo el id.
    const { servicio } = montar()
    const { id } = await subir(servicio)
    expect(await servicio.eliminar(id, 'otro', 'permiso_1')).toBe(false)
    expect(await servicio.obtener(id)).not.toBeNull()
  })

  test('ni los de otro recurso del mismo modulo', async () => {
    const { servicio } = montar()
    const { id } = await subir(servicio)
    expect(await servicio.eliminar(id, 'salidas', 'permiso_2')).toBe(false)
  })

  test('borrar algo que no existe no rompe', async () => {
    const { servicio } = montar()
    expect(await servicio.eliminar('archivo_fantasma', 'salidas', 'permiso_1')).toBe(false)
  })
})

describe('obtener y esDe', () => {
  test('obtener devuelve null mientras no este confirmado', async () => {
    const { servicio } = montar()
    const subida = await servicio.solicitarSubida(pedido)
    expect(await servicio.obtener(subida.id)).toBeNull()
  })

  test('esDe distingue al dueño', async () => {
    // Es lo que el dueño llama antes de asociar un archivo, para no quedarse
    // con uno ajeno.
    const { servicio } = montar()
    const { id } = await subir(servicio)
    expect(await servicio.esDe(id, 'salidas', 'permiso_1')).toBe(true)
    expect(await servicio.esDe(id, 'salidas', 'permiso_2')).toBe(false)
    expect(await servicio.esDe(id, 'otro', 'permiso_1')).toBe(false)
  })
})
