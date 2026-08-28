import type { Builder } from '@gps/core'
import { GraphQLError } from 'graphql'
import { TIPOS_DE_DOCUMENTO, type TipoDeDocumento } from '../dominio/documentos'
import type { DatosDePersona, Persona } from '../dominio/modelos'
import { DatosInvalidos, DocumentoDuplicado } from './servicio'

export function registrarSchema(builder: Builder): void {
  const TipoDeDocumentoRef = builder.enumType('TipoDeDocumento', {
    description: 'Tipos de documento que la asociacion acepta.',
    // Los valores son los ids del dominio, en minuscula y no gritados como manda
    // la convencion de GraphQL. Es a proposito, igual que en el enum Rama: asi
    // lo que viaja por la red es el id, y la pantalla saca la etiqueta de
    // TIPOS_DE_DOCUMENTO sin una tabla de traduccion en el medio.
    values: TIPOS_DE_DOCUMENTO.map((tipo) => tipo.id) as unknown as readonly TipoDeDocumento[],
  })

  // No expone `edad`: calcularla exige consultar el reloj, que esta prohibido
  // bajo src/servidor/, y ademas el "hoy" correcto es el de quien mira la
  // pantalla, no el del servidor. El cliente la calcula con calcularEdad, que ya
  // tiene desde /dominio.
  const PersonaRef = builder.objectRef<Persona>('Persona').implement({
    description: 'Los datos personales de un miembro de la asociacion.',
    fields: (t) => ({
      id: t.exposeID('id'),
      tipoDeDocumento: t.field({
        type: TipoDeDocumentoRef,
        resolve: (persona) => persona.tipoDeDocumento,
      }),
      numeroDeDocumento: t.exposeString('numeroDeDocumento'),
      nombres: t.exposeString('nombres'),
      apellidos: t.exposeString('apellidos'),
      fechaDeNacimiento: t.exposeString('fechaDeNacimiento', {
        description: 'Fecha de calendario en formato aaaa-mm-dd, sin hora ni zona horaria.',
      }),
    }),
  })

  const DatosDePersonaRef = builder.inputRef<DatosDePersona>('DatosDePersona').implement({
    description: 'Los datos que necesita el alta de una persona.',
    // `required: true` en cada campo: defaultFieldNullability solo invierte el
    // default de los campos de salida, los de entrada siguen siendo opcionales.
    fields: (t) => ({
      tipoDeDocumento: t.field({ type: TipoDeDocumentoRef, required: true }),
      numeroDeDocumento: t.string({ required: true }),
      nombres: t.string({ required: true }),
      apellidos: t.string({ required: true }),
      fechaDeNacimiento: t.string({ required: true }),
    }),
  })

  builder.queryField('personas', (t) =>
    t.field({
      type: [PersonaRef],
      description: 'Todas las personas, ordenadas por apellido.',
      resolve: async (_padre, _args, contexto) => [...(await contexto.personas.listarPersonas())],
    }),
  )

  builder.mutationField('crearPersona', (t) =>
    t.field({
      type: PersonaRef,
      description: 'Da de alta una persona.',
      args: { datos: t.arg({ type: DatosDePersonaRef, required: true }) },
      resolve: async (_padre, args, contexto) => {
        try {
          return await contexto.personas.crearPersona(args.datos)
        } catch (error) {
          // Yoga enmascara todo lo que no sea un GraphQLError: sin esta
          // traduccion, el formulario recibe "Unexpected error." en vez del
          // motivo. La salida no es apagar el enmascarado -eso mandaria al
          // cliente el texto crudo de cualquier fallo, incluidos los de SQLite-,
          // es traducir aca. Traducir en el resolver y no en el servicio es lo
          // que mantiene al servicio sin conocer el framework, que es lo que le
          // permite correr dentro del telefono, donde no hay Yoga.
          if (error instanceof DatosInvalidos) {
            throw new GraphQLError(error.message, {
              extensions: { code: 'DATOS_INVALIDOS', problemas: error.problemas },
            })
          }
          if (error instanceof DocumentoDuplicado) {
            throw new GraphQLError(error.message, { extensions: { code: 'DOCUMENTO_DUPLICADO' } })
          }
          throw error
        }
      },
    }),
  )
}
