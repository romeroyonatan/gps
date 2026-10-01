import type { AccesoAlModulo } from '@gps/core'

/** El organigrama lo necesita cualquiera que tenga alguna funcion vigente:
 *  sin distrito, grupo y unidad no se puede ni listar personas ni declarar una
 *  nomina. Que filas ve cada uno lo decide el `Alcance`, no esta capa. */
export const accesoAlModulo: AccesoAlModulo = {
  porDefecto: 'denegado',
  permitidos: [
    'dirigente',
    'jefeDeGrupo',
    'secretariaDeGrupo',
    'directorDeGrupo',
    'comisionadoDeDistrito',
    'autoridadDeDistrito',
    'jefeScoutDiocesano',
    'administracionDiocesana',
    'tesoreriaDiocesana',
  ],
}
