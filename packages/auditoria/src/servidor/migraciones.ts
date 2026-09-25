/// <reference path="./sql.d.ts" />
import type { Migracion } from '@gps/core'
import registroCentral from '../../migraciones/0000_registro_central.sql' with { type: 'text' }

export const migraciones: readonly Migracion[] = [
  { nombre: '0000_registro_central', sql: registroCentral },
]
