import { alcanceDe } from '@gps/core'
import type { Builder } from '@gps/core/graphql'
import { GraphQLError } from 'graphql'
import { SubidaInvalida, SubidaNoAutorizada } from './servicio'

/** Yoga enmascara todo lo que no sea un GraphQLError: sin esta traduccion,
 *  quien sube un archivo recibe "Unexpected error." en vez de "no se pueden
 *  subir archivos de tipo application/x-msdownload".
 *
 *  Traducir en el resolver y no en el servicio es lo que mantiene al servicio
 *  sin conocer el framework, igual que en personas. */
async function traduciendoErrores<T>(correr: () => Promise<T>): Promise<T> {
  try {
    return await correr()
  } catch (error) {
    if (error instanceof SubidaInvalida || error instanceof SubidaNoAutorizada) {
      throw new GraphQLError(error.message, { extensions: { code: error.name } })
    }
    throw error
  }
}

export function registrarSchema(builder: Builder): void {
  const SubidaRef = builder
    .objectRef<{ id: string; url: string; expira: Date }>('SubidaPedida')
    .implement({
      description: 'Donde mandar los bytes de un archivo, y hasta cuando vale.',
      fields: (t) => ({
        id: t.exposeID('id'),
        url: t.exposeString('url', {
          description: 'Ruta a la que hacer PUT con los bytes. Ya lleva el token.',
        }),
        expira: t.string({
          description: 'Instante en que la URL deja de valer, en ISO 8601.',
          resolve: (subida) => subida.expira.toISOString(),
        }),
      }),
    })

  builder.mutationField('solicitarSubida', (t) =>
    t.field({
      type: SubidaRef,
      description:
        'Primer paso de una subida: reserva el archivo y dice por donde mandar los bytes.',
      args: {
        nombre: t.arg.string({ required: true }),
        tipo: t.arg.string({ required: true }),
        tamano: t.arg.int({ required: true }),
        modulo: t.arg.string({ required: true }),
        recursoId: t.arg.id({ required: true }),
      },
      resolve: async (_padre, args, contexto) =>
        await traduciendoErrores(() =>
          contexto.archivos.solicitarSubida(
            {
              nombre: args.nombre,
              tipo: args.tipo,
              tamano: args.tamano,
              modulo: args.modulo,
              recursoId: String(args.recursoId),
            },
            alcanceDe(contexto),
          ),
        ),
    }),
  )

  builder.mutationField('confirmarSubida', (t) =>
    t.field({
      type: 'ID',
      description: 'Ultimo paso: valida lo recibido y deja el archivo usable.',
      args: { id: t.arg.id({ required: true }) },
      resolve: async (_padre, args, contexto) =>
        (
          await traduciendoErrores(() =>
            contexto.archivos.confirmarSubida(String(args.id), alcanceDe(contexto)),
          )
        ).id,
    }),
  )
}
