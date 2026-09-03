import type { Core } from '@gps/core'
import { aFechaDeCalendario } from '@gps/core/fechas'
import { and, eq, isNull } from 'drizzle-orm'
import type { Distrito, DistritoConGrupos, Grupo, GrupoConRamas } from '../dominio/modelos'
import type { Estructura } from '../dominio/publico'
import { RAMAS, type Rama } from '../dominio/ramas'
import { distritos, grupos, ramasDelGrupo } from './tablas'

/** Lo que este modulo hace, que es mas que lo que publica: ver Estructura en
 *  /dominio/publico.ts. `extends` es lo que hace que la implementacion no pueda
 *  quedar corta sin que TypeScript se entere. */
export interface ServicioDeEstructura extends Estructura {
  crearDistrito(datos: { numero: number; zona: string }): Promise<Distrito>
  crearGrupo(datos: { numero: number; nombre: string; distritoId: string }): Promise<Grupo>
  abrirRama(grupoId: string, rama: Rama): Promise<void>
  cerrarGrupo(grupoId: string): Promise<void>
  listarDistritos(): Promise<readonly DistritoConGrupos[]>
}

/** De menor a mayor edad, como las muestra la pantalla. Sin esto el orden
 *  seria el de insercion, que es un detalle de como se cargaron los datos.
 *
 *  Recorrer el catalogo y quedarse con las abiertas ordena y filtra de una:
 *  una rama que ya no esta en RAMAS no se muestra, en vez de colarse hasta el
 *  enum de GraphQL. Importa porque `ramas: [Rama!]!` es no nulo hasta arriba,
 *  asi que un id viejo en `ramas_del_grupo` -sacar una rama del catalogo esta
 *  descripto como cambio solo de codigo- anularia la query `distritos`
 *  entera: pantalla en blanco, no un grupo mal dibujado. */
function ordenarPorCatalogo(ramas: readonly Rama[]): Rama[] {
  const abiertas = new Set<string>(ramas)
  return RAMAS.map((rama) => rama.id).filter((id) => abiertas.has(id))
}

/** Los metodos devuelven Promise aunque el driver de SQLite sea sincrono: es
 *  la costura que deja pasar a Postgres o a un driver asincrono en el
 *  telefono sin tocar a ningun consumidor. */
export function crearServicioDeEstructura(core: Core): ServicioDeEstructura {
  return {
    async crearDistrito(datos) {
      const ahora = core.reloj.ahora()
      const distrito = {
        id: core.nuevoId('distrito'),
        ...datos,
        cerradoEn: null,
        creadoEn: ahora,
        actualizadoEn: ahora,
      }
      core.bd.insert(distritos).values(distrito).run()
      return distrito
    },

    async crearGrupo(datos) {
      const ahora = core.reloj.ahora()
      const grupo = {
        id: core.nuevoId('grupo'),
        ...datos,
        cerradoEn: null,
        creadoEn: ahora,
        actualizadoEn: ahora,
      }
      core.bd.insert(grupos).values(grupo).run()
      return grupo
    },

    async abrirRama(grupoId, rama) {
      core.bd.insert(ramasDelGrupo).values({ grupoId, rama, creadoEn: core.reloj.ahora() }).run()
    },

    async cerrarGrupo(grupoId) {
      // Primera operacion del proyecto que refresca `actualizadoEn`: hasta ahora
      // todo era alta y las dos marcas coincidian.
      const ahora = core.reloj.ahora()
      core.bd
        .update(grupos)
        .set({ cerradoEn: ahora, actualizadoEn: ahora })
        .where(eq(grupos.id, grupoId))
        .run()
    },

    async obtenerGrupo(grupoId) {
      const grupo = core.bd
        .select()
        .from(grupos)
        .where(and(eq(grupos.id, grupoId), isNull(grupos.cerradoEn)))
        .get()
      if (!grupo) return null

      const filas = core.bd
        .select()
        .from(ramasDelGrupo)
        .where(eq(ramasDelGrupo.grupoId, grupoId))
        .all()
      return { ...grupo, ramas: ordenarPorCatalogo(filas.map((fila) => fila.rama)) }
    },

    async listarDistritos() {
      // Tres consultas y el arbol se arma en memoria. Con la cantidad de
      // distritos y grupos de una diocesis alcanza de sobra; si algun dia deja
      // de alcanzar, se arregla aca y en ningun otro lado.
      const filasDistritos = core.bd
        .select()
        .from(distritos)
        .where(isNull(distritos.cerradoEn))
        .orderBy(distritos.numero)
        .all()
      const filasGrupos = core.bd
        .select()
        .from(grupos)
        .where(isNull(grupos.cerradoEn))
        .orderBy(grupos.numero)
        .all()
      const filasRamas = core.bd.select().from(ramasDelGrupo).all()

      const ramasPorGrupo = new Map<string, Rama[]>()
      for (const fila of filasRamas) {
        const abiertas = ramasPorGrupo.get(fila.grupoId) ?? []
        abiertas.push(fila.rama)
        ramasPorGrupo.set(fila.grupoId, abiertas)
      }

      const gruposPorDistrito = new Map<string, GrupoConRamas[]>()
      for (const grupo of filasGrupos) {
        const delDistrito = gruposPorDistrito.get(grupo.distritoId) ?? []
        delDistrito.push({ ...grupo, ramas: ordenarPorCatalogo(ramasPorGrupo.get(grupo.id) ?? []) })
        gruposPorDistrito.set(grupo.distritoId, delDistrito)
      }

      return filasDistritos.map((distrito) => ({
        ...distrito,
        grupos: gruposPorDistrito.get(distrito.id) ?? [],
      }))
    },

    async gruposAbiertosEn(fecha) {
      // El filtro va en memoria y no en el WHERE: cerrado_en es un instante en
      // milisegundos y `fecha` es un dia del almanaque, asi que compararlos
      // exige convertir el primero -y esa conversion depende de la zona
      // horaria, que es justo lo que aFechaDeCalendario resuelve. Son unas
      // decenas de grupos por diocesis; el mismo criterio que listarDistritos.
      const filas = core.bd
        .select({ id: grupos.id, cerradoEn: grupos.cerradoEn })
        .from(grupos)
        .all()
      return new Set(
        filas
          .filter((fila) => fila.cerradoEn === null || fecha <= aFechaDeCalendario(fila.cerradoEn))
          .map((fila) => fila.id),
      )
    },
  }
}
