import type { Alcance, Core } from '@gps/core'
import { and, eq, isNull } from 'drizzle-orm'
import type {
  Distrito,
  DistritoConGrupos,
  Grupo,
  GrupoConUnidades,
  SexoDeUnidad,
  Unidad,
} from '../dominio/modelos'
import type { Estructura } from '../dominio/publico'
import { RAMAS, type Rama, ramaDelCatalogo } from '../dominio/ramas'
import { grupoEstabaAbiertoEn } from '../dominio/vigencia'
import { distritos, grupos, unidades } from './tablas'

/** Lo que este modulo hace, que es mas que lo que publica: ver Estructura en
 *  /dominio/publico.ts. `extends` es lo que hace que la implementacion no pueda
 *  quedar corta sin que TypeScript se entere. */
export interface ServicioDeEstructura extends Estructura {
  crearDistrito(datos: { numero: number; zona: string }): Promise<Distrito>
  crearGrupo(datos: { numero: number; nombre: string; distritoId: string }): Promise<Grupo>
  abrirUnidad(datos: {
    grupoId: string
    rama: Rama
    sexo: SexoDeUnidad
    nombre: string
  }): Promise<Unidad>
  cerrarUnidad(unidadId: string): Promise<void>
  cerrarGrupo(grupoId: string): Promise<void>
  /** El arbol de la diocesis: distritos, grupos y unidades abiertas.
   *
   *  No se filtra por alcance, y es a proposito: es el directorio de la
   *  asociacion -que distritos hay, que grupos hay- y saberlo no revela nada
   *  de la gente de un grupo. Los datos de un grupo -sus personas, su cuenta,
   *  sus salidas- si van por alcance, cada uno en su modulo.
   *
   *  Recibe `Alcance` igual porque lo inicia un usuario: la convencion vale
   *  aunque hoy no filtre, y el dia que algo de esto se restrinja el parametro
   *  ya esta donde tiene que estar. */
  listarDistritos(alcance: Alcance): Promise<readonly DistritoConGrupos[]>
}

/** De menor a mayor edad y, dentro de una rama, por nombre: como las muestra
 *  la pantalla. Sin esto el orden seria el de insercion, que es un detalle de
 *  como se cargaron los datos.
 *
 *  Recorrer el catalogo ordena y filtra de una: una unidad de una rama que ya
 *  no esta en RAMAS no se muestra, en vez de colarse hasta el enum de GraphQL.
 *  Importa porque `rama: Rama!` es no nulo hasta arriba, asi que un id viejo
 *  -sacar una rama del catalogo esta descripto como cambio solo de codigo-
 *  anularia la query `distritos` entera: pantalla en blanco, no un grupo mal
 *  dibujado. */
const alfabeto = new Intl.Collator('es')

function ordenarPorCatalogo(deLasUnidades: readonly Unidad[]): Unidad[] {
  return RAMAS.flatMap((rama) =>
    deLasUnidades
      .filter((unidad) => unidad.rama === rama.id)
      .sort((una, otra) => alfabeto.compare(una.nombre, otra.nombre)),
  )
}

/** La unidad no se puede abrir: el nombre esta vacio, o la rama no existe. Las
 *  dos son del mismo campo desde el punto de vista de quien la llama. */
export class UnidadInvalida extends Error {
  constructor(motivo: string) {
    super(motivo)
    this.name = 'UnidadInvalida'
  }
}

/** Los metodos devuelven Promise aunque el driver de SQLite sea sincrono: es
 *  la costura que deja pasar a Postgres o a un driver asincrono en el
 *  telefono sin tocar a ningun consumidor. */
export function crearServicioDeEstructura(core: Core): ServicioDeEstructura {
  return {
    async expandirAlcance(actor) {
      const todosLosDistritos = () =>
        core.bd
          .select({ id: distritos.id })
          .from(distritos)
          .where(isNull(distritos.cerradoEn))
          .all()
          .map(({ id }) => id)
      const todosLosGrupos = () =>
        core.bd
          .select({ id: grupos.id })
          .from(grupos)
          .where(isNull(grupos.cerradoEn))
          .all()
          .map(({ id }) => id)

      if (actor.estaElevado) {
        return {
          actor,
          distritosVisibles: todosLosDistritos(),
          gruposVisibles: todosLosGrupos(),
          esAdministrador: true,
        }
      }

      const distritosVisibles = new Set<string>()
      const gruposVisibles = new Set<string>()
      for (const { ambito } of actor.roles) {
        if (ambito.tipo === 'grupo' && ambito.id) gruposVisibles.add(ambito.id)
        if (ambito.tipo === 'distrito' && ambito.id) distritosVisibles.add(ambito.id)
        if (ambito.tipo === 'diocesis') {
          for (const id of todosLosDistritos()) distritosVisibles.add(id)
          for (const id of todosLosGrupos()) gruposVisibles.add(id)
        }
      }
      if (distritosVisibles.size > 0) {
        const filas = core.bd
          .select({ id: grupos.id, distritoId: grupos.distritoId })
          .from(grupos)
          .where(isNull(grupos.cerradoEn))
          .all()
        for (const grupo of filas) {
          if (distritosVisibles.has(grupo.distritoId)) gruposVisibles.add(grupo.id)
        }
      }
      return {
        actor,
        distritosVisibles: [...distritosVisibles],
        gruposVisibles: [...gruposVisibles],
        esAdministrador: false,
      }
    },

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

    async abrirUnidad(datos) {
      const nombre = datos.nombre.trim()
      if (nombre === '') throw new UnidadInvalida('La unidad necesita un nombre.')
      if (ramaDelCatalogo(datos.rama) === undefined) {
        throw new UnidadInvalida(`La rama ${datos.rama} no existe.`)
      }
      // El grupo abierto lo verifica esta consulta y no la foreign key: la
      // clave solo sabe que el grupo existe, no que sigue abierto. El UNIQUE
      // parcial de la tabla ataja el nombre repetido.
      const abierto = core.bd
        .select({ id: grupos.id })
        .from(grupos)
        .where(and(eq(grupos.id, datos.grupoId), isNull(grupos.cerradoEn)))
        .get()
      if (!abierto) throw new UnidadInvalida('El grupo no existe o esta cerrado.')

      const ahora = core.reloj.ahora()
      const unidad = {
        id: core.nuevoId('unidad'),
        ...datos,
        nombre,
        cerradaEn: null,
        creadoEn: ahora,
        actualizadoEn: ahora,
      }
      core.bd.insert(unidades).values(unidad).run()
      return unidad
    },

    async cerrarUnidad(unidadId) {
      const ahora = core.reloj.ahora()
      core.bd
        .update(unidades)
        .set({ cerradaEn: ahora, actualizadoEn: ahora })
        .where(eq(unidades.id, unidadId))
        .run()
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
        .from(unidades)
        .where(and(eq(unidades.grupoId, grupoId), isNull(unidades.cerradaEn)))
        .all()
      return { ...grupo, unidades: ordenarPorCatalogo(filas) }
    },

    async listarGrupos() {
      return core.bd.select().from(grupos).orderBy(grupos.numero).all()
    },

    async listarDistritos(_alcance) {
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
      const filasUnidades = core.bd.select().from(unidades).where(isNull(unidades.cerradaEn)).all()

      const unidadesPorGrupo = new Map<string, Unidad[]>()
      for (const fila of filasUnidades) {
        const abiertas = unidadesPorGrupo.get(fila.grupoId) ?? []
        abiertas.push(fila)
        unidadesPorGrupo.set(fila.grupoId, abiertas)
      }

      const gruposPorDistrito = new Map<string, GrupoConUnidades[]>()
      for (const grupo of filasGrupos) {
        const delDistrito = gruposPorDistrito.get(grupo.distritoId) ?? []
        delDistrito.push({
          ...grupo,
          unidades: ordenarPorCatalogo(unidadesPorGrupo.get(grupo.id) ?? []),
        })
        gruposPorDistrito.set(grupo.distritoId, delDistrito)
      }

      return filasDistritos.map((distrito) => ({
        ...distrito,
        grupos: gruposPorDistrito.get(distrito.id) ?? [],
      }))
    },

    async distritoEstaAbierto(distritoId) {
      return (
        core.bd
          .select({ id: distritos.id })
          .from(distritos)
          .where(and(eq(distritos.id, distritoId), isNull(distritos.cerradoEn)))
          .get() !== undefined
      )
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
        filas.filter((fila) => grupoEstabaAbiertoEn(fecha, fila.cerradoEn)).map((fila) => fila.id),
      )
    },
  }
}
