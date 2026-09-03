import { type Builder, enumCompartido } from '@gps/core/graphql'
import type { DistritoConGrupos, GrupoConRamas } from '../dominio/modelos'
import { RAMAS } from '../dominio/ramas'

export function registrarSchema(builder: Builder): void {
  // enumCompartido y no builder.enumType porque personas declara el mismo enum
  // para la rama de la pertenencia, y Pothos aborta si un nombre se registra dos
  // veces. Los valores son los ids del dominio, en minuscula y no gritados como
  // manda la convencion de GraphQL: asi lo que viaja por la red es el id, y la
  // pantalla saca nombre y rango etario de RAMAS sin tabla de traduccion.
  const RamaRef = enumCompartido(
    builder,
    'Rama',
    RAMAS.map((rama) => rama.id),
    'Ramas en que la asociacion divide a sus miembros por edad.',
  )

  const GrupoRef = builder.objectRef<GrupoConRamas>('Grupo').implement({
    description: 'Un grupo scout y las ramas que tiene abiertas.',
    fields: (t) => ({
      id: t.exposeID('id'),
      numero: t.exposeInt('numero'),
      nombre: t.exposeString('nombre'),
      ramas: t.field({
        type: [RamaRef],
        description: 'De menor a mayor edad. Vacia si el grupo no abrio ninguna.',
        resolve: (grupo) => [...grupo.ramas],
      }),
    }),
  })

  const DistritoRef = builder.objectRef<DistritoConGrupos>('Distrito').implement({
    description: 'Un distrito de la diocesis, con sus grupos.',
    fields: (t) => ({
      id: t.exposeID('id'),
      numero: t.exposeInt('numero'),
      zona: t.exposeString('zona'),
      grupos: t.field({ type: [GrupoRef], resolve: (distrito) => [...distrito.grupos] }),
    }),
  })

  builder.queryField('distritos', (t) =>
    t.field({
      type: [DistritoRef],
      description: 'El arbol de la diocesis: distritos, sus grupos y sus ramas.',
      resolve: async (_padre, _args, contexto) => [
        ...(await contexto.estructura.listarDistritos()),
      ],
    }),
  )
}
