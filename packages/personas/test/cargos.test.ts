import { describe, expect, test } from 'bun:test'
import { ambitoDelCargo, nombreDelCargo, TIPOS_DE_CARGO } from '../src/dominio/cargos'

describe('catalogo de TIPOS_DE_CARGO', () => {
  test('tiene los cinco del grupo, el de distrito y el de diocesis', () => {
    expect(TIPOS_DE_CARGO.map((cargo) => cargo.id)).toEqual([
      'jefeDeGrupo',
      'subjefeDeGrupo',
      'jefeDeRama',
      'capellan',
      'director',
      'comisionadoDeDistrito',
      'jefeScoutDiocesano',
    ])
  })

  test('cada cargo declara un solo ambito', () => {
    // Es lo que decide contra que entidad se valida y que se guarda en
    // ambito_id: un cargo sin ambito no se podria ubicar.
    expect(TIPOS_DE_CARGO.every((cargo) => cargo.ambito !== undefined)).toBe(true)
  })

  test('los tres firmantes de un permiso de salida existen', () => {
    // El jefe de grupo y el director son del grupo; el comisionado, del
    // distrito al que ese grupo pertenece.
    expect(ambitoDelCargo('jefeDeGrupo')).toBe('grupo')
    expect(ambitoDelCargo('director')).toBe('grupo')
    expect(ambitoDelCargo('comisionadoDeDistrito')).toBe('distrito')
  })

  test('el jefe scout diocesano es de la diocesis, que no es una entidad', () => {
    expect(ambitoDelCargo('jefeScoutDiocesano')).toBe('diocesis')
  })
})

describe('ambitoDelCargo', () => {
  test('un cargo que ya no esta en el catalogo cae en grupo, no rompe', () => {
    // Sacar un cargo deja ids viejos en la tabla. Tratarlo como de grupo es lo
    // que menos dano hace: no habilita ningun ambito nuevo.
    expect(ambitoDelCargo('inexistente' as never)).toBe('grupo')
  })
})

describe('nombreDelCargo', () => {
  test('los cargos nuevos tienen nombre para mostrar', () => {
    expect(nombreDelCargo('comisionadoDeDistrito')).toBe('Comisionado/a de distrito')
    expect(nombreDelCargo('jefeScoutDiocesano')).toBe('Jefe/Jefa scout diocesano')
  })
})
