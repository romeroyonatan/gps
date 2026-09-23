import { describe, expect, test } from 'bun:test'
import { componerEsquema, ordenarModulos } from '@gps/core'
import { crearBuilder } from '@gps/core/graphql'
import { ACCIONES_AUDITADAS } from '../src/auditoria'
import { modulos } from '../src/modules'

describe('inventario de auditoría', () => {
  test('toda mutation registrada tiene una clasificación auditable', () => {
    const esquema = componerEsquema(crearBuilder(), ordenarModulos(modulos))
    const mutations = Object.keys(esquema.getMutationType()?.getFields() ?? {}).sort()
    expect<string[]>([...ACCIONES_AUDITADAS].sort()).toEqual(mutations)
  })
})
