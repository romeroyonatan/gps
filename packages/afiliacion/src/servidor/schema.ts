import { type Builder, enumCompartido } from '@gps/core/graphql'
import { TIPOS_DE_DOCUMENTO } from '@gps/personas/dominio'
import { GraphQLError } from 'graphql'
import type { Afiliado, Declaracion } from '../dominio/modelos'
import { NadaQueDeclarar, YaDeclaroHoy } from './servicio'

export function registrarSchema(builder: Builder): void {
  // enumCompartido y no builder.enumType: personas declara el mismo enum. La
  // descripcion tiene que ser identica a la de alla, o el helper tira
  // DescripcionesDistintas al componer el esquema.
  const TipoDeDocumentoRef = enumCompartido(
    builder,
    'TipoDeDocumento',
    TIPOS_DE_DOCUMENTO.map((tipo) => tipo.id),
    'Tipos de documento que la asociacion acepta.',
  )

  // Expone nombre y documento como quedaron guardados, no como estan hoy en
  // personas: es una fotografia, no una vista.
  const AfiliadoRef = builder.objectRef<Afiliado>('Afiliado').implement({
    description: 'Una fila de la nómina: cómo estaba esa persona el día de la declaración.',
    fields: (t) => ({
      personaId: t.exposeID('personaId'),
      tipoDeDocumento: t.field({
        type: TipoDeDocumentoRef,
        resolve: (afiliado) => afiliado.tipoDeDocumento,
      }),
      numeroDeDocumento: t.exposeString('numeroDeDocumento'),
      nombres: t.exposeString('nombres'),
      apellidos: t.exposeString('apellidos'),
    }),
  })

  const DeclaracionRef = builder.objectRef<Declaracion>('Declaracion').implement({
    description: 'La nómina que un grupo presenta en una fecha.',
    fields: (t) => ({
      id: t.exposeID('id'),
      fecha: t.exposeString('fecha', {
        description: 'Fecha de calendario en formato aaaa-mm-dd, sin hora ni zona horaria.',
      }),
      periodo: t.exposeInt('periodo', {
        description: 'El año en que arranca el período al que cae esta declaración.',
      }),
      afiliados: t.field({
        type: [AfiliadoRef],
        description: 'La nómina completa del grupo ese día.',
        resolve: async (declaracion, _args, contexto) => [
          ...(await contexto.afiliacion.listarAfiliados(declaracion.id)),
        ],
      }),
      aCobrar: t.field({
        type: [AfiliadoRef],
        description: 'Los de la nómina que todavía no tenían afiliación ese período.',
        resolve: async (declaracion, _args, contexto) => [
          ...(await contexto.afiliacion.listarACobrar(declaracion.id)),
        ],
      }),
    }),
  })

  builder.queryField('declaraciones', (t) =>
    t.field({
      type: [DeclaracionRef],
      description: 'Las declaraciones de un grupo, de la más reciente a la más vieja.',
      args: { grupoId: t.arg.id({ required: true }) },
      resolve: async (_padre, args, contexto) => [
        ...(await contexto.afiliacion.listarDeclaraciones(String(args.grupoId))),
      ],
    }),
  )

  // Query suelta y no un campo de Persona porque la flecha va en la otra
  // direccion: afiliacion depende de personas, y personas no puede llamar a un
  // modulo que no conoce. La pantalla hace las dos queries y cruza por id.
  builder.queryField('afiliadosEn', (t) =>
    t.idList({
      description: 'Los ids, de entre los preguntados, que ya tienen afiliación ese período.',
      args: {
        periodo: t.arg.int({ required: true }),
        personaIds: t.arg.idList({ required: true }),
      },
      resolve: async (_padre, args, contexto) => [
        ...(await contexto.afiliacion.afiliadosEn(
          args.periodo,
          args.personaIds.map((id) => String(id)),
        )),
      ],
    }),
  )

  builder.mutationField('declararAfiliacion', (t) =>
    t.field({
      type: DeclaracionRef,
      description: 'Declaración extraordinaria: fotografía al grupo con la fecha de hoy.',
      args: { grupoId: t.arg.id({ required: true }) },
      resolve: async (_padre, args, contexto) => {
        try {
          return await contexto.afiliacion.declararExtraordinaria(String(args.grupoId))
        } catch (error) {
          // Yoga enmascara todo lo que no sea un GraphQLError: sin esta
          // traduccion, la pantalla recibe "Unexpected error." en vez del
          // motivo. Traducir en el resolver y no en el servicio es lo que
          // mantiene al servicio sin conocer el framework.
          if (error instanceof NadaQueDeclarar) {
            throw new GraphQLError(error.message, { extensions: { code: 'NADA_QUE_DECLARAR' } })
          }
          // Sin esta, el UNIQUE(fecha, grupo_id) sube como SQLiteError crudo y
          // el dirigente que apreto dos veces lee "Unexpected error.".
          if (error instanceof YaDeclaroHoy) {
            throw new GraphQLError(error.message, { extensions: { code: 'YA_DECLARO_HOY' } })
          }
          throw error
        }
      },
    }),
  )
}
