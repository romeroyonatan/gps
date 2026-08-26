import { printSchema } from 'graphql'
import { componer } from '../src/composicion'

const { esquema } = componer({ version: '0.0.0', entorno: 'prueba', puerto: 0 })
const destino = new URL('../../../schema.gql', import.meta.url).pathname

await Bun.write(destino, `${printSchema(esquema).trim()}\n`)
console.log(`schema.gql actualizado en ${destino}`)
