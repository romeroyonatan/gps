// Imports con efecto, no de tipos: ademas de cargar cada modulo traen la
// ampliacion de Context que declara. Sin ellos, ctx.estructura y ctx.personas
// no existen al compilar este paquete solo. Es el unico modulo autorizado a
// conocer a los otros: es literalmente su razon de ser (spec 6.1).
import '@gps/estructura/servidor'
import '@gps/personas/servidor'
import type { Context } from '@gps/core'
import type { Rama } from '@gps/estructura/dominio'
import type { DatosDePersona } from '@gps/personas/dominio'

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

/** Las personas de la demostracion. Los criterios, todos por la misma razon que
 *  los grupos de arriba -un demo donde todas las filas son iguales no muestra si
 *  la pantalla aguanta los casos que se rompen-: edades repartidas de castores a
 *  adulto mayor, un pasaporte entre once DNI, apellidos con acento y con enie
 *  -que son los que exponen el orden alfabetico-, y un apellido compuesto y un
 *  nombre compuesto, que son los que exponen partir un nombre completo con
 *  heuristicas.
 *
 *  Todavia no pertenecen a ningun grupo: esa relacion llega con la iteracion que
 *  la tenga que mostrar. */
const PERSONAS: readonly DatosDePersona[] = [
  {
    tipoDeDocumento: 'dni',
    numeroDeDocumento: '55.402.118',
    nombres: 'Ámbar',
    apellidos: 'Ávila',
    fechaDeNacimiento: '2020-03-14',
  },
  {
    tipoDeDocumento: 'dni',
    numeroDeDocumento: '53.119.847',
    nombres: 'Joaquín',
    apellidos: 'Bustos',
    fechaDeNacimiento: '2018-07-02',
  },
  {
    tipoDeDocumento: 'dni',
    numeroDeDocumento: '49.877.210',
    nombres: 'María Luz',
    apellidos: 'Del Águila',
    fechaDeNacimiento: '2015-11-23',
  },
  {
    tipoDeDocumento: 'pasaporte',
    numeroDeDocumento: 'AB1234567',
    nombres: 'Piotr',
    apellidos: 'Kowalski',
    fechaDeNacimiento: '2013-08-21',
  },
  {
    tipoDeDocumento: 'dni',
    numeroDeDocumento: '46.210.553',
    nombres: 'Tomás',
    apellidos: 'Ibáñez',
    fechaDeNacimiento: '2011-01-09',
  },
  {
    tipoDeDocumento: 'dni',
    numeroDeDocumento: '43.998.104',
    nombres: 'Milagros',
    apellidos: 'Núñez',
    fechaDeNacimiento: '2008-05-30',
  },
  {
    tipoDeDocumento: 'dni',
    numeroDeDocumento: '40.522.967',
    nombres: 'Bruno',
    apellidos: 'Ochoa',
    fechaDeNacimiento: '2004-09-17',
  },
  {
    tipoDeDocumento: 'dni',
    numeroDeDocumento: '36.114.780',
    nombres: 'Sofía',
    apellidos: 'Peña',
    fechaDeNacimiento: '1998-02-11',
  },
  {
    tipoDeDocumento: 'dni',
    numeroDeDocumento: '33.207.415',
    nombres: 'Ignacio',
    apellidos: 'Quiroga',
    fechaDeNacimiento: '1993-06-25',
  },
  {
    tipoDeDocumento: 'dni',
    numeroDeDocumento: '28.904.331',
    nombres: 'Ana Clara',
    apellidos: 'Sánchez Elía',
    fechaDeNacimiento: '1985-10-08',
  },
  {
    tipoDeDocumento: 'dni',
    numeroDeDocumento: '25.011.628',
    nombres: 'Ezequiel',
    apellidos: 'Vera',
    fechaDeNacimiento: '1978-04-19',
  },
  {
    tipoDeDocumento: 'dni',
    numeroDeDocumento: '20.447.195',
    nombres: 'Rosario',
    apellidos: 'Zaballa',
    fechaDeNacimiento: '1968-12-03',
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

  for (const datos of PERSONAS) {
    await ctx.personas.crearPersona(datos)
  }
}
