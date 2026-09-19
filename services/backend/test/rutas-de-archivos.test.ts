import { afterEach, describe, expect, test } from 'bun:test'
import { autorizadores } from '@gps/archivos/servidor'
import type { Config } from '@gps/core'
import { crearAlmacenamientoEnMemoria } from '../src/almacenamiento'
import { crearBd } from '../src/bd'
import { crearConversorDeImagenes } from '../src/conversor'
import { crearSellador } from '../src/sellador'
import { crearServidor } from '../src/server'

const config: Config = { version: '0.0.0', entorno: 'prueba', puerto: 0 }
const BYTES = new Uint8Array([1, 2, 3, 4, 5])

/** El servidor de verdad, con sus rutas: es lo unico que prueba que los bytes
 *  entran y salen por HTTP y no solo que el servicio funciona. Puerto 0 para
 *  que el sistema elija uno libre y dos tests no choquen. */
async function montar() {
  const { servidor, contexto } = await crearServidor(
    config,
    crearBd(':memory:'),
    crearSellador({ prueba: 'una-clave' }, 'prueba'),
    crearAlmacenamientoEnMemoria(),
    crearConversorDeImagenes(),
  )
  const base = `http://localhost:${servidor.port}`
  return { servidor, contexto, base }
}

/** `salidas` es un dueño de verdad y la composicion le registra su autorizador,
 *  que hoy autoriza todo. Para los casos de "no autoriza" y "no hay quien
 *  autorice" hace falta un modulo inventado, que es justo lo que ejercita la
 *  regla: archivos no sabe de permisos, pregunta. */
const pedirSubida = (
  contexto: Awaited<ReturnType<typeof montar>>['contexto'],
  modulo = 'salidas',
) =>
  contexto.archivos.solicitarSubida({
    nombre: 'escaneo.jpg',
    tipo: 'image/jpeg',
    tamano: BYTES.length,
    modulo,
    recursoId: 'permiso_1',
  })

afterEach(() => {
  // El registro es un objeto compartido entre tests: sin limpiarlo, lo que
  // registra uno decide lo que ve el siguiente.
  for (const modulo of Object.keys(autorizadores)) delete autorizadores[modulo]
})

describe('rutas de archivos', () => {
  test('PUT deja los bytes y GET los devuelve con su tipo', async () => {
    const { servidor, contexto, base } = await montar()
    const subida = await pedirSubida(contexto)

    const puesto = await fetch(`${base}${subida.url}`, { method: 'PUT', body: BYTES })
    expect(puesto.status).toBe(204)
    await contexto.archivos.confirmarSubida(subida.id)

    const bajado = await fetch(`${base}/archivos/${subida.id}`)
    expect(bajado.status).toBe(200)
    expect(bajado.headers.get('content-type')).toBe('image/jpeg')
    expect(new Uint8Array(await bajado.arrayBuffer())).toEqual(BYTES)
    servidor.stop(true)
  })

  test('el nombre viaja en la cabecera: guardar no deja el id como nombre', async () => {
    const { servidor, contexto, base } = await montar()
    const subida = await pedirSubida(contexto)
    await fetch(`${base}${subida.url}`, { method: 'PUT', body: BYTES })
    await contexto.archivos.confirmarSubida(subida.id)

    const visto = await fetch(`${base}/archivos/${subida.id}`)
    expect(visto.headers.get('content-disposition')).toBe('inline; filename="escaneo.jpg"')

    // Con ?descargar se baja en vez de abrirse: es lo que hace falta para un
    // .docx, que el navegador no sabe mostrar.
    const bajado = await fetch(`${base}/archivos/${subida.id}?descargar`)
    expect(bajado.headers.get('content-disposition')).toBe('attachment; filename="escaneo.jpg"')
    servidor.stop(true)
  })

  test('un nombre con comillas no parte la cabecera', async () => {
    // Las comillas cierran el parametro: `plan".docx` partiria el header en dos.
    const { servidor, contexto, base } = await montar()
    const subida = await contexto.archivos.solicitarSubida({
      nombre: 'plan".jpg',
      tipo: 'image/jpeg',
      tamano: BYTES.length,
      modulo: 'salidas',
      recursoId: 'permiso_1',
    })
    await fetch(`${base}${subida.url}`, { method: 'PUT', body: BYTES })
    await contexto.archivos.confirmarSubida(subida.id)

    const visto = await fetch(`${base}/archivos/${subida.id}`)
    expect(visto.headers.get('content-disposition')).toBe('inline; filename="plan.jpg"')
    servidor.stop(true)
  })

  test('PUT sin token es 401', async () => {
    const { servidor, contexto, base } = await montar()
    const subida = await pedirSubida(contexto)
    const puesto = await fetch(`${base}/archivos/${subida.id}`, { method: 'PUT', body: BYTES })
    expect(puesto.status).toBe(401)
    servidor.stop(true)
  })

  test('PUT con una URL vencida es 403', async () => {
    const { servidor, contexto, base } = await montar()
    const subida = await pedirSubida(contexto)
    // El token lleva su vencimiento adentro: uno del pasado ya no vale, y no
    // hace falta esperar quince minutos para probarlo.
    const vencida = subida.url.replace(/token=\d+/, 'token=1')
    const puesto = await fetch(`${base}${vencida}`, { method: 'PUT', body: BYTES })
    expect(puesto.status).toBe(403)
    servidor.stop(true)
  })

  test('PUT con bytes que no coinciden con lo declarado es 400', async () => {
    const { servidor, contexto, base } = await montar()
    const subida = await pedirSubida(contexto)
    const puesto = await fetch(`${base}${subida.url}`, {
      method: 'PUT',
      body: new Uint8Array([1, 2]),
    })
    expect(puesto.status).toBe(400)
    servidor.stop(true)
  })

  test('GET de un archivo cuyo dueño no autoriza es 403', async () => {
    const { servidor, contexto, base } = await montar()
    autorizadores.otroModulo = async () => false
    const subida = await pedirSubida(contexto, 'otroModulo')
    await fetch(`${base}${subida.url}`, { method: 'PUT', body: BYTES })
    await contexto.archivos.confirmarSubida(subida.id)

    expect((await fetch(`${base}/archivos/${subida.id}`)).status).toBe(403)
    servidor.stop(true)
  })

  test('un error inesperado deja rastro en el log y no filtra el mensaje', async () => {
    // Sin esto, Bun contesta "Something went wrong!" y no queda una sola linea
    // en el servidor: no hay por donde empezar a mirar.
    const registrados: string[] = []
    const { servidor, contexto, base } = await montar()
    autorizadores.explota = async () => {
      throw new Error('detalle interno con /rutas/que/no/van/a/la/respuesta')
    }
    const original = console.error
    console.error = (linea: string) => registrados.push(String(linea))
    try {
      const subida = await pedirSubida(contexto, 'explota')
      await fetch(`${base}${subida.url}`, { method: 'PUT', body: BYTES })
      await contexto.archivos.confirmarSubida(subida.id)

      const bajado = await fetch(`${base}/archivos/${subida.id}`)
      expect(bajado.status).toBe(500)
      expect(await bajado.text()).not.toContain('/rutas/que/no/van')
    } finally {
      console.error = original
    }
    expect(registrados.join(' ')).toContain('detalle interno')
    servidor.stop(true)
  })

  test('GET de un archivo cuyo dueño no registro autorizador es 500', async () => {
    // Es un error de configuracion del servidor, no del pedido: nadie puede
    // decir si esta permitido, asi que no se entrega.
    const { servidor, contexto, base } = await montar()
    const subida = await pedirSubida(contexto, 'moduloSinAutorizador')
    await fetch(`${base}${subida.url}`, { method: 'PUT', body: BYTES })
    await contexto.archivos.confirmarSubida(subida.id)

    expect((await fetch(`${base}/archivos/${subida.id}`)).status).toBe(500)
    servidor.stop(true)
  })

  test('GET de un archivo sin confirmar es 400', async () => {
    const { servidor, contexto, base } = await montar()
    const subida = await pedirSubida(contexto)
    await fetch(`${base}${subida.url}`, { method: 'PUT', body: BYTES })

    expect((await fetch(`${base}/archivos/${subida.id}`)).status).toBe(400)
    servidor.stop(true)
  })
})
