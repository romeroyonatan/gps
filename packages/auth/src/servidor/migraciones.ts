/// <reference path="./sql.d.ts" />
import type { Migracion } from '@gps/core'
import autenticacion from '../../migraciones/0000_autenticacion.sql' with { type: 'text' }

export const migraciones: readonly Migracion[] = [
  { nombre: '0000_autenticacion', sql: autenticacion },
]
