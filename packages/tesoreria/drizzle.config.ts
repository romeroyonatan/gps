import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/servidor/tablas.ts',
  out: './migraciones',
})
