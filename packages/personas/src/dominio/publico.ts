import type { RolConAmbito } from '@gps/core'
import type { TipoDeCargo } from './cargos'
import type { Categoria } from './categorias'
import type { Persona } from './modelos'

/** Una persona con el grupo al que pertenecia un dia dado. Lleva la Persona
 *  entera y no solo el id porque quien pregunta -afiliacion- guarda una
 *  fotografia: nombre y documento tal como estaban ese dia. */
export interface MiembroActivo {
  readonly persona: Persona
  readonly grupoId: string
}

/** Una persona de un grupo con lo que hace falta para saber si puede ir a una
 *  salida: en que unidad esta y con que categoria. Lleva la Persona entera
 *  porque quien pregunta -salidas- guarda una fotografia al emitir. */
export interface MiembroDelGrupo {
  readonly persona: Persona
  /** null en los adherentes, que no pertenecen a ninguna unidad. */
  readonly unidadId: string | null
  readonly categoria: Categoria
}

/** Lo que personas le publica a los otros modulos, y nada mas.
 *
 *  Es deliberadamente mas chica que ServicioDePersonas: dar de alta a alguien
 *  es operacion de este modulo y de nadie mas. La regla que esto impone
 *  -interfaz publica declarada, contenido privado- es la de los package
 *  interfaces de SAP y del modificador `global` de Salesforce.
 *
 *  Vive en /dominio y no en /servidor porque /servidor es privado: son tipos
 *  puros, sin estado, que cualquiera puede leer. */
export interface Personas {
  /** Si el id pertenece a una Persona existente. Autenticación lo usa antes de
   *  vincular una identidad externa. */
  personaExiste(personaId: string): Promise<boolean>

  /** El grupo al que pertenecía la persona ese día, o null. */
  grupoVigenteDe(personaId: string, fecha: string): Promise<string | null>

  /** Roles derivados de pertenencias, cargos y equipos vigentes. */
  funcionesVigentes(personaId: string, fecha: string): Promise<readonly RolConAmbito[]>

  /** Las personas con pertenencia vigente el dia `fecha` (aaaa-mm-dd), de toda
   *  la asociacion, con el grupo al que pertenecian ese dia.
   *
   *  listarPersonas no sirve para esto: filtra por hasta IS NULL, que es "hoy".
   *  Aca hace falta "el 1 de mayo", con las dos puntas inclusivas, que es la
   *  misma regla que documenta estaVigente. */
  miembrosActivos(fecha: string): Promise<readonly MiembroActivo[]>

  /** Quienes ocupaban el cargo `cargo` de la entidad `ambitoId` el dia `fecha`
   *  (aaaa-mm-dd), con las dos puntas del periodo incluidas. `ambitoId` es null
   *  para los cargos de la diocesis, que no apuntan a ninguna entidad.
   *
   *  Devuelve una lista y no una persona sola porque la tabla no impide que dos
   *  la ocupen a la vez: mandatos que se solapan por un error de carga. Quien
   *  pregunta decide que hacer con eso -salidas toma la primera y avisa- en vez
   *  de recibir una eleccion ya hecha.
   *
   *  Lleva fecha porque la pregunta es historica: quien firma un permiso es
   *  quien ocupa el cargo el dia que firma, no quien lo ocupa hoy. */
  ocupantesDelCargo(
    cargo: TipoDeCargo,
    ambitoId: string | null,
    fecha: string,
  ): Promise<readonly Persona[]>

  /** Los de ese grupo con pertenencia vigente el dia `fecha`, con su unidad y
   *  su categoria.
   *
   *  Devuelve el grupo entero y no filtra por unidad: quien elige unidades es
   *  quien pregunta, y la regla de que adultos sin unidad entran igual es del
   *  dominio de salidas, no de personas. Aca solo se responde quien esta. */
  miembrosDelGrupo(grupoId: string, fecha: string): Promise<readonly MiembroDelGrupo[]>
}
