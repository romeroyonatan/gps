import type { AccesoAlModulo } from '@gps/core'

/** Archivos no decide nada por si mismo: cada archivo pertenece a un recurso
 *  de otro modulo, que es quien autoriza verlo (ver `autorizadores`). Esta
 *  capa solo evita que un anonimo pueda pedir una subida. */
export const accesoAlModulo: AccesoAlModulo = {
  porDefecto: 'denegado',
  permitidos: [
    'jefeDeGrupo',
    'secretariaDeGrupo',
    'directorDeGrupo',
    'comisionadoDeDistrito',
    'autoridadDeDistrito',
    'jefeScoutDiocesano',
    'administracionDiocesana',
  ],
}
