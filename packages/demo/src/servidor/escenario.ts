// Imports con efecto, no de tipos: ademas de cargar cada modulo traen la
// ampliacion de Context que declara. Sin ellos, ctx.estructura y ctx.personas
// no existen al compilar este paquete solo. Es el unico modulo autorizado a
// conocer a los otros: es literalmente su razon de ser (spec 6.1).
import '@gps/estructura/servidor'
import '@gps/personas/servidor'
import '@gps/tesoreria/servidor'
import '@gps/salidas/servidor'
import { YaDeclaroHoy } from '@gps/afiliacion/servidor'
import { type Alcance, alcanceSinLimites, type Context } from '@gps/core'
import { aFechaDeCalendario } from '@gps/core/fechas'
import { RAMAS, type Rama, type SexoDeUnidad } from '@gps/estructura/dominio'
import {
  ambitoDelCargo,
  type Categoria,
  type DatosDePersona,
  type TipoDeCargo,
} from '@gps/personas/dominio'

/** La diocesis de la demostracion. Los grupos abren conjuntos distintos de
 *  ramas a proposito: uno completo, varios parciales y uno todavia sin
 *  ninguna. Un demo donde todos los grupos son iguales no muestra si la
 *  pantalla aguanta el caso lleno ni el vacio, que son los que se rompen.
 *
 *  Casi todas las unidades se declaran con la rama sola y el escenario les pone
 *  nombre y sexo por defecto: lo que importa de ellas es que existan. Las que
 *  se escriben enteras son las que ejercitan el caso nuevo -el grupo 42 tiene
 *  dos tropas scout, una femenina y una masculina-, que es justo lo que antes
 *  no se podia representar. */
type UnidadDelEscenario = Rama | { rama: Rama; sexo: SexoDeUnidad; nombre: string }

const DIOCESIS: readonly {
  numero: number
  zona: string
  grupos: readonly {
    numero: number
    nombre: string
    ramas: readonly UnidadDelEscenario[]
    cerrado?: boolean
  }[]
}[] = [
  {
    numero: 1,
    zona: 'San Isidro',
    grupos: [
      {
        numero: 7,
        nombre: 'San Jorge',
        ramas: ['lobatos', 'scouts'],
      },
      {
        numero: 15,
        nombre: 'Nuestra Señora de Luján',
        ramas: ['castores', 'lobatos', 'scouts', 'raiders'],
      },
      {
        numero: 42,
        nombre: 'Ceferino Namuncurá',
        ramas: [
          'castores',
          'lobatos',
          { rama: 'scouts', sexo: 'femenina', nombre: 'Santa Juana de Arco' },
          { rama: 'scouts', sexo: 'masculina', nombre: 'San Jorge' },
          'raiders',
          'rovers',
          'adultos',
        ],
      },
      { numero: 61, nombre: 'San Francisco de Asís', ramas: ['scouts'] },
    ],
  },
  {
    numero: 2,
    zona: 'Quilmes',
    grupos: [
      {
        numero: 3,
        nombre: 'Santa María de los Ángeles',
        ramas: ['lobatos', 'scouts', 'raiders', 'rovers'],
      },
      { numero: 28, nombre: 'Beato Artémides Zatti', ramas: ['lobatos', 'scouts'] },
      { numero: 54, nombre: 'Don Bosco', ramas: ['castores', 'lobatos', 'scouts'] },
      // Cerrado: no tiene que aparecer en pantalla. Es lo que ejercita el filtro.
      { numero: 19, nombre: 'San Miguel Arcángel', ramas: ['lobatos'], cerrado: true },
    ],
  },
  {
    numero: 3,
    zona: 'Ciudad',
    grupos: [
      { numero: 9, nombre: 'Cristo Rey', ramas: ['lobatos', 'scouts', 'raiders'] },
      {
        numero: 33,
        nombre: 'María Auxiliadora',
        ramas: ['castores', 'lobatos', 'scouts', 'raiders', 'rovers'],
      },
      { numero: 77, nombre: 'San Ignacio de Loyola', ramas: ['rovers'] },
    ],
  },
  {
    numero: 4,
    zona: 'Morón',
    grupos: [
      { numero: 12, nombre: 'Santa Teresita', ramas: ['lobatos', 'scouts'] },
      // Recien fundado: todavia no abrio ninguna rama.
      { numero: 88, nombre: 'Padre Mario Pantaleo', ramas: [] },
    ],
  },
]

/** Las personas de la demostracion, con su grupo. Los criterios son los mismos
 *  que los de los grupos, y por la misma razon: un demo donde todas las filas
 *  son iguales no muestra si la pantalla aguanta los casos que se rompen.
 *
 *  Edades repartidas de castores a adulto mayor, un pasaporte entre los DNI,
 *  apellidos con acento y con enie -que son los que exponen el orden
 *  alfabetico-, un apellido compuesto y un nombre compuesto -que son los que
 *  exponen partir un nombre completo con heuristicas-, las tres categorias, un
 *  adherente sin ningun cargo, y un cargo con mandato al futuro junto a uno ya
 *  vencido, para que estaVigente tenga los dos casos en pantalla.
 *
 *  El grueso va al grupo 42, que tiene las seis ramas abiertas: es el que
 *  ejercita la pantalla llena. El 88 queda sin nadie a proposito. */
const PERSONAS: readonly {
  datos: DatosDePersona
  numeroDeGrupo: number
  categoria: Categoria
  rama: Rama | null
  /** Solo cuando el grupo tiene dos unidades de esa rama. */
  unidad?: string
  desde: string
  cargos?: readonly { cargo: TipoDeCargo; hasta: string | null }[]
  /** Cargos fuera del grupo. Van aparte de `cargos` porque no se asignan en el
   *  alta: esos son del grupo al que la persona ingresa, y estos apuntan al
   *  distrito de ese grupo o a la diocesis, que no es una entidad. */
  cargosDeAmbitoMayor?: readonly { cargo: TipoDeCargo; hasta: string | null }[]
}[] = [
  // El grueso en el 42, que tiene las seis ramas abiertas, con una persona por
  // rama de castores a adultos: es el que ejercita la pantalla llena.
  {
    datos: {
      tipoDeDocumento: 'dni',
      numeroDeDocumento: '55.402.118',
      nombres: 'Ámbar',
      apellidos: 'Ávila',
      fechaDeNacimiento: '2020-03-14',
    },
    numeroDeGrupo: 42,
    categoria: 'beneficiario',
    rama: 'castores',
    desde: '2025-03-01',
  },
  {
    datos: {
      tipoDeDocumento: 'dni',
      numeroDeDocumento: '53.119.847',
      nombres: 'Joaquín',
      apellidos: 'Bustos',
      fechaDeNacimiento: '2018-07-02',
    },
    numeroDeGrupo: 42,
    categoria: 'beneficiario',
    rama: 'lobatos',
    desde: '2024-03-02',
  },
  {
    datos: {
      tipoDeDocumento: 'dni',
      numeroDeDocumento: '49.877.210',
      nombres: 'María Luz',
      apellidos: 'Del Águila',
      fechaDeNacimiento: '2015-11-23',
    },
    numeroDeGrupo: 42,
    categoria: 'beneficiario',
    rama: 'scouts',
    // La unica en la otra tropa scout del grupo: sin alguien de cada lado, la
    // pantalla muestra dos tropas y una vacia, que no es el caso a mirar.
    unidad: 'Santa Juana de Arco',
    desde: '2023-03-04',
  },
  {
    // El unico pasaporte entre los DNI.
    datos: {
      tipoDeDocumento: 'pasaporte',
      numeroDeDocumento: 'AB1234567',
      nombres: 'Piotr',
      apellidos: 'Kowalski',
      fechaDeNacimiento: '2013-08-21',
    },
    numeroDeGrupo: 42,
    categoria: 'beneficiario',
    rama: 'scouts',
    desde: '2024-03-02',
  },
  {
    datos: {
      tipoDeDocumento: 'dni',
      numeroDeDocumento: '46.210.553',
      nombres: 'Tomás',
      apellidos: 'Ibáñez',
      fechaDeNacimiento: '2011-01-09',
    },
    numeroDeGrupo: 42,
    categoria: 'beneficiario',
    rama: 'raiders',
    desde: '2022-03-05',
  },
  {
    datos: {
      tipoDeDocumento: 'dni',
      numeroDeDocumento: '43.998.104',
      nombres: 'Milagros',
      apellidos: 'Núñez',
      fechaDeNacimiento: '2008-05-30',
    },
    numeroDeGrupo: 42,
    categoria: 'beneficiario',
    rama: 'rovers',
    desde: '2019-03-02',
  },
  {
    // Beneficiario adulto: participa en la rama Adultos y no tiene chicos a
    // cargo, que es lo que lo distingue de ser dirigente.
    datos: {
      tipoDeDocumento: 'dni',
      numeroDeDocumento: '40.522.967',
      nombres: 'Bruno',
      apellidos: 'Ochoa',
      fechaDeNacimiento: '2004-09-17',
    },
    numeroDeGrupo: 42,
    categoria: 'beneficiario',
    rama: 'adultos',
    desde: '2025-03-01',
  },
  {
    // Dirigente de lobatos, jefa de rama sin fin previsto.
    datos: {
      tipoDeDocumento: 'dni',
      numeroDeDocumento: '36.114.780',
      nombres: 'Sofía',
      apellidos: 'Peña',
      fechaDeNacimiento: '1998-02-11',
    },
    numeroDeGrupo: 42,
    categoria: 'activo',
    rama: 'lobatos',
    desde: '2018-03-03',
    cargos: [{ cargo: 'jefeDeRama', hasta: null }],
  },
  {
    // Jefe de grupo con mandato al futuro: el caso que hace que `hasta` no
    // pueda significar "cerrado".
    datos: {
      tipoDeDocumento: 'dni',
      numeroDeDocumento: '33.207.415',
      nombres: 'Ignacio',
      apellidos: 'Quiroga',
      fechaDeNacimiento: '1993-06-25',
    },
    numeroDeGrupo: 42,
    categoria: 'activo',
    rama: 'scouts',
    desde: '2012-03-03',
    cargos: [{ cargo: 'jefeDeGrupo', hasta: '2028-03-01' }],
  },
  {
    // Dos cargos a la vez, que es lo que pasa en un grupo real.
    datos: {
      tipoDeDocumento: 'dni',
      numeroDeDocumento: '28.904.331',
      nombres: 'Ana Clara',
      apellidos: 'Sánchez Elía',
      fechaDeNacimiento: '1985-10-08',
    },
    numeroDeGrupo: 42,
    categoria: 'activo',
    rama: 'raiders',
    desde: '2006-03-04',
    cargos: [
      { cargo: 'subjefeDeGrupo', hasta: '2028-03-01' },
      { cargo: 'jefeDeRama', hasta: null },
    ],
    // Y ademas comisionada del distrito 1, que es el de su grupo: un cargo
    // distrital lo ocupa un dirigente de alguno de sus grupos. Es quien firma
    // los permisos de salida de todos los grupos del distrito.
    cargosDeAmbitoMayor: [{ cargo: 'comisionadoDeDistrito', hasta: '2029-03-01' }],
  },
  {
    // El sacerdote a cargo del grupo: adherente, sin rama, con cargo.
    datos: {
      tipoDeDocumento: 'dni',
      numeroDeDocumento: '25.011.628',
      nombres: 'Ezequiel',
      apellidos: 'Vera',
      fechaDeNacimiento: '1978-04-19',
    },
    numeroDeGrupo: 42,
    categoria: 'adherente',
    rama: null,
    desde: '2015-03-07',
    cargos: [{ cargo: 'director', hasta: null }],
  },
  {
    // La cocinera: adherente, sin rama y sin ningun cargo del catalogo. Es el
    // caso que muestra que categoria y cargo son cosas distintas.
    datos: {
      tipoDeDocumento: 'dni',
      numeroDeDocumento: '20.447.195',
      nombres: 'Rosario',
      apellidos: 'Zaballa',
      fechaDeNacimiento: '1968-12-03',
    },
    numeroDeGrupo: 42,
    categoria: 'adherente',
    rama: null,
    desde: '2010-03-06',
  },
  // El 61 tiene una sola rama abierta: el <select> del formulario tiene que
  // ofrecer una sola opcion.
  {
    datos: {
      tipoDeDocumento: 'dni',
      numeroDeDocumento: '47.330.912',
      nombres: 'Lucía',
      apellidos: 'Ferreyra',
      fechaDeNacimiento: '2012-02-20',
    },
    numeroDeGrupo: 61,
    categoria: 'beneficiario',
    rama: 'scouts',
    desde: '2023-03-04',
  },
  {
    // Cargo ya vencido: el otro lado de estaVigente. En pantalla no tiene que
    // aparecer como etiqueta.
    datos: {
      tipoDeDocumento: 'dni',
      numeroDeDocumento: '35.208.774',
      nombres: 'Martín',
      apellidos: 'Godoy',
      fechaDeNacimiento: '1990-09-05',
    },
    numeroDeGrupo: 61,
    categoria: 'activo',
    rama: 'scouts',
    desde: '2011-03-05',
    cargos: [{ cargo: 'jefeDeRama', hasta: '2024-12-31' }],
    // El unico cargo de la diocesis: no apunta a ninguna entidad, porque hay
    // una sola diocesis por instancia.
    cargosDeAmbitoMayor: [{ cargo: 'jefeScoutDiocesano', hasta: null }],
  },
]

/** Siembra el escenario llamando a los servicios publicos de cada modulo, no
 *  escribiendo SQL. Es la propiedad que decide el diseño: los datos del demo
 *  pasan por las mismas validaciones y reglas de dominio que los reales.
 *
 *  Este archivo conoce a todos los modulos que quiera representar, que es lo
 *  que el resto de la arquitectura evita. La diferencia es que agregar un
 *  modulo no obliga a tocarlo: el sistema funciona igual sin que lo mencione. */
/** El tipo de unidad de la rama alcanza como nombre cuando el grupo tiene una
 *  sola: "Manada", "Clan". Los grupos con dos de la misma rama los escriben. */
function nombrePorDefecto(rama: Rama): string {
  return RAMAS.find((entrada) => entrada.id === rama)?.unidad ?? rama
}

export async function sembrarEscenario(ctx: Context, ahora: Date): Promise<void> {
  for (const datos of DIOCESIS) {
    const distrito = await ctx.estructura.crearDistrito({
      numero: datos.numero,
      zona: datos.zona,
    })

    for (const datosDelGrupo of datos.grupos) {
      const grupo = await ctx.estructura.crearGrupo({
        numero: datosDelGrupo.numero,
        nombre: datosDelGrupo.nombre,
        distritoId: distrito.id,
      })

      for (const unidad of datosDelGrupo.ramas) {
        const datosDeLaUnidad =
          typeof unidad === 'string'
            ? { rama: unidad, sexo: 'mixta' as const, nombre: nombrePorDefecto(unidad) }
            : unidad
        await ctx.estructura.abrirUnidad({ grupoId: grupo.id, ...datosDeLaUnidad })
      }

      if (datosDelGrupo.cerrado) {
        await ctx.estructura.cerrarGrupo(grupo.id)
      }
    }
  }

  const gruposPorNumero = new Map(
    (await ctx.estructura.listarDistritos(alcanceSinLimites()))
      .flatMap((distrito) => distrito.grupos)
      .map((grupo) => [grupo.numero, grupo]),
  )

  for (const persona of PERSONAS) {
    const grupo = gruposPorNumero.get(persona.numeroDeGrupo)
    if (!grupo) throw new Error(`El escenario no tiene el grupo ${persona.numeroDeGrupo}.`)
    // La persona dice su rama y, cuando el grupo tiene dos unidades de esa
    // rama, cual de las dos. Sin `unidad` cae en la primera, que es lo correcto
    // para los grupos que tienen una sola.
    const suya =
      persona.rama === null
        ? null
        : grupo.unidades.find(
            (unidad) =>
              unidad.rama === persona.rama &&
              (persona.unidad === undefined || unidad.nombre === persona.unidad),
          )
    if (persona.rama !== null && !suya) {
      throw new Error(`El grupo ${persona.numeroDeGrupo} no tiene unidad de ${persona.rama}.`)
    }
    const creada = await ctx.personas.crearPersona(alcanceSinLimites(), persona.datos, {
      grupoId: grupo.id,
      categoria: persona.categoria,
      unidadId: suya?.id ?? null,
      desde: persona.desde,
      cargos: persona.cargos ?? [],
    })

    // Aparte del alta: el ambito de estos no es el grupo al que ingresa. El
    // catalogo dice cual es, y de ahi sale a que entidad apuntan.
    for (const suyo of persona.cargosDeAmbitoMayor ?? []) {
      await ctx.personas.asignarCargo({
        personaId: creada.id,
        cargo: suyo.cargo,
        ambitoId: ambitoDelCargo(suyo.cargo) === 'diocesis' ? null : grupo.distritoId,
        desde: persona.desde,
        hasta: suyo.hasta,
      })
    }
  }

  // Las ordinarias del periodo corriente que ya pasaron, y despues una
  // extraordinaria del grupo 42.
  //
  // La extraordinaria queda con la nomina llena y nada que cobrar, porque en el
  // escenario nadie ingreso despues de la ordinaria. Es el caso que la pantalla
  // tiene que saber dibujar, asi que sirve que este.
  await ctx.afiliacion.declararPendientes()

  const grupoDeLaExtraordinaria = gruposPorNumero.get(42)
  if (!grupoDeLaExtraordinaria) throw new Error('El escenario no tiene el grupo 42.')
  try {
    await ctx.afiliacion.declararExtraordinaria(alcanceSinLimites(), grupoDeLaExtraordinaria.id)
  } catch (error) {
    // Los dos dias del anio en que se siembra el demo justo en una fecha
    // ordinaria, la declaracion del dia ya la emitio el barrido de arriba y el
    // grupo 42 no puede declarar dos veces. El escenario queda igual de bueno
    // -esa ordinaria es la declaracion de hoy- asi que se sigue.
    if (!(error instanceof YaDeclaroHoy)) throw error
  }

  // La cuota se carga despues a proposito: ejercita la reconciliacion que
  // recupera declaraciones emitidas cuando Tesoreria todavia no estaba lista.
  const declaraciones = await ctx.afiliacion.listarDeclaraciones()
  const ultima = declaraciones[0]
  if (ultima) {
    await ctx.tesoreria.definirCuota(alcanceSinLimites(), ultima.periodo, 20000)
    await ctx.tesoreria.reconciliar(alcanceSinLimites())

    const [cuentaParcial, cuentaConFavor] = (
      await ctx.tesoreria.listarCuentas(alcanceSinLimites())
    ).filter((cuenta) => cuenta.saldo > 0)
    if (cuentaParcial) {
      await ctx.tesoreria.registrarPago(alcanceSinLimites(), {
        grupoId: cuentaParcial.grupoId,
        fecha: ultima.fecha,
        importe: Math.max(1, Math.floor(cuentaParcial.saldo / 2)),
        medioDePago: 'transferencia',
        referencia: 'Transferencia demo',
      })
    }
    if (cuentaConFavor) {
      await ctx.tesoreria.registrarPago(alcanceSinLimites(), {
        grupoId: cuentaConFavor.grupoId,
        fecha: ultima.fecha,
        importe: cuentaConFavor.saldo + 5000,
        medioDePago: 'efectivo',
        observacion: 'Pago adelantado demo',
      })
    }
  }

  await sembrarSalidas(ctx, grupoDeLaExtraordinaria, ahora)
}

/** Tres permisos del grupo 42, uno por estado que la pantalla tiene que saber
 *  dibujar: un borrador a medio armar, uno emitido con una sola firma, y uno
 *  firmado por los tres. El anulado no se siembra: se llega apretando un boton
 *  y no aporta un caso de dibujo distinto.
 *
 *  Las fechas salen del reloj y no son fijas: un permiso sembrado en 2026 con
 *  fecha 2026 quedaria vencido para siempre, y el aviso de anticipacion no se
 *  veria nunca. */
async function sembrarSalidas(
  ctx: Context,
  grupo: { id: string; distritoId: string; unidades: readonly { id: string; rama: string }[] },
  ahora: Date,
) {
  const distritoId = grupo.distritoId
  // `ahora` entra por parametro y no sale del sistema: es la regla de
  // portabilidad, y el plugin de Biome la hace cumplir tambien aca.
  const enDias = (dias: number) =>
    aFechaDeCalendario(new Date(ahora.getTime() + dias * 24 * 60 * 60 * 1000))

  const tropas = grupo.unidades.filter((unidad) => unidad.rama === 'scouts').map((u) => u.id)
  const manada = grupo.unidades.find((unidad) => unidad.rama === 'lobatos')
  const gente = await ctx.personas.listarPersonas(alcanceSinLimites(), grupo.id)

  /** Arma un permiso con las unidades y todo el que pueda ir. */
  async function armar(datos: {
    lugar: string
    dentroDe: number
    dura: number
    comoSeViaja?: string
    unidades: readonly string[]
  }) {
    const permiso = await ctx.salidas.crearPermiso(alcanceSinLimites(), grupo.id, {
      lugar: datos.lugar,
      desde: enDias(datos.dentroDe),
      hasta: enDias(datos.dentroDe + datos.dura),
      comoSeViaja: datos.comoSeViaja ?? null,
    })
    await ctx.salidas.elegirUnidades(alcanceSinLimites(), permiso.id, datos.unidades)
    for (const persona of gente) {
      const unidadId = persona.pertenencia.unidadId
      if (unidadId !== null && !datos.unidades.includes(unidadId)) continue
      await ctx.salidas.agregarParticipante(alcanceSinLimites(), permiso.id, persona.id)
    }
    return permiso
  }

  // Firmar en la app es lo unico que la elevacion no alcanza -seria falsificar
  // una firma-, asi que la siembra se presenta como el ocupante del cargo.
  const comoFirmante = (cargo: 'jefeDeGrupo' | 'director' | 'comisionadoDeDistrito'): Alcance => {
    const delDistrito = cargo === 'comisionadoDeDistrito'
    return {
      actor: {
        personaId: 'demo_firmante',
        roles: [
          {
            rol: cargo === 'director' ? 'directorDeGrupo' : cargo,
            ambito: delDistrito
              ? { tipo: 'distrito', id: distritoId }
              : { tipo: 'grupo', id: grupo.id },
          },
        ],
        esAdministradorDesignado: false,
        estaElevado: false,
      },
      gruposVisibles: [grupo.id],
      distritosVisibles: [distritoId],
      esAdministrador: false,
    }
  }

  // Un garabato cualquiera: lo que importa es que se vea una firma dibujada.
  const firma = {
    trazos: [
      [
        [0.05, 0.6],
        [0.2, 0.2],
        [0.35, 0.7],
        [0.5, 0.25],
        [0.7, 0.6],
        [0.9, 0.35],
      ],
    ] as const,
  }

  // Borrador: todavia se edita, y con fecha cercana para que se vea el aviso
  // de anticipacion.
  await armar({
    lugar: 'Reserva Natural Otamendi',
    dentroDe: 8,
    dura: 1,
    unidades: manada ? [manada.id] : [],
  })

  // Emitido con una sola firma: el caso de "falta que firmen".
  const emitido = await armar({
    lugar: 'Sierra de la Ventana',
    dentroDe: 45,
    dura: 2,
    comoSeViaja: 'Micro contratado desde la parroquia',
    unidades: tropas,
  })
  await ctx.salidas.emitir(alcanceSinLimites(), emitido.id)
  await ctx.salidas.firmarEnApp(comoFirmante('jefeDeGrupo'), emitido.id, 'jefeDeGrupo', firma)

  // Firmado por los tres, todos en la app: el escaneo de un papel necesitaria
  // una imagen de verdad en el paquete, y el caso mixto ya lo cubren los tests.
  const firmado = await armar({
    lugar: 'Camping El Durazno',
    dentroDe: 90,
    dura: 3,
    comoSeViaja: 'Combis de las familias',
    unidades: tropas,
  })
  await ctx.salidas.emitir(alcanceSinLimites(), firmado.id)
  for (const cargo of ['jefeDeGrupo', 'director', 'comisionadoDeDistrito'] as const) {
    await ctx.salidas.firmarEnApp(comoFirmante(cargo), firmado.id, cargo, firma)
  }
}
