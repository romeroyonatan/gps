/** Los cargos de un grupo scout. Mismo patron que CATEGORIAS y que RAMAS.
 *
 *  Es un catalogo y no una tabla a proposito, y la razon no es cuantos hay sino
 *  quien crea uno. Si fuera una fila, TipoDeCargo no podria ser un enum de
 *  GraphQL -se fijan al componer el esquema-, el <select> necesitaria su propia
 *  query, y sobre todo cualquier codigo que nombre un cargo necesitaria un id
 *  estable. Y los va a nombrar: el director firma los permisos de acampe, y
 *  Alcance va a mapear cargos a roles. Un cargo con id de core.nuevoId() el
 *  codigo no lo puede nombrar.
 *
 *  Lo que si es abierto son los equipos -tesoreria, formacion-: a esos los crea
 *  alguien y ningun codigo los nombra de a uno. Eso va a ser una tabla, en la
 *  iteracion que los traiga.
 *
 *  Solo los del grupo. Los distritales, diocesanos y de equipo llegan con el
 *  ambito que los necesita.
 *
 *  `director` es el sacerdote a cargo del grupo. No se valida contra la
 *  categoria: en la practica es adherente y el jefe de grupo es activo, pero
 *  eso es un hecho del mundo, no una regla que el sistema imponga. */
export const TIPOS_DE_CARGO = [
  { id: 'jefeDeGrupo', nombre: 'Jefe/Jefa de grupo' },
  { id: 'subjefeDeGrupo', nombre: 'Subjefe/Subjefa de grupo' },
  { id: 'jefeDeRama', nombre: 'Jefe/Jefa de rama' },
  { id: 'capellan', nombre: 'Capellán' },
  { id: 'director', nombre: 'Director' },
] as const

export type TipoDeCargo = (typeof TIPOS_DE_CARGO)[number]['id']

export function nombreDelCargo(cargo: TipoDeCargo): string {
  return TIPOS_DE_CARGO.find((candidato) => candidato.id === cargo)?.nombre ?? cargo
}
