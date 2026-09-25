import { Database } from 'bun:sqlite'
import { autorizadores, archivos as moduloDeArchivos } from '@gps/archivos/servidor'
import {
  type Alcance,
  alcanceSinLimites,
  aplicarMigraciones,
  type Bd,
  type Core,
  crearBusDeEventos,
  type DatosDeAuditoria,
  type Module,
  type Reloj,
  type RolConAmbito,
} from '@gps/core'
import type { Estructura, GrupoConUnidades, Unidad } from '@gps/estructura/dominio'
import type { MiembroDelGrupo, Persona, Personas, TipoDeCargo } from '@gps/personas/dominio'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migraciones } from '../src/servidor/migraciones'
import { crearServicioDeSalidas, type ServicioDeSalidas } from '../src/servidor/servicio'

export const HORA = new Date('1970-01-01T00:00:00Z')
export const GRUPO_ID = 'grupo_1'
export const DISTRITO_ID = 'distrito_1'
export const TROPA = 'unidad_tropa'
export const MANADA = 'unidad_manada'

const unidad = (id: string, nombre: string): Unidad => ({
  id,
  grupoId: GRUPO_ID,
  rama: 'scouts',
  sexo: 'mixta',
  nombre,
  cerradaEn: null,
  creadoEn: HORA,
  actualizadoEn: HORA,
})

export const GRUPO: GrupoConUnidades = {
  id: GRUPO_ID,
  numero: 42,
  nombre: 'Ceferino Namuncurá',
  distritoId: DISTRITO_ID,
  cerradoEn: null,
  creadoEn: HORA,
  actualizadoEn: HORA,
  unidades: [unidad(TROPA, 'San Jorge'), unidad(MANADA, 'Seeonee')],
}

export const persona = (id: string, apellidos: string): Persona => ({
  id,
  tipoDeDocumento: 'dni',
  numeroDeDocumento: id.replace(/\D/g, '').padStart(8, '3'),
  nombres: 'Nombre',
  apellidos,
  fechaDeNacimiento: '2010-05-01',
  domicilio: 'Av. Siempre Viva 742',
  telefonoDeContacto: '11 5555-1234',
  creadoEn: HORA,
  actualizadoEn: HORA,
})

/** Quien esta en el grupo y quien ocupa cada cargo. Se arma por test para poder
 *  dejar un cargo vacante o mover a alguien de unidad. */
export interface Mundo {
  miembros: MiembroDelGrupo[]
  cargos: Map<string, Persona[]>
  grupos: GrupoConUnidades[]
}

/** El alcance de quien ocupa un cargo firmante: firmar en la app no lo puede
 *  hacer ni la jefatura elevada, solo el ocupante vigente del cargo. */
export function alcanceDelFirmante(cargo: TipoDeCargo): Alcance {
  const rol = cargo === 'director' ? 'directorDeGrupo' : cargo
  const ambito =
    cargo === 'comisionadoDeDistrito'
      ? ({ tipo: 'distrito', id: DISTRITO_ID } as const)
      : ({ tipo: 'grupo', id: GRUPO_ID } as const)
  return {
    actor: {
      personaId: 'persona_firmante',
      roles: [{ rol, ambito } as RolConAmbito],
      esAdministradorDesignado: false,
      estaElevado: false,
    },
    gruposVisibles: [GRUPO_ID],
    distritosVisibles: [DISTRITO_ID],
    esAdministrador: false,
  }
}

export function mundoPorDefecto(): Mundo {
  const jefe = persona('persona_jefe', 'Paz')
  const director = persona('persona_director', 'Vera')
  const comisionado = persona('persona_comisionado', 'Gil')
  return {
    miembros: [
      { persona: jefe, unidadId: TROPA, categoria: 'activo' },
      { persona: persona('persona_chico', 'Alvarez'), unidadId: TROPA, categoria: 'beneficiario' },
      { persona: persona('persona_lobato', 'Bustos'), unidadId: MANADA, categoria: 'beneficiario' },
      { persona: persona('persona_cocinera', 'Zaballa'), unidadId: null, categoria: 'adherente' },
    ],
    cargos: new Map([
      [`jefeDeGrupo|${GRUPO_ID}`, [jefe]],
      [`director|${GRUPO_ID}`, [director]],
      [`comisionadoDeDistrito|${DISTRITO_ID}`, [comisionado]],
    ]),
    grupos: [GRUPO],
  }
}

export function montar(opciones: { reloj?: Reloj; mundo?: Mundo } = {}) {
  const mundo = opciones.mundo ?? mundoPorDefecto()
  const base = new Database(':memory:')
  const bd: Bd = drizzle(base)
  const guardados = new Map<string, Uint8Array>()
  const eventos: DatosDeAuditoria[] = []
  let contador = 0

  const core: Core = {
    config: { version: '0.0.0', entorno: 'prueba', puerto: 0 },
    logger: { info: () => {}, error: () => {} },
    reloj: opciones.reloj ?? { ahora: () => HORA },
    bd,
    eventos: crearBusDeEventos(),
    auditoria: {
      registrar: (evento) => {
        eventos.push(evento)
        return 'evento_de_auditoria_test'
      },
    },
    modulos: ['archivos', 'salidas'],
    // Sellador falso pero con el comportamiento que importa: cierra consigo
    // mismo y un dato alterado no verifica.
    sellador: {
      sellar: (datos) => ({ sello: `sellado:${datos}`, claveId: 'prueba' }),
      verificar: (datos, sello) => sello.claveId === 'prueba' && sello.sello === `sellado:${datos}`,
    },
    almacenamiento: {
      async guardar(clave, contenido) {
        guardados.set(clave, contenido)
      },
      async leer(clave) {
        const contenido = guardados.get(clave)
        if (!contenido) throw new Error(`no hay nada en ${clave}`)
        return contenido
      },
      async eliminar(clave) {
        guardados.delete(clave)
      },
    },
    conversorDeImagenes: { aJpeg: async (contenido) => contenido },
    // Devuelve hexadecimal y no el contenido de vuelta: un hash de verdad es
    // una cadena corta y sin saltos de línea, y el PDF lo imprime en el pie.
    // Un falso que devolviera el texto entero probaría contra algo que no
    // existe -y rompería al dibujarlo-.
    hash: (contenido) => {
      const texto = typeof contenido === 'string' ? contenido : contenido.join(',')
      let acumulado = 0
      for (const caracter of texto) {
        acumulado = (acumulado * 31 + caracter.charCodeAt(0)) % 0xffffffff
      }
      return acumulado.toString(16).padStart(8, '0').repeat(8)
    },
    nuevoId: (prefijo) => `${prefijo}_${++contador}`,
    nuevoSecreto: () => `secreto_${++contador}`,
  }

  const modulo = (name: string, suyas: typeof migraciones): Module<object> => ({
    name,
    dependencies: [],
    migraciones: suyas,
    createServices: () => ({}),
    accesoAlModulo: { porDefecto: 'denegado', permitidos: [] },
    registerSchema: () => {},
  })
  // El modulo de archivos de verdad, no un falso: lo que se prueba incluye que
  // el PDF emitido quede guardado y se pueda volver a leer.
  aplicarMigraciones(core, [
    modulo('archivos', moduloDeArchivos.migraciones ?? []),
    modulo('salidas', migraciones),
  ])

  // Lo que hace la raiz de composicion: sin esto, descargar un escaneo falla
  // porque nadie reclama ese archivo.
  autorizadores.salidas = async () => true
  const archivos = moduloDeArchivos.createServices(core, {})

  const estructura: Estructura = {
    expandirAlcance: async (actor) => ({
      actor,
      gruposVisibles: mundo.grupos.map(({ id }) => id),
      distritosVisibles: [DISTRITO_ID],
      esAdministrador: false,
    }),
    obtenerGrupo: async (id) => mundo.grupos.find((grupo) => grupo.id === id) ?? null,
    distritoEstaAbierto: async (id) => id === DISTRITO_ID,
    listarGrupos: async () => mundo.grupos,
    listarDistritosSinGrupos: async () => [],
    gruposAbiertosEn: async () => new Set(mundo.grupos.map((grupo) => grupo.id)),
  }

  const personas: Personas = {
    nombreDe: async () => null,
    personaExiste: async (personaId) =>
      mundo.miembros.some(({ persona }) => persona.id === personaId),
    grupoVigenteDe: async (personaId) =>
      mundo.miembros.some(({ persona }) => persona.id === personaId) ? GRUPO_ID : null,
    funcionesVigentes: async () => [],
    miembrosActivos: async () => [],
    miembrosDelGrupo: async (grupoId) => (grupoId === GRUPO_ID ? mundo.miembros : []),
    ocupantesDelCargo: async (cargo: TipoDeCargo, ambitoId) =>
      mundo.cargos.get(`${cargo}|${ambitoId}`) ?? [],
  }

  const servicio: ServicioDeSalidas = crearServicioDeSalidas(core, personas, estructura, archivos)
  return { servicio, archivos, core, bd, mundo, guardados, eventos }
}

/** Un permiso con las dos unidades, un dirigente y un chico: el caso normal. */
export async function permisoConGente(servicio: ServicioDeSalidas) {
  const permiso = await servicio.crearPermiso(alcanceSinLimites(), GRUPO_ID, {
    lugar: 'Estancia La Paz',
    direccion: 'Ruta 9 km 500',
    localidad: 'Los Patos',
    provincia: 'Santa Fe',
    telefono: '11 5488-2210',
    desde: '1970-03-01',
    hasta: '1970-03-03',
    comoSeViaja: 'Micro contratado',
  })
  await servicio.elegirUnidades(alcanceSinLimites(), permiso.id, [TROPA])
  await servicio.elegirResponsable(alcanceSinLimites(), permiso.id, 'persona_jefe')
  return permiso
}

/** Sube un escaneo ya confirmado, para poder firmar en papel.
 *
 *  Un JPEG de verdad y no unos bytes cualquiera: el PDF firmado lo anexa como
 *  pagina, y pdf-lib rechaza lo que no sea una imagen. */
export async function subirEscaneo(
  archivos: ReturnType<typeof montar>['archivos'],
  permisoId: string,
) {
  const bytes = new Uint8Array(
    await Bun.file(new URL('./fixtures/escaneo.jpg', import.meta.url)).arrayBuffer(),
  )
  const subida = await archivos.solicitarSubida({
    nombre: 'firmado.jpg',
    tipo: 'image/jpeg',
    tamano: bytes.length,
    modulo: 'salidas',
    recursoId: permisoId,
  })
  const token = new URL(subida.url, 'http://x').searchParams.get('token') ?? ''
  await archivos.recibirBytes(subida.id, token, bytes)
  await archivos.confirmarSubida(subida.id)
  return subida.id
}
