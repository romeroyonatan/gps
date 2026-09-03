import type { Persona } from './modelos'

/** Una persona con el grupo al que pertenecia un dia dado. Lleva la Persona
 *  entera y no solo el id porque quien pregunta -afiliacion- guarda una
 *  fotografia: nombre y documento tal como estaban ese dia. */
export interface MiembroActivo {
  readonly persona: Persona
  readonly grupoId: string
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
  /** Las personas con pertenencia vigente el dia `fecha` (aaaa-mm-dd), de toda
   *  la asociacion, con el grupo al que pertenecian ese dia.
   *
   *  listarPersonas no sirve para esto: filtra por hasta IS NULL, que es "hoy".
   *  Aca hace falta "el 1 de mayo", con las dos puntas inclusivas, que es la
   *  misma regla que documenta estaVigente. */
  miembrosActivos(fecha: string): Promise<readonly MiembroActivo[]>
}
