import { alcanceDe } from '@gps/core'
import type { Builder } from '@gps/core/graphql'

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
        await contexto.archivos.solicitarSubida(
          {
            nombre: args.nombre,
            tipo: args.tipo,
            tamano: args.tamano,
            modulo: args.modulo,
            recursoId: String(args.recursoId),
          },
          alcanceDe(contexto),
        ),
    }),
  )

  builder.mutationField('confirmarSubida', (t) =>
    t.field({
      type: 'ID',
      description: 'Ultimo paso: valida lo recibido y deja el archivo usable.',
      args: { id: t.arg.id({ required: true }) },
      resolve: async (_padre, args, contexto) =>
        (await contexto.archivos.confirmarSubida(String(args.id), alcanceDe(contexto))).id,
    }),
  )
}
