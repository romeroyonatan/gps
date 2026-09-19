/// <reference path="./sql.d.ts" />
import type { Migracion } from '@gps/core'
import inicial from '../../migraciones/0000_inicial.sql' with { type: 'text' }

export const migraciones: readonly Migracion[] = [{ nombre: '0000_inicial', sql: inicial }]
