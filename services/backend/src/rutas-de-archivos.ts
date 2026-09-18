import { SinAutorizador, SubidaInvalida, SubidaNoAutorizada } from '@gps/archivos/servidor'
import type { Context, Logger } from '@gps/core'
import { PermisoNoEditable } from '@gps/salidas/servidor'

/** El PDF del permiso tal como esta ahora: las firmas de la app estampadas, la
 *  marca de las de papel, y los escaneos como anexo. Se genera al pedirlo y no
 *  se guarda, asi que no hay dos verdades.
 *
 *  Ruta y no mutation de GraphQL por lo mismo que los bytes de archivos: un PDF
 *  no viaja bien por el lenguaje de consultas, y asi el navegador lo puede
 *  abrir con un link. */
export async function rutaDelPdfDeUnPermiso(
  contexto: Context,
  logger: Logger,
  pedido: Bun.BunRequest<'/permisos/:id/pdf'>,
): Promise<Response> {
  try {
    const pdf = await contexto.salidas.pdfDelPermiso(pedido.params.id)
    return new Response(pdf as BlobPart, {
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': comoSeEntrega(pedido.url, `permiso-${pedido.params.id}.pdf`),
      },
    })
  } catch (error) {
    if (error instanceof PermisoNoEditable) return new Response(error.message, { status: 400 })
    return loQueNoEsperabamos(logger, error, `armando el PDF del permiso ${pedido.params.id}`)
  }
}

/** PUT deja los bytes de una subida ya pedida; GET los devuelve si el modulo
 *  dueño autoriza. La URL del PUT la arma `archivos` y lleva su token, asi que
 *  esto solo lo pasa para adentro.
 *
 *  Los errores se traducen a codigos HTTP aca y no en el servicio, igual que
 *  los resolvers traducen a GraphQLError: es lo que mantiene al modulo sin
 *  conocer el transporte. */
export async function rutaDeArchivos(
  contexto: Context,
  logger: Logger,
  pedido: Bun.BunRequest<'/archivos/:id'>,
): Promise<Response> {
  const { id } = pedido.params

  try {
    if (pedido.method === 'PUT') {
      const token = new URL(pedido.url).searchParams.get('token')
      if (token === null) return new Response('Falta el token de subida.', { status: 401 })
      await contexto.archivos.recibirBytes(id, token, new Uint8Array(await pedido.arrayBuffer()))
      return new Response(null, { status: 204 })
    }

    if (pedido.method === 'GET') {
      // El actor sale del contexto igual que en los resolvers. Hoy es siempre
      // null y cada dueño autoriza todo; cuando exista auth, lo unico que
      // cambia es lo que decide el autorizador.
      const { contenido, tipo, nombre } = await contexto.archivos.descargar(id, contexto.actor)
      return new Response(contenido as BlobPart, {
        headers: {
          'content-type': tipo,
          'content-disposition': comoSeEntrega(pedido.url, nombre),
        },
      })
    }

    return new Response('Metodo no permitido.', { status: 405 })
  } catch (error) {
    if (error instanceof SubidaNoAutorizada) return new Response(error.message, { status: 403 })
    if (error instanceof SubidaInvalida) return new Response(error.message, { status: 400 })
    // Un archivo cuyo dueño no registro autorizador no se entrega: es un error
    // de configuracion del servidor, no del pedido.
    if (error instanceof SinAutorizador) return new Response(error.message, { status: 500 })
    return loQueNoEsperabamos(logger, error, `sirviendo el archivo ${id}`)
  }
}

/** Si el archivo se muestra o se baja. `?descargar` lo baja; sin eso, el
 *  navegador lo abre si sabe -un PDF, una foto- y lo baja si no -un .docx-.
 *
 *  El nombre va siempre, en las dos: sin el, "guardar como" deja el archivo
 *  llamado como su id.
 *
 *  Las comillas del nombre se sacan porque cierran el parametro: un archivo que
 *  se llame `plan".docx` partiria la cabecera en dos. */
function comoSeEntrega(url: string, nombre: string): string {
  const descargar = new URL(url).searchParams.has('descargar')
  return `${descargar ? 'attachment' : 'inline'}; filename="${nombre.replaceAll('"', '')}"`
}

/** Lo que no supimos traducir. Se loguea y se responde 500 en vez de dejarlo
 *  propagar: sin esto, Bun contesta "Something went wrong!" y no queda ni una
 *  linea en el log, asi que del lado del servidor no hay por donde empezar.
 *
 *  El mensaje del error no va en la respuesta: puede tener rutas de archivos o
 *  fragmentos de SQL, y eso no se le muestra a quien pidio la URL. */
function loQueNoEsperabamos(logger: Logger, error: unknown, haciendo: string): Response {
  logger.error(`Error inesperado ${haciendo}`, {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  })
  return new Response('No pudimos resolver este pedido. Quedó registrado en el servidor.', {
    status: 500,
  })
}
