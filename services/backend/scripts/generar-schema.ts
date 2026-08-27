import { printSchema } from 'graphql'
import { crearBd } from '../src/bd'
import { componer } from '../src/composicion'

const { esquema } = await componer(
  { version: '0.0.0', entorno: 'prueba', puerto: 0 },
  crearBd(':memory:'),
)
const destino = new URL('../../../schema.gql', import.meta.url).pathname

await Bun.write(destino, `${printSchema(esquema).trim()}\n`)
console.log(`schema.gql actualizado en ${destino}`)
