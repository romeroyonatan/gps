import { describe, expect, test } from 'bun:test'
import type { Core } from '../src/core'
import type { Module } from '../src/module'
import {
  CicloDeDependencias,
  crearServicios,
  DependenciaFaltante,
  ordenarModulos,
} from '../src/registry'

// D es Record<string, unknown>, no el default: estos modulos falsos declaran
// dependencias por nombre suelto para probar el orden, sin servicios reales
// detras.
function moduloFalso(
  name: string,
  dependencies: string[] = [],
): Module<object, Record<string, unknown>> {
  return {
    name,
    dependencies,
    createServices: () => ({}),
    accesoAlModulo: { porDefecto: 'denegado', permitidos: [] },
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

describe('crearServicios', () => {
  // crearServicios no toca el Core, solo lo pasa: un objeto vacio alcanza y
  // evita levantar una base para probar el cableado.
  const core = {} as Core

  test('le pasa a cada modulo los servicios de sus dependencias, ya construidos', () => {
    const estructura: Module<{ ramas: string[] }> = {
      name: 'estructura',
      dependencies: [],
      createServices: () => ({ ramas: ['lobatos'] }),
      accesoAlModulo: { porDefecto: 'denegado', permitidos: [] },
      registerSchema: () => {},
    }
    const personas: Module<{ vistas: string[] }, { estructura: { ramas: string[] } }> = {
      name: 'personas',
      dependencies: ['estructura'],
      createServices: (_core, deps) => ({ vistas: deps.estructura.ramas }),
      accesoAlModulo: { porDefecto: 'denegado', permitidos: [] },
      registerSchema: () => {},
    }

    const servicios = crearServicios(core, ordenarModulos([personas, estructura]))

    expect(servicios.personas).toEqual({ vistas: ['lobatos'] })
  })

  test('un modulo sin dependencias recibe un objeto vacio', () => {
    const solo: Module<{ ok: boolean }> = {
      name: 'solo',
      dependencies: [],
      createServices: (_core, deps) => ({ ok: Object.keys(deps).length === 0 }),
      accesoAlModulo: { porDefecto: 'denegado', permitidos: [] },
      registerSchema: () => {},
    }
    expect(crearServicios(core, [solo]).solo).toEqual({ ok: true })
  })
})
