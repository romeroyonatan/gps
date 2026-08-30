import { describe, expect, test } from 'bun:test'
import {
  crearBuilder,
  DescripcionesDistintas,
  enumCompartido,
  ValoresDistintos,
} from '../src/builder'

/** El builder de core declara Mutation vacio y GraphQL exige que un tipo tenga
 *  al menos un campo, asi que sin esto toSchema() no compone. */
function conMutation(builder: ReturnType<typeof crearBuilder>) {
  builder.mutationField('nada', (t) => t.field({ type: 'Boolean', resolve: () => true }))
  return builder
}

describe('enumCompartido', () => {
  test('el segundo modulo que lo pide recibe el mismo ref', () => {
    const builder = crearBuilder()
    const uno = enumCompartido(builder, 'Rama', ['lobatos', 'scouts'])
    const otro = enumCompartido(builder, 'Rama', ['lobatos', 'scouts'])
    expect(otro).toBe(uno)
  })

  test('el esquema compone con el enum declarado dos veces', () => {
    // Es la razon de ser del helper: sin el, la segunda llamada a enumType con
    // el mismo nombre aborta al componer.
    const builder = conMutation(crearBuilder())
    const ref = enumCompartido(builder, 'Rama', ['lobatos', 'scouts'])
    enumCompartido(builder, 'Rama', ['lobatos', 'scouts'])
    builder.queryField('rama', (t) => t.field({ type: ref, resolve: () => 'lobatos' as const }))
    expect(builder.toSchema().getType('Rama')).toBeDefined()
  })

  test('falla si el segundo lo pide con valores distintos', () => {
    // Sin este chequeo la divergencia seria silenciosa: el esquema publicaria
    // los valores del que registro primero, que depende del orden de los modulos.
    const builder = crearBuilder()
    enumCompartido(builder, 'Rama', ['lobatos', 'scouts'])
    expect(() => enumCompartido(builder, 'Rama', ['lobatos', 'raiders'])).toThrow(ValoresDistintos)
  })

  test('falla si el segundo lo pide con descripcion distinta', () => {
    // Misma razon que el chequeo de valores: sin esto, la descripcion publicada
    // seria la del modulo que registra primero, en silencio.
    const builder = crearBuilder()
    enumCompartido(builder, 'Rama', ['lobatos', 'scouts'], 'Las ramas.')
    expect(() =>
      enumCompartido(builder, 'Rama', ['lobatos', 'scouts'], 'Otra descripcion.'),
    ).toThrow(DescripcionesDistintas)
  })

  test('cada builder tiene su propio registro', () => {
    // Los tests arman varios builders y no tienen por que contaminarse entre si.
    const uno = enumCompartido(crearBuilder(), 'Rama', ['lobatos'])
    const otro = enumCompartido(crearBuilder(), 'Rama', ['lobatos'])
    expect(otro).not.toBe(uno)
  })
})
