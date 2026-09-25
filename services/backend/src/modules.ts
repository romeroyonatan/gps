import { afiliacion } from '@gps/afiliacion/servidor'
import { archivos } from '@gps/archivos/servidor'
import { auditoria } from '@gps/auditoria/servidor'
import { auth } from '@gps/auth/servidor'
import { estructura } from '@gps/estructura/servidor'
import { personas } from '@gps/personas/servidor'
import { salidas } from '@gps/salidas/servidor'
import { sistema } from '@gps/sistema/servidor'
import { tesoreria } from '@gps/tesoreria/servidor'

/** La lista de modulos registrados. Agregar un modulo nuevo es agregarlo aca
 *  y nada mas: el orden lo resuelve ordenarModulos por dependencias. */
export const modulos = [
  sistema,
  estructura,
  personas,
  auth,
  afiliacion,
  tesoreria,
  archivos,
  salidas,
  auditoria,
]
