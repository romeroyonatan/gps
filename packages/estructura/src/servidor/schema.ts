import type { Builder } from '@gps/core'
import type { DistritoConGrupos, GrupoConRamas } from '../dominio/modelos'
import { RAMAS, type Rama } from '../dominio/ramas'

export function registrarSchema(builder: Builder): void {
  const RamaRef = builder.enumType('Rama', {
    description: 'Ramas en que la asociacion divide a sus miembros por edad.',
    // Los valores son los ids del dominio, en minuscula y no gritados como
    // manda la convencion de GraphQL. Es a proposito: asi lo que viaja por la
    // red es el id, y la pantalla saca nombre y rango etario de RAMAS sin una
    // tabla de traduccion en el medio.
    values: RAMAS.map((rama) => rama.id) as unknown as readonly Rama[],
  })

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
