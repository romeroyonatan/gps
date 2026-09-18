import { printSchema } from 'graphql'
import { crearAlmacenamientoEnMemoria } from '../src/almacenamiento'
import { crearBd } from '../src/bd'
import { componer } from '../src/composicion'
import { crearConversorDeImagenes } from '../src/conversor'
import { crearSellador } from '../src/sellador'

const { esquema } = await componer(
  { version: '0.0.0', entorno: 'prueba', puerto: 0 },
  crearBd(':memory:'),
  crearSellador({ prueba: 'una-clave' }, 'prueba'),
  crearAlmacenamientoEnMemoria(),
  crearConversorDeImagenes(),
)
const destino = new URL('../../../schema.gql', import.meta.url).pathname

await Bun.write(destino, `${printSchema(esquema).trim()}\n`)
console.log(`schema.gql actualizado en ${destino}`)
