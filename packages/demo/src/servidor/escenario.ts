// Imports con efecto, no de tipos: ademas de cargar cada modulo traen la
// ampliacion de Context que declara. Sin ellos, ctx.estructura y ctx.personas
// no existen al compilar este paquete solo. Es el unico modulo autorizado a
// conocer a los otros: es literalmente su razon de ser (spec 6.1).
import '@gps/estructura/servidor'
import '@gps/personas/servidor'
import { YaDeclaroHoy } from '@gps/afiliacion/servidor'
import type { Context } from '@gps/core'
import type { Rama } from '@gps/estructura/dominio'
import type { Categoria, DatosDePersona, TipoDeCargo } from '@gps/personas/dominio'

/** La diocesis de la demostracion. Los grupos abren conjuntos distintos de
 *  ramas a proposito: uno completo, varios parciales y uno todavia sin
 *  ninguna. Un demo donde todos los grupos son iguales no muestra si la
 *  pantalla aguanta el caso lleno ni el vacio, que son los que se rompen. */
const DIOCESIS: readonly {
  numero: number
  zona: string
  grupos: readonly {
    numero: number
    nombre: string
    ramas: readonly Rama[]
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
        ramas: ['castores', 'lobatos', 'scouts', 'raiders', 'rovers', 'adultos'],
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
  desde: string
  cargos?: readonly { cargo: TipoDeCargo; hasta: string | null }[]
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
  },
]

/** Siembra el escenario llamando a los servicios publicos de cada modulo, no
 *  escribiendo SQL. Es la propiedad que decide el diseño: los datos del demo
 *  pasan por las mismas validaciones y reglas de dominio que los reales.
 *
 *  Este archivo conoce a todos los modulos que quiera representar, que es lo
 *  que el resto de la arquitectura evita. La diferencia es que agregar un
 *  modulo no obliga a tocarlo: el sistema funciona igual sin que lo mencione. */
export async function sembrarEscenario(ctx: Context): Promise<void> {
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

      for (const rama of datosDelGrupo.ramas) {
        await ctx.estructura.abrirRama(grupo.id, rama)
      }

      if (datosDelGrupo.cerrado) {
        await ctx.estructura.cerrarGrupo(grupo.id)
      }
    }
  }

  const gruposPorNumero = new Map(
    (await ctx.estructura.listarDistritos())
      .flatMap((distrito) => distrito.grupos)
      .map((grupo) => [grupo.numero, grupo.id]),
  )

  for (const persona of PERSONAS) {
    const grupoId = gruposPorNumero.get(persona.numeroDeGrupo)
    if (!grupoId) throw new Error(`El escenario no tiene el grupo ${persona.numeroDeGrupo}.`)
    await ctx.personas.crearPersona(persona.datos, {
      grupoId,
      categoria: persona.categoria,
      rama: persona.rama,
      desde: persona.desde,
      cargos: persona.cargos ?? [],
    })
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
    await ctx.afiliacion.declararExtraordinaria(grupoDeLaExtraordinaria)
  } catch (error) {
    // Los dos dias del anio en que se siembra el demo justo en una fecha
    // ordinaria, la declaracion del dia ya la emitio el barrido de arriba y el
    // grupo 42 no puede declarar dos veces. El escenario queda igual de bueno
    // -esa ordinaria es la declaracion de hoy- asi que se sigue.
    if (!(error instanceof YaDeclaroHoy)) throw error
  }
}
