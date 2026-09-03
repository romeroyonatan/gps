import { afiliacion } from '@gps/afiliacion/servidor'
import { estructura } from '@gps/estructura/servidor'
import { personas } from '@gps/personas/servidor'
import { sistema } from '@gps/sistema/servidor'

/** La lista de modulos registrados. Agregar un modulo nuevo es agregarlo aca
 *  y nada mas: el orden lo resuelve ordenarModulos por dependencias. */
export const modulos = [sistema, estructura, personas, afiliacion]
