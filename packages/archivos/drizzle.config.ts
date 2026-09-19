import { defineConfig } from 'drizzle-kit'

/** Cada modulo genera sus migraciones adentro de su propio paquete. No hay un
 *  archivo central de esquema que todos tengan que editar, que es justo lo
 *  que romperia la arquitectura de modulos.
 *
 *  Regenerar, parado en este directorio:
 *      bunx drizzle-kit generate --name <nombre>
 *  y despues sumar el archivo nuevo a src/servidor/migraciones.ts. */
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/servidor/tablas.ts',
  out: './migraciones',
})
