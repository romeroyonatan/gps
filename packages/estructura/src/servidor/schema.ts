import { alcanceDe } from '@gps/core'
import { type Builder, enumCompartido } from '@gps/core/graphql'
import type { DistritoConGrupos, GrupoConUnidades, Unidad } from '../dominio/modelos'
import { RAMAS } from '../dominio/ramas'
import { nombreDeLaUnidad } from '../dominio/unidades'

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

  // El sexo va como enum y no como string por lo mismo que la rama: el conjunto
  // es cerrado y asi el <select> no necesita su propia query.
  const SexoRef = builder.enumType('SexoDeUnidad', {
    values: ['masculina', 'femenina', 'mixta'] as const,
    description: 'Como esta compuesta una unidad. Es un hecho del grupo, no de sus personas.',
  })

  const UnidadRef = builder.objectRef<Unidad>('Unidad').implement({
    description: 'Una unidad del grupo: la Manada, una de las dos Tropas, el Clan.',
    fields: (t) => ({
      id: t.exposeID('id'),
      rama: t.field({ type: RamaRef, resolve: (unidad) => unidad.rama }),
      sexo: t.field({ type: SexoRef, resolve: (unidad) => unidad.sexo }),
      nombre: t.exposeString('nombre', { description: 'El nombre propio: "San Jorge".' }),
      nombreParaMostrar: t.string({
        description: 'El tipo de unidad de su rama, su nombre y su sexo, ya compuestos.',
        resolve: nombreDeLaUnidad,
      }),
    }),
  })

  const GrupoRef = builder.objectRef<GrupoConUnidades>('Grupo').implement({
    description: 'Un grupo scout y las unidades que tiene abiertas.',
    fields: (t) => ({
      id: t.exposeID('id'),
      numero: t.exposeInt('numero'),
      nombre: t.exposeString('nombre'),
      unidades: t.field({
        type: [UnidadRef],
        description:
          'De menor a mayor edad y, dentro de una rama, por nombre. Vacia si el grupo no abrio ninguna.',
        resolve: (grupo) => [...grupo.unidades],
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
      description: 'El arbol de la diocesis: distritos, sus grupos y sus unidades.',
      resolve: async (_padre, _args, contexto) => [
        ...(await contexto.estructura.listarDistritos(alcanceDe(contexto))),
      ],
    }),
  )
}
