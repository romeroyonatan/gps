import { describe, expect, test } from 'bun:test'
import { type Alcance, alcanceSinLimites, type Core } from '@gps/core'
import type { Estructura, GrupoConUnidades } from '@gps/estructura/dominio'
import type { MiembroDelGrupo, Personas } from '@gps/personas/dominio'
import { crearConsultasDeLaNomina, NominaFueraDeAlcance } from '../src/servidor/nomina'

/** Epoch, como todos los relojes falsos del proyecto: una hora del sistema
 *  colada se distingue de un vistazo en vez de parecer plausible. Al mediodía
 *  porque aFechaDeCalendario usa componentes locales. */
const HORA = new Date('1970-06-01T12:00:00Z')

const GRUPO = {
  id: 'g1',
  numero: 12,
  nombre: 'Santa Juana',
  distritoId: 'd1',
  cerradoEn: null,
  creadoEn: HORA,
  actualizadoEn: HORA,
  unidades: [
    {
      id: 'u1',
      grupoId: 'g1',
      rama: 'scouts' as const,
      sexo: 'femenina' as const,
      nombre: 'Tropa',
      cerradaEn: null,
      creadoEn: HORA,
      actualizadoEn: HORA,
    },
  ],
} satisfies GrupoConUnidades

const MIEMBROS: readonly MiembroDelGrupo[] = [
  {
    persona: {
      id: 'p1',
      apellidos: 'Ferreyra',
      nombres: 'Catalina',
      tipoDeDocumento: 'dni',
      numeroDeDocumento: '46118450',
      fechaDeNacimiento: '1960-12-01',
      creadoEn: HORA,
      actualizadoEn: HORA,
    },
    unidadId: 'u1',
    categoria: 'beneficiario',
  },
]

function consultas() {
  const core = { reloj: { ahora: () => HORA } } as Core
  const personas = {
    async miembrosDelGrupo() {
      return MIEMBROS
    },
  } as unknown as Personas
  const estructura = {
    async obtenerGrupo() {
      return GRUPO
    },
  } as unknown as Estructura
  return crearConsultasDeLaNomina(core, personas, estructura, async () => new Set(['p1']))
}

/** Alcanza el grupo -lo tiene en gruposVisibles porque firma sus permisos- pero
 *  no es de su jefatura: el padrón del grupo no lo ve. Es la diferencia entre
 *  las dos capas de autorización, y por eso el test existe. */
const COMISIONADO: Alcance = {
  actor: {
    personaId: 'p9',
    roles: [{ rol: 'comisionadoDeDistrito', ambito: { tipo: 'distrito', id: 'd1' } }],
    esAdministradorDesignado: false,
    estaElevado: false,
  },
  gruposVisibles: ['g1'],
  distritosVisibles: ['d1'],
  esAdministrador: false,
}

describe('la nómina para bajar', () => {
  test('el PDF sale con el nombre del grupo y la fecha', async () => {
    const { nombre, contenido } = await consultas().pdfDeLaNomina(alcanceSinLimites(), 'g1')
    expect(nombre).toBe('nomina-grupo-12-1970-06-01.pdf')
    expect(new TextDecoder().decode(contenido.subarray(0, 5))).toBe('%PDF-')
  })

  test('el mismo pedido da los mismos bytes: el PDF es reproducible', async () => {
    const uno = await consultas().pdfDeLaNomina(alcanceSinLimites(), 'g1')
    const otro = await consultas().pdfDeLaNomina(alcanceSinLimites(), 'g1')
    expect(uno.contenido).toEqual(otro.contenido)
  })

  test('la planilla lleva la cabecera, el título de la sección y la fila', async () => {
    const { nombre, contenido } = await consultas().xlsxDeLaNomina(alcanceSinLimites(), 'g1')
    expect(nombre).toBe('nomina-grupo-12-1970-06-01.xlsx')
    const texto = new TextDecoder().decode(contenido)
    expect(texto).toContain('Apellidos y nombres')
    expect(texto).toContain('Beneficiarios (1)')
    expect(texto).toContain('Ferreyra, Catalina')
    expect(texto).toContain('Afiliación 1970')
  })

  test('alcanzar el grupo no es ver su padrón', async () => {
    await expect(consultas().pdfDeLaNomina(COMISIONADO, 'g1')).rejects.toThrow(NominaFueraDeAlcance)
    await expect(consultas().xlsxDeLaNomina(COMISIONADO, 'g1')).rejects.toThrow(
      NominaFueraDeAlcance,
    )
  })
})
