import { alcanceDe, type Context } from '@gps/core'
import { type Builder, enumCompartido } from '@gps/core/graphql'
import { TIPOS_DE_CARGO, type TipoDeCargo } from '@gps/personas/dominio'
import { GraphQLError } from 'graphql'
import { type Adjunto, ESTADOS, type Estado, type Permiso } from '../dominio/modelos'
import { PermisoInvalido, PermisoNoEditable } from './borradores'
import { type EstadoDeFirma, FirmaInvalida } from './firmas'

/** Yoga enmascara todo lo que no sea un GraphQLError: sin esta traduccion, la
 *  pantalla recibe "Unexpected error." en vez de "tiene que ir al menos un
 *  dirigente", que es justo lo que hay que corregir.
 *
 *  Traducir en el resolver y no en el servicio es lo que mantiene al servicio
 *  sin conocer el framework, igual que en personas. */
async function traduciendoErrores<T>(correr: () => Promise<T>): Promise<T> {
  try {
    return await correr()
  } catch (error) {
    if (
      error instanceof PermisoInvalido ||
      error instanceof PermisoNoEditable ||
      error instanceof FirmaInvalida
    ) {
      throw new GraphQLError(error.message, {
        extensions: {
          code: error.name,
          // Por campo, para que el formulario marque el input que falla y no
          // un cartel generico arriba.
          problemas: error instanceof PermisoInvalido ? error.problemas : undefined,
        },
      })
    }
    throw error
  }
}

export function registrarSchema(builder: Builder): void {
  const EstadoRef = builder.enumType('EstadoDePermiso', {
    description: 'Por donde va un permiso de salida.',
    values: ESTADOS as unknown as readonly Estado[],
  })

  // enumCompartido: personas declara el mismo enum para los cargos de una
  // persona, y Pothos aborta si un nombre se registra dos veces.
  const CargoRef = enumCompartido(
    builder,
    'TipoDeCargo',
    TIPOS_DE_CARGO.map((cargo) => cargo.id),
    'Los cargos de la asociacion.',
  )

  const FirmaRef = builder.objectRef<EstadoDeFirma>('EstadoDeFirma').implement({
    description: 'Como esta una de las tres firmas de un permiso.',
    fields: (t) => ({
      cargo: t.field({ type: CargoRef, resolve: (estado) => estado.cargo }),
      nombreDelCargo: t.exposeString('nombreDelCargo'),
      quien: t.string({
        nullable: true,
        description: 'Quien firmo, o quien ocupa el cargo hoy. Vacío si nadie lo ocupa.',
        resolve: (estado) =>
          estado.quien ? `${estado.quien.apellidos}, ${estado.quien.nombres}` : null,
      }),
      firmada: t.boolean({ resolve: (estado) => estado.firma !== null }),
      modo: t.string({
        nullable: true,
        description: 'app o papel. Vacío si todavía no firmó.',
        resolve: (estado) => estado.firma?.modo ?? null,
      }),
      fecha: t.string({ nullable: true, resolve: (estado) => estado.firma?.fecha ?? null }),
      verificada: t.boolean({
        nullable: true,
        description:
          'Si el sello cierra. Vacío cuando no hay firma o cuando se firmó en papel, que no lleva sello.',
        resolve: (estado) => estado.verificada,
      }),
    }),
  })

  const AdjuntoRef = builder.objectRef<Adjunto>('Adjunto').implement({
    description: 'Un archivo colgado del permiso: una planificacion, un croquis.',
    fields: (t) => ({
      id: t.exposeID('id'),
      archivoId: t.exposeID('archivoId'),
      // El nombre y el tipo los tiene archivos, no salidas: una lista que diga
      // "archivo_01a0..." no le sirve a nadie.
      nombre: t.string({
        resolve: async (adjunto, _args, contexto) =>
          (await contexto.archivos.obtener(adjunto.archivoId))?.nombre ?? 'archivo',
      }),
      tipo: t.string({
        nullable: true,
        resolve: async (adjunto, _args, contexto) =>
          (await contexto.archivos.obtener(adjunto.archivoId))?.tipo ?? null,
      }),
      url: t.string({
        description: 'Por donde se descarga. Ruta y no bytes: un binario no viaja por GraphQL.',
        resolve: (adjunto) => `/archivos/${adjunto.archivoId}`,
      }),
    }),
  })

  const PermisoRef = builder.objectRef<Permiso>('Permiso').implement({
    description: 'Un permiso de salida: lo que un grupo presenta para salir o acampar.',
    fields: (t) => ({
      id: t.exposeID('id'),
      estado: t.field({ type: EstadoRef, resolve: (permiso) => permiso.estado }),
      lugar: t.exposeString('lugar'),
      desde: t.exposeString('desde'),
      hasta: t.exposeString('hasta'),
      comoSeViaja: t.exposeString('comoSeViaja', { nullable: true }),
      pdfId: t.exposeID('pdfId', { nullable: true }),
      reemplazaA: t.exposeID('reemplazaA', { nullable: true }),
      unidadIds: t.idList({
        description: 'Qué unidades del grupo van.',
        resolve: (permiso, _args, contexto) => [...contexto.salidas.unidadesElegidas(permiso.id)],
      }),
      participantes: t.field({
        type: [ParticipanteRef],
        description: 'Los elegidos mientras es borrador.',
        resolve: async (permiso, _args, contexto) => [
          ...(await contexto.salidas.listarParticipantes(alcanceDe(contexto), permiso.id)),
        ],
      }),
      emitidos: t.field({
        type: [EmitidoRef],
        description: 'Los que figuran en el papel, tal como estaban al emitirse.',
        resolve: async (permiso, _args, contexto) => [
          ...(await contexto.salidas.listarParticipantesEmitidos(alcanceDe(contexto), permiso.id)),
        ],
      }),
      firmas: t.field({
        type: [FirmaRef],
        resolve: async (permiso, _args, contexto) => [
          ...(await contexto.salidas.estadoDeLasFirmas(alcanceDe(contexto), permiso.id)),
        ],
      }),
      adjuntos: t.field({
        type: [AdjuntoRef],
        resolve: async (permiso, _args, contexto) => [
          ...(await contexto.salidas.listarAdjuntos(alcanceDe(contexto), permiso.id)),
        ],
      }),
    }),
  })

  const ParticipanteRef = builder
    .objectRef<{ personaId: string; marca: string }>('Participante')
    .implement({
      fields: (t) => ({
        personaId: t.exposeID('personaId'),
        marca: t.exposeString('marca'),
      }),
    })

  const EmitidoRef = builder
    .objectRef<{
      personaId: string
      marca: string
      nombres: string
      apellidos: string
      numeroDeDocumento: string
      unidad: string
    }>('ParticipanteEmitido')
    .implement({
      fields: (t) => ({
        personaId: t.exposeID('personaId'),
        marca: t.exposeString('marca'),
        nombres: t.exposeString('nombres'),
        apellidos: t.exposeString('apellidos'),
        numeroDeDocumento: t.exposeString('numeroDeDocumento'),
        unidad: t.exposeString('unidad'),
      }),
    })

  const EmisionRef = builder
    .objectRef<{ permiso: Permiso; avisos: readonly { mensaje: string }[] }>('Emision')
    .implement({
      description: 'El permiso emitido y lo que el sistema quiere decir sin impedirlo.',
      fields: (t) => ({
        permiso: t.field({ type: PermisoRef, resolve: (emision) => emision.permiso }),
        avisos: t.stringList({ resolve: (emision) => emision.avisos.map((uno) => uno.mensaje) }),
      }),
    })

  builder.queryField('permisos', (t) =>
    t.field({
      type: [PermisoRef],
      description: 'Los permisos de un grupo, del más próximo al más viejo.',
      args: { grupoId: t.arg.id({ required: true }) },
      resolve: async (_padre, args, contexto) => [
        ...(await contexto.salidas.listarPermisos(alcanceDe(contexto), String(args.grupoId))),
      ],
    }),
  )

  builder.queryField('permiso', (t) =>
    t.field({
      type: PermisoRef,
      nullable: true,
      args: { id: t.arg.id({ required: true }) },
      resolve: async (_padre, args, contexto) =>
        await traduciendoErrores(() =>
          contexto.salidas.obtenerPermiso(alcanceDe(contexto), String(args.id)),
        ),
    }),
  )

  builder.mutationField('crearPermiso', (t) =>
    t.field({
      type: PermisoRef,
      args: {
        grupoId: t.arg.id({ required: true }),
        lugar: t.arg.string({ required: true }),
        desde: t.arg.string({ required: true }),
        hasta: t.arg.string({ required: true }),
        comoSeViaja: t.arg.string(),
      },
      resolve: async (_padre, args, contexto) =>
        await traduciendoErrores(() =>
          contexto.salidas.crearPermiso(alcanceDe(contexto), String(args.grupoId), {
            lugar: args.lugar,
            desde: args.desde,
            hasta: args.hasta,
            comoSeViaja: args.comoSeViaja ?? null,
          }),
        ),
    }),
  )

  builder.mutationField('elegirUnidades', (t) =>
    t.field({
      type: PermisoRef,
      args: {
        permisoId: t.arg.id({ required: true }),
        unidadIds: t.arg.idList({ required: true }),
      },
      resolve: async (_padre, args, contexto) => {
        const permisoId = String(args.permisoId)
        await traduciendoErrores(() =>
          contexto.salidas.elegirUnidades(
            alcanceDe(contexto),
            permisoId,
            args.unidadIds.map(String),
          ),
        )
        return await exigirPermiso(contexto, permisoId)
      },
    }),
  )

  builder.mutationField('agregarParticipante', (t) =>
    t.field({
      type: PermisoRef,
      args: {
        permisoId: t.arg.id({ required: true }),
        personaId: t.arg.id({ required: true }),
      },
      resolve: async (_padre, args, contexto) => {
        const permisoId = String(args.permisoId)
        await traduciendoErrores(() =>
          contexto.salidas.agregarParticipante(
            alcanceDe(contexto),
            permisoId,
            String(args.personaId),
          ),
        )
        return await exigirPermiso(contexto, permisoId)
      },
    }),
  )

  builder.mutationField('quitarParticipante', (t) =>
    t.field({
      type: PermisoRef,
      args: {
        permisoId: t.arg.id({ required: true }),
        personaId: t.arg.id({ required: true }),
      },
      resolve: async (_padre, args, contexto) => {
        const permisoId = String(args.permisoId)
        await traduciendoErrores(() =>
          contexto.salidas.quitarParticipante(
            alcanceDe(contexto),
            permisoId,
            String(args.personaId),
          ),
        )
        return await exigirPermiso(contexto, permisoId)
      },
    }),
  )

  builder.mutationField('emitirPermiso', (t) =>
    t.field({
      type: EmisionRef,
      args: { permisoId: t.arg.id({ required: true }) },
      resolve: async (_padre, args, contexto) =>
        await traduciendoErrores(() =>
          contexto.salidas.emitir(alcanceDe(contexto), String(args.permisoId)),
        ),
    }),
  )

  builder.mutationField('firmarEnApp', (t) =>
    t.field({
      type: PermisoRef,
      description: 'Registra una firma dibujada. `trazos` es el JSON de los trazos normalizados.',
      args: {
        permisoId: t.arg.id({ required: true }),
        cargo: t.arg({ type: CargoRef, required: true }),
        trazos: t.arg.string({ required: true }),
      },
      resolve: async (_padre, args, contexto) => {
        const permisoId = String(args.permisoId)
        await traduciendoErrores(() =>
          contexto.salidas.firmarEnApp(alcanceDe(contexto), permisoId, args.cargo as TipoDeCargo, {
            trazos: JSON.parse(args.trazos),
          }),
        )
        return await exigirPermiso(contexto, permisoId)
      },
    }),
  )

  builder.mutationField('firmarEnPapel', (t) =>
    t.field({
      type: PermisoRef,
      description: 'Declara qué cargos firmaron el escaneo que se subió.',
      args: {
        permisoId: t.arg.id({ required: true }),
        cargos: t.arg({ type: [CargoRef], required: true }),
        escaneoId: t.arg.id({ required: true }),
      },
      resolve: async (_padre, args, contexto) => {
        const permisoId = String(args.permisoId)
        await traduciendoErrores(() =>
          contexto.salidas.firmarEnPapel(
            alcanceDe(contexto),
            permisoId,
            args.cargos as TipoDeCargo[],
            String(args.escaneoId),
          ),
        )
        return await exigirPermiso(contexto, permisoId)
      },
    }),
  )

  builder.mutationField('anularPermiso', (t) =>
    t.field({
      type: PermisoRef,
      args: { permisoId: t.arg.id({ required: true }) },
      resolve: async (_padre, args, contexto) =>
        await traduciendoErrores(() =>
          contexto.salidas.anular(alcanceDe(contexto), String(args.permisoId)),
        ),
    }),
  )

  builder.mutationField('reEmitirPermiso', (t) =>
    t.field({
      type: PermisoRef,
      description: 'Crea un borrador nuevo con los datos de un permiso anulado.',
      args: { permisoId: t.arg.id({ required: true }) },
      resolve: async (_padre, args, contexto) =>
        await traduciendoErrores(() =>
          contexto.salidas.reEmitir(alcanceDe(contexto), String(args.permisoId)),
        ),
    }),
  )

  builder.mutationField('quitarAdjuntoDePermiso', (t) =>
    t.field({
      type: PermisoRef,
      description: 'Saca un adjunto y borra su archivo. No toca las firmas.',
      args: {
        permisoId: t.arg.id({ required: true }),
        adjuntoId: t.arg.id({ required: true }),
      },
      resolve: async (_padre, args, contexto) => {
        const permisoId = String(args.permisoId)
        await traduciendoErrores(() =>
          contexto.salidas.quitarAdjunto(alcanceDe(contexto), permisoId, String(args.adjuntoId)),
        )
        return await exigirPermiso(contexto, permisoId)
      },
    }),
  )

  builder.mutationField('adjuntarAPermiso', (t) =>
    t.field({
      type: PermisoRef,
      args: {
        permisoId: t.arg.id({ required: true }),
        archivoId: t.arg.id({ required: true }),
      },
      resolve: async (_padre, args, contexto) => {
        const permisoId = String(args.permisoId)
        await traduciendoErrores(() =>
          contexto.salidas.adjuntar(alcanceDe(contexto), permisoId, String(args.archivoId)),
        )
        return await exigirPermiso(contexto, permisoId)
      },
    }),
  )
}

/** Las mutations devuelven el permiso releido: la pantalla necesita el estado
 *  nuevo y con esto no tiene que pedirlo aparte. Si no existe es un bug, no un
 *  caso: la operacion que acaba de correr lo tocaba. */
async function exigirPermiso(contexto: Context, permisoId: string): Promise<Permiso> {
  const permiso = await contexto.salidas.obtenerPermiso(alcanceDe(contexto), permisoId)
  if (!permiso)
    throw new Error(`El permiso ${permisoId} desaparecio entre la operacion y la lectura.`)
  return permiso
}
