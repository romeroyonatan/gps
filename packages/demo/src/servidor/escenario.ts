// Import con efecto, no de tipos: ademas de cargar el modulo trae la
// ampliacion de Context que declara estructura. Sin el, ctx.estructura no
// existe al compilar este paquete solo. Es el unico modulo autorizado a
// conocer a los otros: es literalmente su razon de ser (spec 6.1).
import '@gps/estructura/servidor'
import type { Context } from '@gps/core'
import type { Rama } from '@gps/estructura/dominio'

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
}
