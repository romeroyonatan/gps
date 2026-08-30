import { type Builder, enumCompartido } from '@gps/core'
import { RAMAS } from '@gps/estructura/dominio'
import { GraphQLError } from 'graphql'
import { TIPOS_DE_CARGO, type TipoDeCargo } from '../dominio/cargos'
import { CATEGORIAS, type Categoria } from '../dominio/categorias'
import { TIPOS_DE_DOCUMENTO, type TipoDeDocumento } from '../dominio/documentos'
import type { DatosDePersona } from '../dominio/modelos'
import type {
  Cargo,
  DatosDeCargo,
  DatosDeIngreso,
  PersonaConVinculos,
  Pertenencia,
} from '../dominio/vinculos'
import { DatosInvalidos, DocumentoDuplicado, GrupoInexistente } from './servicio'

export function registrarSchema(builder: Builder): void {
  const TipoDeDocumentoRef = builder.enumType('TipoDeDocumento', {
    description: 'Tipos de documento que la asociacion acepta.',
    // Los valores son los ids del dominio, en minuscula y no gritados como manda
    // la convencion de GraphQL. Es a proposito, igual que en el enum Rama: asi
    // lo que viaja por la red es el id, y la pantalla saca la etiqueta de
    // TIPOS_DE_DOCUMENTO sin una tabla de traduccion en el medio.
    values: TIPOS_DE_DOCUMENTO.map((tipo) => tipo.id) as unknown as readonly TipoDeDocumento[],
  })

  const RamaRef = enumCompartido(
    builder,
    'Rama',
    RAMAS.map((rama) => rama.id),
    'Ramas en que la asociacion divide a sus miembros por edad.',
  )

  const CategoriaRef = builder.enumType('Categoria', {
    description: 'Como pertenece una persona a su grupo.',
    values: CATEGORIAS.map((categoria) => categoria.id) as unknown as readonly Categoria[],
  })

  const TipoDeCargoRef = builder.enumType('TipoDeCargo', {
    description: 'Los cargos de un grupo scout.',
    values: TIPOS_DE_CARGO.map((cargo) => cargo.id) as unknown as readonly TipoDeCargo[],
  })

  // No expone grupoId: la query ya filtra por grupo, y devolverlo en cada fila
  // seria repetir el argumento de la consulta.
  const PertenenciaRef = builder.objectRef<Pertenencia>('Pertenencia').implement({
    description: 'Como y desde cuando una persona pertenece a su grupo.',
    fields: (t) => ({
      categoria: t.field({ type: CategoriaRef, resolve: (p) => p.categoria }),
      rama: t.field({
        type: RamaRef,
        nullable: true,
        description: 'Vacía si y sólo si la categoría es adherente.',
        resolve: (pertenencia) => pertenencia.rama,
      }),
      desde: t.exposeString('desde', {
        description: 'Fecha de calendario en formato aaaa-mm-dd, sin hora ni zona horaria.',
      }),
    }),
  })

  // Devuelve las fechas y no un booleano `vigente`: calcularlo exige un "hoy",
  // y el hoy correcto es el de quien mira la pantalla, no el del servidor. El
  // cliente lo resuelve con estaVigente, que ya tiene desde /dominio. Es la
  // misma decision que la de no exponer `edad`.
  const CargoRef = builder.objectRef<Cargo>('Cargo').implement({
    description: 'Un cargo de una persona en su grupo, con su periodo.',
    fields: (t) => ({
      cargo: t.field({ type: TipoDeCargoRef, resolve: (fila) => fila.cargo }),
      desde: t.exposeString('desde'),
      hasta: t.exposeString('hasta', {
        nullable: true,
        description:
          'Vacía si no tiene fin previsto. Puede estar en el futuro: un mandato dura cuatro años.',
      }),
    }),
  })

  // No expone `edad`: calcularla exige consultar el reloj, que esta prohibido
  // bajo src/servidor/, y ademas el "hoy" correcto es el de quien mira la
  // pantalla, no el del servidor. El cliente la calcula con calcularEdad, que ya
  // tiene desde /dominio.
  const PersonaRef = builder.objectRef<PersonaConVinculos>('Persona').implement({
    description: 'Un miembro de la asociacion, con sus vinculos vigentes en su grupo.',
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
      pertenencia: t.field({ type: PertenenciaRef, resolve: (persona) => persona.pertenencia }),
      cargos: t.field({
        type: [CargoRef],
        description: 'Todos, también los vencidos: la vigencia la decide el cliente.',
        resolve: (persona) => [...persona.cargos],
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

  const DatosDeCargoRef = builder.inputRef<DatosDeCargo, false>('DatosDeCargo').implement({
    description: 'Un cargo en el alta. Su `desde` es el de la pertenencia.',
    fields: (t) => ({
      cargo: t.field({ type: TipoDeCargoRef, required: true }),
      hasta: t.string({ required: false }),
    }),
  })

  const DatosDeIngresoRef = builder.inputRef<DatosDeIngreso>('DatosDeIngreso').implement({
    description: 'El grupo al que ingresa la persona, y como.',
    fields: (t) => ({
      grupoId: t.id({ required: true }),
      categoria: t.field({ type: CategoriaRef, required: true }),
      rama: t.field({ type: RamaRef, required: false }),
      desde: t.string({ required: true }),
      cargos: t.field({ type: [DatosDeCargoRef], required: true }),
    }),
  })

  builder.queryField('personas', (t) =>
    t.field({
      type: [PersonaRef],
      description: 'Las personas de un grupo, ordenadas por apellido.',
      args: { grupoId: t.arg.id({ required: true }) },
      resolve: async (_padre, args, contexto) => [
        ...(await contexto.personas.listarPersonas(String(args.grupoId))),
      ],
    }),
  )

  builder.mutationField('crearPersona', (t) =>
    t.field({
      type: PersonaRef,
      description: 'Da de alta una persona y la inscribe en un grupo.',
      args: {
        datos: t.arg({ type: DatosDePersonaRef, required: true }),
        ingreso: t.arg({ type: DatosDeIngresoRef, required: true }),
      },
      resolve: async (_padre, args, contexto) => {
        try {
          // Pothos entrega los campos de lista de un input como array simple,
          // sin el `readonly` que pide DatosDeIngreso: se arma campo por campo
          // en vez de castear el argumento entero.
          const ingreso: DatosDeIngreso = {
            grupoId: String(args.ingreso.grupoId),
            categoria: args.ingreso.categoria,
            rama: args.ingreso.rama ?? null,
            desde: args.ingreso.desde,
            cargos: args.ingreso.cargos.map((cargo) => ({
              cargo: cargo.cargo,
              hasta: cargo.hasta ?? null,
            })),
          }
          return await contexto.personas.crearPersona(args.datos, ingreso)
        } catch (error) {
          // Yoga enmascara todo lo que no sea un GraphQLError: sin esta
          // traduccion, el formulario recibe "Unexpected error." en vez del
          // motivo. Traducir en el resolver y no en el servicio es lo que
          // mantiene al servicio sin conocer el framework.
          if (error instanceof DatosInvalidos) {
            throw new GraphQLError(error.message, {
              extensions: { code: 'DATOS_INVALIDOS', problemas: error.problemas },
            })
          }
          if (error instanceof DocumentoDuplicado) {
            throw new GraphQLError(error.message, { extensions: { code: 'DOCUMENTO_DUPLICADO' } })
          }
          if (error instanceof GrupoInexistente) {
            throw new GraphQLError(error.message, { extensions: { code: 'GRUPO_INEXISTENTE' } })
          }
          throw error
        }
      },
    }),
  )
}
