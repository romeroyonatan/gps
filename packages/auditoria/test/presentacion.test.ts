import { describe, expect, test } from 'bun:test'
import {
  etiquetaDeAccion,
  etiquetaDeModulo,
  limiteDelDia,
  opcionesDelFiltro,
  quienActuo,
} from '../src/dominio'

describe('presentación de eventos', () => {
  test('la acción se escribe en palabras', () => {
    expect(etiquetaDeAccion('crearPermiso')).toBe('Crear permiso')
    expect(etiquetaDeAccion('cargo.jefeDeGrupo.asignar')).toBe('Cargo · jefe de grupo · asignar')
    expect(etiquetaDeAccion('equipo.secretaria.integrar')).toBe('Equipo · secretaria · agregar')
    expect(etiquetaDeAccion('equipo.secretaria.revocar')).toBe('Equipo · secretaria · quitar')
    expect(etiquetaDeAccion('sudo.escritura')).toBe('Sudo · escritura')
  })

  test('un módulo desconocido se muestra tal cual', () => {
    expect(etiquetaDeModulo('salidas')).toBe('Salidas')
    expect(etiquetaDeModulo('otro')).toBe('otro')
  })
})

describe('filtros de la pantalla', () => {
  test('las opciones salen de lo cargado y conservan la elegida', () => {
    const eventos = [{ accion: 'b' }, { accion: 'a' }, { accion: 'b' }]
    expect(opcionesDelFiltro(eventos, (e) => [e.accion, e.accion], 'z').map((o) => o.id)).toEqual([
      'a',
      'b',
      'z',
    ])
  })

  test('un día mal escrito no filtra, y el fin incluye el día entero', () => {
    expect(limiteDelDia('2026-9-1', false)).toBeUndefined()
    const fin = new Date(limiteDelDia('2026-09-01', true) as string)
    expect(fin.getDate()).toBe(1)
    expect(fin.getHours()).toBe(23)
  })

  test('sin persona no se inventa una', () => {
    expect(quienActuo({ actorNombre: null, origenInterno: 'tesoreria' })).toBe(
      'Sistema · tesoreria',
    )
    expect(quienActuo({})).toBe('Sin identificar')
  })
})
