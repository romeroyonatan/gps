import { describe, expect, test } from 'bun:test'
import type { Module } from '../src/module'
import { CicloDeDependencias, DependenciaFaltante, ordenarModulos } from '../src/registry'

function moduloFalso(name: string, dependencies: string[] = []): Module<object> {
  return {
    name,
    dependencies,
    createServices: () => ({}),
    registerSchema: () => {},
  }
}

const nombres = (modulos: Module<object>[]) => modulos.map((m) => m.name)

describe('ordenarModulos', () => {
  test('deja intactos los modulos sin dependencias', () => {
    const orden = ordenarModulos([moduloFalso('a'), moduloFalso('b')])
    expect(nombres(orden)).toEqual(['a', 'b'])
  })

  test('pone las dependencias antes que quien las necesita', () => {
    const orden = ordenarModulos([
      moduloFalso('afiliacion', ['personas', 'estructura']),
      moduloFalso('estructura', ['personas']),
      moduloFalso('personas'),
    ])
    expect(nombres(orden)).toEqual(['personas', 'estructura', 'afiliacion'])
  })

  test('conserva el orden de entrada entre modulos sin relacion entre si', () => {
    // `b` y `c` no dependen uno del otro: ambos dependen de `a`. El orden entre
    // ellos tiene que ser el de entrada (c antes que b), no alfabetico ni por
    // orden de descubrimiento. Sin esta asercion, un desempate alfabetico
    // pasaria el test igual.
    const entrada = [moduloFalso('c', ['a']), moduloFalso('b', ['a']), moduloFalso('a')]
    expect(nombres(ordenarModulos(entrada))).toEqual(['a', 'c', 'b'])
  })

  test('falla si una dependencia no esta registrada', () => {
    expect(() => ordenarModulos([moduloFalso('afiliacion', ['personas'])])).toThrow(
      DependenciaFaltante,
    )
  })

  test('falla si hay un ciclo', () => {
    expect(() => ordenarModulos([moduloFalso('a', ['b']), moduloFalso('b', ['a'])])).toThrow(
      CicloDeDependencias,
    )
  })

  test('el mensaje del ciclo nombra a los modulos involucrados', () => {
    // Sin `throw` guardian dentro del try: ese throw lo atrapa su propio catch,
    // y su mensaje contendria las letras que buscamos, con lo cual el test
    // pasaria aunque ordenarModulos dejara de detectar el ciclo. Si no lanza,
    // `mensaje` queda vacio y las dos aserciones fallan, que es lo correcto.
    // Los nombres son largos y distintivos por la misma razon: 'a' y 'b'
    // aparecen en casi cualquier mensaje de error en castellano.
    let mensaje = ''
    try {
      ordenarModulos([
        moduloFalso('personas', ['estructura']),
        moduloFalso('estructura', ['personas']),
      ])
    } catch (error) {
      mensaje = (error as Error).message
    }
    expect(mensaje).toContain('personas')
    expect(mensaje).toContain('estructura')
  })
})
