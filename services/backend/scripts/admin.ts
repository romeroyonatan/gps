// CLI de emergencia: reasigna la persona administradora fuera de la API.
// No hay mutation de GraphQL equivalente a propósito (ver diseño §8): esto
// corre con acceso al servidor, no con una sesión.
//
//     bun run admin asignar --persona <id>

import { crearAlmacenamientoEnDisco, crearAlmacenamientoEnMemoria } from '../src/almacenamiento'
import { crearBd } from '../src/bd'
import { componer } from '../src/composicion'
import { crearConversorDeImagenes } from '../src/conversor'
import { leerClavesDeSello, leerConfig, leerDirectorioDeArchivos, leerRutaDeBd } from '../src/index'
import { crearSellador } from '../src/sellador'

async function main(argv: readonly string[]): Promise<void> {
  const [comando, ...resto] = argv
  if (comando !== 'asignar') {
    console.error('Uso: bun run admin asignar --persona <id>')
    process.exit(1)
  }
  const indice = resto.indexOf('--persona')
  const personaId = indice >= 0 ? resto[indice + 1] : undefined
  if (!personaId) {
    console.error('Falta --persona <id>.')
    process.exit(1)
  }

  const config = leerConfig()
  const bd = crearBd(leerRutaDeBd(config.entorno, process.env.BD))
  const claves = leerClavesDeSello(
    config.entorno,
    process.env.CLAVES_DE_SELLO,
    process.env.CLAVE_DE_SELLO_ACTIVA,
  )
  const almacenamiento =
    config.entorno === 'demo'
      ? crearAlmacenamientoEnMemoria()
      : crearAlmacenamientoEnDisco(
          leerDirectorioDeArchivos(config.entorno, process.env.DIRECTORIO_DE_ARCHIVOS),
        )

  const { contexto } = await componer(
    config,
    bd,
    crearSellador(claves.claves, claves.activa),
    almacenamiento,
    crearConversorDeImagenes(),
  )

  try {
    await contexto.auth.asignarAdministrador(personaId)
  } catch (error) {
    console.error(`No se pudo asignar: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  }
  console.log(`Persona ${personaId} asignada como administradora del sistema.`)
}

if (import.meta.main) {
  await main(process.argv.slice(2))
}

export { main }
