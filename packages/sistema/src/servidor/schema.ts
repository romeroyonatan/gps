import type { Builder } from '@gps/core/graphql'
import type { Version } from '../dominio/index'

export function registrarSchema(builder: Builder): void {
  const VersionRef = builder.objectRef<Version>('Version').implement({
    description: 'Version del sistema y modulos registrados.',
    fields: (t) => ({
      numero: t.exposeString('numero'),
      entorno: t.exposeString('entorno'),
      modulos: t.stringList({ resolve: (version) => [...version.modulos] }),
    }),
  })

  builder.queryField('version', (t) =>
    t.field({
      type: VersionRef,
      description: 'Devuelve la version de esta instancia.',
      resolve: (_padre, _args, contexto) => contexto.sistema.obtenerVersion(),
    }),
  )
}
