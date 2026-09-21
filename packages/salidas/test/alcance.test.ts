import { describe, expect, test } from 'bun:test'
import { type Alcance, alcanceSinLimites, type RolConAmbito } from '@gps/core'
import { PermisoFueraDeAlcance } from '../src/servidor/servicio'
import {
  alcanceDelFirmante,
  DISTRITO_ID,
  GRUPO_ID,
  montar,
  permisoConGente,
  subirEscaneo,
} from './montar'

const OTRO_GRUPO = 'grupo_2'

function alcanceDelGrupo(rol: RolConAmbito['rol'], grupoId: string): Alcance {
  return {
    actor: {
      personaId: `persona_${grupoId}`,
      roles: [{ rol, ambito: { tipo: 'grupo', id: grupoId } }],
      esAdministradorDesignado: false,
      estaElevado: false,
    },
    gruposVisibles: [grupoId],
    distritosVisibles: [],
    esAdministrador: false,
  }
}

const propio = alcanceDelGrupo('jefeDeGrupo', GRUPO_ID)
const ajeno = alcanceDelGrupo('jefeDeGrupo', OTRO_GRUPO)

describe('un permiso es del grupo que sale', () => {
  test('la jefatura ajena no lo lista, no lo lee y no lo descarga', async () => {
    const { servicio } = montar()
    const permiso = await permisoConGente(servicio)

    expect(await servicio.listarPermisos(propio, GRUPO_ID)).toHaveLength(1)
    expect(await servicio.listarPermisos(ajeno, GRUPO_ID)).toEqual([])
    expect(await servicio.obtenerPermiso(ajeno, permiso.id)).toBeNull()
    expect(servicio.pdfDelPermiso(ajeno, permiso.id)).rejects.toThrow(PermisoFueraDeAlcance)
  })

  test('la jefatura ajena no lo edita, no lo emite y no lo anula', async () => {
    const { servicio } = montar()
    const permiso = await permisoConGente(servicio)

    expect(servicio.elegirUnidades(ajeno, permiso.id, [])).rejects.toThrow(PermisoFueraDeAlcance)
    expect(servicio.agregarParticipante(ajeno, permiso.id, 'persona_chico')).rejects.toThrow(
      PermisoFueraDeAlcance,
    )
    expect(servicio.emitir(ajeno, permiso.id)).rejects.toThrow(PermisoFueraDeAlcance)
    expect(servicio.anular(ajeno, permiso.id)).rejects.toThrow(PermisoFueraDeAlcance)
  })

  test('no se crea un permiso en un grupo ajeno', async () => {
    const { servicio } = montar()
    expect(
      servicio.crearPermiso(ajeno, GRUPO_ID, {
        lugar: 'Estancia La Paz',
        direccion: 'Ruta 9 km 500',
        localidad: 'Los Patos',
        provincia: 'Santa Fe',
        telefono: '11 5488-2210',
        desde: '1970-03-01',
        hasta: '1970-03-03',
        comoSeViaja: null,
      }),
    ).rejects.toThrow(PermisoFueraDeAlcance)
  })

  test('el comisionado lee el permiso que tiene que firmar', async () => {
    const { servicio } = montar()
    const permiso = await permisoConGente(servicio)
    // Su alcance trae los grupos de su distrito, que es como lo alcanza.
    const comisionado = alcanceDelFirmante('comisionadoDeDistrito')
    expect(comisionado.distritosVisibles).toContain(DISTRITO_ID)
    expect(await servicio.obtenerPermiso(comisionado, permiso.id)).not.toBeNull()
  })

  test('la firma en la app la pone el ocupante del cargo, no quien administra', async () => {
    const { servicio } = montar()
    const permiso = await permisoConGente(servicio)
    await servicio.emitir(alcanceSinLimites(), permiso.id)

    // La jefatura del grupo administra el permiso, pero firmar por el director
    // es firmar por otro: se rechaza aunque pueda editar todo lo demas.
    expect(
      servicio.firmarEnApp(propio, permiso.id, 'director', { trazos: [[[0, 0]]] }),
    ).rejects.toThrow(PermisoFueraDeAlcance)
  })
})

describe('los archivos de un permiso siguen su alcance', () => {
  test('archivos le pregunta a salidas y salidas mira el grupo', async () => {
    const { servicio, archivos } = montar()
    const permiso = await permisoConGente(servicio)
    await subirEscaneo(archivos, permiso.id)

    expect(await servicio.puedeVerArchivosDe(permiso.id, propio)).toBe(true)
    expect(await servicio.puedeVerArchivosDe(permiso.id, ajeno)).toBe(false)
    expect(await servicio.puedeVerArchivosDe(permiso.id, null)).toBe(false)
  })
})
