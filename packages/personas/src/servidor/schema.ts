import { alcanceDe } from '@gps/core'
import { type Builder, enumCompartido } from '@gps/core/graphql'
import { GraphQLError } from 'graphql'
import { TIPOS_DE_CARGO, type TipoDeCargo } from '../dominio/cargos'
import { CATEGORIAS, type Categoria } from '../dominio/categorias'
import { TIPOS_DE_DOCUMENTO } from '../dominio/documentos'
import { type IntegranteDeEquipo, TIPOS_DE_EQUIPO, type TipoDeEquipo } from '../dominio/equipos'
import type { DatosDePersona } from '../dominio/modelos'
import type {
  Cargo,
  DatosDeCargo,
  DatosDeIngreso,
  JefeDeGrupo,
  PersonaConVinculos,
  Pertenencia,
} from '../dominio/vinculos'
import {
  CambioDeAutoridadDenegado,
  DatosInvalidos,
  DocumentoDuplicado,
  GrupoInexistente,
} from './servicio'

/** Los errores de negocio del servicio, dichos como los puede mostrar una
 *  pantalla. Yoga enmascara todo lo que no sea un GraphQLError: sin esta
 *  traduccion, el formulario recibe "Unexpected error." en vez del motivo.
 *  Traducir en el resolver y no en el servicio es lo que mantiene al servicio
 *  sin conocer el framework. */
async function traduciendo<T>(correr: () => Promise<T>): Promise<T> {
  try {
    return await correr()
  } catch (error) {
    if (error instanceof CambioDeAutoridadDenegado) {
      throw new GraphQLError(error.message, { extensions: { code: error.name } })
    }
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
}

export function registrarSchema(builder: Builder): void {
  // Los valores son los ids del dominio, en minuscula y no gritados como manda
  // la convencion de GraphQL. Es a proposito, igual que en el enum Rama: asi
  // lo que viaja por la red es el id, y la pantalla saca la etiqueta de
  // TIPOS_DE_DOCUMENTO sin una tabla de traduccion en el medio.
  //
  // enumCompartido y no builder.enumType porque afiliacion declara el mismo
  // enum: dos modulos no pueden declararlo dos veces. Ojo con la descripcion,
  // que tiene que ser identica en los dos, o enumCompartido tira
  // DescripcionesDistintas al componer el esquema.
  const TipoDeDocumentoRef = enumCompartido(
    builder,
    'TipoDeDocumento',
    TIPOS_DE_DOCUMENTO.map((tipo) => tipo.id),
    'Tipos de documento que la asociacion acepta.',
  )

  const CategoriaRef = builder.enumType('Categoria', {
    description: 'Como pertenece una persona a su grupo.',
    values: CATEGORIAS.map((categoria) => categoria.id) as unknown as readonly Categoria[],
  })

  // enumCompartido y no builder.enumType porque salidas declara el mismo enum
  // para el cargo de cada firma, y Pothos aborta si un nombre se registra dos
  // veces. La descripcion tiene que ser identica en los dos.
  const TipoDeCargoRef = enumCompartido(
    builder,
    'TipoDeCargo',
    TIPOS_DE_CARGO.map((cargo) => cargo.id),
    'Los cargos de la asociacion.',
  )

  // No expone grupoId: la query ya filtra por grupo, y devolverlo en cada fila
  // seria repetir el argumento de la consulta.
  const PertenenciaRef = builder.objectRef<Pertenencia>('Pertenencia').implement({
    description: 'Como y desde cuando una persona pertenece a su grupo.',
    fields: (t) => ({
      categoria: t.field({ type: CategoriaRef, resolve: (p) => p.categoria }),
      unidadId: t.exposeID('unidadId', {
        nullable: true,
        description:
          'La unidad del grupo. Vacía si y sólo si la categoría es adherente. La rama sale de la unidad, que la pantalla ya tiene del grupo.',
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
      id: t.exposeID('id'),
      cargo: t.field({ type: TipoDeCargoRef, resolve: (fila) => fila.cargo }),
      desde: t.exposeString('desde'),
      hasta: t.exposeString('hasta', {
        nullable: true,
        description:
          'Vacía si no tiene fin previsto. Puede estar en el futuro: un mandato dura cuatro años.',
      }),
    }),
  })

  const TipoDeEquipoRef = builder.enumType('TipoDeEquipo', {
    description: 'Los equipos funcionales que la autorización conoce.',
    values: TIPOS_DE_EQUIPO.map((equipo) => equipo.id) as unknown as readonly TipoDeEquipo[],
  })

  const IntegranteRef = builder
    .objectRef<IntegranteDeEquipo & { tipo: TipoDeEquipo }>('IntegranteDeEquipo')
    .implement({
      description: 'La pertenencia de una persona a un equipo, con su periodo.',
      fields: (t) => ({
        id: t.exposeID('id'),
        equipoId: t.exposeID('equipoId'),
        tipo: t.field({
          type: TipoDeEquipoRef,
          description: 'De qué equipo es. Sin esto la pantalla los dibuja a todos iguales.',
          resolve: (integrante) => integrante.tipo,
        }),
        desde: t.exposeString('desde'),
        hasta: t.exposeString('hasta', { nullable: true }),
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
      domicilio: t.exposeString('domicilio'),
      telefonoDeContacto: t.exposeString('telefonoDeContacto'),
      pertenencia: t.field({ type: PertenenciaRef, resolve: (persona) => persona.pertenencia }),
      cargos: t.field({
        type: [CargoRef],
        description: 'Todos, también los vencidos: la vigencia la decide el cliente.',
        resolve: (persona) => [...persona.cargos],
      }),
      equipos: t.field({
        type: [IntegranteRef],
        description: 'Los equipos que integra hoy. Secretaría no es un cargo: es esto.',
        resolve: (persona) => [...persona.equipos],
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
      domicilio: t.string({ required: true }),
      telefonoDeContacto: t.string({ required: true }),
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
      unidadId: t.id({ required: false }),
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
        ...(await contexto.personas.listarPersonas(alcanceDe(contexto), String(args.grupoId))),
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
      resolve: async (_padre, args, contexto) =>
        await traduciendo(async () => {
          // Pothos entrega los campos de lista de un input como array simple,
          // sin el `readonly` que pide DatosDeIngreso: se arma campo por campo
          // en vez de castear el argumento entero.
          const ingreso: DatosDeIngreso = {
            grupoId: String(args.ingreso.grupoId),
            categoria: args.ingreso.categoria,
            unidadId: args.ingreso.unidadId === undefined ? null : String(args.ingreso.unidadId),
            desde: args.ingreso.desde,
            cargos: args.ingreso.cargos.map((cargo) => ({
              cargo: cargo.cargo,
              hasta: cargo.hasta ?? null,
            })),
          }
          return await contexto.personas.crearPersona(alcanceDe(contexto), args.datos, ingreso)
        }),
    }),
  )

  // Devuelven Boolean y no la persona: la pantalla invalida la nomina del
  // grupo, que es de donde sale todo lo que muestra. Lo mismo que revocarCargo.
  builder.mutationField('editarPersona', (t) =>
    t.boolean({
      description: 'Corrige los datos personales de alguien del grupo.',
      args: {
        personaId: t.arg.id({ required: true }),
        datos: t.arg({ type: DatosDePersonaRef, required: true }),
      },
      resolve: async (_padre, args, contexto) =>
        await traduciendo(async () => {
          await contexto.personas.editarPersona(
            alcanceDe(contexto),
            String(args.personaId),
            args.datos,
          )
          return true
        }),
    }),
  )

  builder.mutationField('cambiarDeUnidad', (t) =>
    t.boolean({
      description:
        'Pasa a un dirigente a otra unidad de su grupo desde una fecha, conservando el historial.',
      args: {
        personaId: t.arg.id({ required: true }),
        unidadId: t.arg.id({ required: true }),
        desde: t.arg.string({ required: true }),
      },
      resolve: async (_padre, args, contexto) =>
        await traduciendo(async () => {
          await contexto.personas.cambiarDeUnidad(
            alcanceDe(contexto),
            String(args.personaId),
            String(args.unidadId),
            args.desde,
          )
          return true
        }),
    }),
  )

  /** Las cuatro operaciones de plantel. Todas reciben el actor y no el
   *  alcance: quién puede nombrar a quién es una pregunta de función -jefatura
   *  y Secretaría en su grupo, autoridades diocesanas en la diócesis-, y la
   *  responde `personas` con sus políticas puras. */
  const JefeRef = builder.objectRef<JefeDeGrupo>('JefeDeGrupo').implement({
    description: 'Quién conduce un grupo hoy, para el directorio de la asociación.',
    fields: (t) => ({
      grupoId: t.exposeID('grupoId'),
      personaId: t.exposeID('personaId'),
      nombres: t.exposeString('nombres'),
      apellidos: t.exposeString('apellidos'),
    }),
  })

  // Consulta suelta y no un campo de Grupo porque la flecha va en esta
  // dirección: personas conoce a estructura, no al revés. La pantalla hace las
  // dos consultas y cruza por id, igual que con `afiliadosEn`.
  builder.queryField('jefesDeGrupos', (t) =>
    t.field({
      type: [JefeRef],
      description:
        'Quiénes conducen esos grupos el día dado. No filtra por alcance: es el ' +
        'directorio de la asociación, no los datos de la gente de un grupo.',
      args: {
        grupoIds: t.arg.idList({ required: true }),
        fecha: t.arg.string({ required: true }),
      },
      resolve: async (_padre, args, contexto) => [
        ...(await contexto.personas.jefesDeGrupos(
          alcanceDe(contexto),
          args.grupoIds.map(String),
          args.fecha,
        )),
      ],
    }),
  )

  builder.mutationField('asignarCargo', (t) =>
    t.field({
      type: CargoRef,
      description: 'Nombra a alguien en un cargo de su grupo, su distrito o la diócesis.',
      args: {
        personaId: t.arg.id({ required: true }),
        cargo: t.arg({ type: TipoDeCargoRef, required: true }),
        ambitoId: t.arg.id(),
        desde: t.arg.string({ required: true }),
        hasta: t.arg.string(),
      },
      resolve: async (_padre, args, contexto) =>
        await traduciendo(() =>
          contexto.personas.asignarCargoComo(alcanceDe(contexto).actor, {
            personaId: String(args.personaId),
            cargo: args.cargo as TipoDeCargo,
            ambitoId: args.ambitoId === undefined ? null : String(args.ambitoId),
            desde: args.desde,
            hasta: args.hasta ?? null,
          }),
        ),
    }),
  )

  builder.mutationField('revocarCargo', (t) =>
    t.boolean({
      description: 'Saca a alguien de un cargo. El acceso se pierde en el pedido siguiente.',
      args: { cargoId: t.arg.id({ required: true }) },
      resolve: async (_padre, args, contexto) =>
        await traduciendo(async () => {
          await contexto.personas.revocarCargo(alcanceDe(contexto).actor, String(args.cargoId))
          return true
        }),
    }),
  )

  builder.mutationField('integrarEquipo', (t) =>
    t.field({
      type: IntegranteRef,
      description: 'Suma a alguien a Secretaría de su grupo o a un equipo diocesano.',
      args: {
        personaId: t.arg.id({ required: true }),
        tipo: t.arg({ type: TipoDeEquipoRef, required: true }),
        ambitoId: t.arg.id(),
        desde: t.arg.string({ required: true }),
      },
      resolve: async (_padre, args, contexto) =>
        await traduciendo(async () => {
          const tipo = args.tipo as TipoDeEquipo
          const integrante = await contexto.personas.integrarEquipo(alcanceDe(contexto).actor, {
            personaId: String(args.personaId),
            tipo,
            // Secretaría es del grupo; los otros dos son de la diócesis, que
            // no apunta a ninguna entidad. Lo valida el servicio igual.
            ambitoTipo: tipo === 'secretaria' ? 'grupo' : 'diocesis',
            ambitoId: args.ambitoId === undefined ? null : String(args.ambitoId),
            desde: args.desde,
          })
          // El tipo es el que vino en el argumento: el servicio devuelve el
          // integrante, y el equipo al que entró es justamente éste.
          return { ...integrante, tipo }
        }),
    }),
  )

  builder.mutationField('revocarIntegranteDeEquipo', (t) =>
    t.boolean({
      description: 'Saca a alguien de un equipo. El acceso se pierde en el pedido siguiente.',
      args: { integranteId: t.arg.id({ required: true }) },
      resolve: async (_padre, args, contexto) =>
        await traduciendo(async () => {
          await contexto.personas.revocarIntegranteDeEquipo(
            alcanceDe(contexto).actor,
            String(args.integranteId),
          )
          return true
        }),
    }),
  )
}
