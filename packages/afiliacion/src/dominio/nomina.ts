import { type Rama, ramaDelCatalogo } from '@gps/estructura/dominio'
import {
  CATEGORIAS,
  type MiembroDelGrupo,
  nombreCompleto,
  nombreDelTipo,
} from '@gps/personas/dominio'

/** Las columnas de la nómina del grupo, en orden. Las mismas para el PDF y para
 *  la planilla: son dos usos del mismo documento -presentarlo en el distrito y
 *  trabajarlo en una hoja de cálculo-, no dos documentos. */
export const COLUMNAS_DE_LA_NOMINA = [
  '#',
  'Apellidos y nombres',
  'Documento',
  'Rama',
  'Afiliación',
] as const

export interface FilaDeLaNomina {
  /** Corrido entre las tres secciones, como se presenta en el distrito: la
   *  numeración cuenta personas del grupo, no de cada categoría. */
  readonly numero: number
  /** Las columnas después del número, ya escritas. */
  readonly celdas: readonly string[]
}

export interface SeccionDeLaNomina {
  readonly titulo: string
  readonly filas: readonly FilaDeLaNomina[]
}

/** SQLite compara bytes; Intl mantiene el mismo orden alfabético en español que
 *  las otras nóminas del sistema. */
const alfabeto = new Intl.Collator('es')

/** La nómina del grupo tal como se presenta: las tres categorías en orden, cada
 *  una alfabética, con numeración corrida entre ellas.
 *
 *  Una sección sin nadie no sale: un título con su encabezado y ninguna fila
 *  debajo se lee como si la tabla estuviera rota.
 *
 *  Es una función pura y de /dominio porque es la decisión —qué se muestra, en
 *  qué orden y cómo se escribe cada dato—; dibujar el PDF o armar el ZIP no lo
 *  es, y viven en /servidor. Adentro del PDF los streams van comprimidos, así
 *  que un test que busque texto ahí no probaría nada.
 *
 *  La afiliación se escribe con el período y nunca como un "activo" a secas:
 *  pertenecer al grupo no es estar afiliado, y sin el año no se sabe de cuándo.
 *  El sustantivo y no el adjetivo porque el padrón no guarda el género de la
 *  persona: "Afiliada" en la fila de Ignacio sería un dato inventado. */
export function armarLaNomina(
  miembros: readonly MiembroDelGrupo[],
  ramaDeUnidad: ReadonlyMap<string, Rama>,
  afiliados: ReadonlySet<string>,
  periodo: number,
): readonly SeccionDeLaNomina[] {
  let numero = 0
  return CATEGORIAS.map((categoria) => ({
    titulo: `${categoria.nombre}s`,
    filas: miembros
      .filter((miembro) => miembro.categoria === categoria.id)
      .sort(
        (uno, otro) =>
          alfabeto.compare(uno.persona.apellidos, otro.persona.apellidos) ||
          alfabeto.compare(uno.persona.nombres, otro.persona.nombres),
      )
      .map((miembro) => {
        numero += 1
        // La rama es de la unidad, no de la persona: los adherentes no
        // pertenecen a ninguna y la columna les queda vacía.
        const rama = miembro.unidadId ? ramaDeUnidad.get(miembro.unidadId) : undefined
        return {
          numero,
          celdas: [
            nombreCompleto(miembro.persona),
            `${nombreDelTipo(miembro.persona.tipoDeDocumento)} ${miembro.persona.numeroDeDocumento}`,
            rama ? (ramaDelCatalogo(rama)?.nombre ?? rama) : '',
            afiliados.has(miembro.persona.id) ? `Afiliación ${periodo}` : 'Sin afiliar',
          ],
        }
      }),
  })).filter((seccion) => seccion.filas.length > 0)
}
