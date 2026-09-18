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
 *  `ambito` dice contra que entidad apunta el cargo. El jefe de grupo es de un
 *  grupo, el comisionado de un distrito, y el jefe scout diocesano de la
 *  diocesis, que no es una entidad -hay una sola por instancia- asi que no
 *  apunta a nada. El ambito no se guarda en la fila: sale de aca, que es la
 *  unica fuente.
 *
 *  Los de equipo siguen sin estar: llegan con la iteracion que traiga equipos,
 *  que son tabla y no catalogo.
 *
 *  `director` es el sacerdote a cargo del grupo. No se valida contra la
 *  categoria: en la practica es adherente y el jefe de grupo es activo, pero
 *  eso es un hecho del mundo, no una regla que el sistema imponga. */
export const AMBITOS_DE_CARGO = ['grupo', 'distrito', 'diocesis'] as const

export type AmbitoDeCargo = (typeof AMBITOS_DE_CARGO)[number]

export const TIPOS_DE_CARGO = [
  { id: 'jefeDeGrupo', nombre: 'Jefe/Jefa de grupo', ambito: 'grupo' },
  { id: 'subjefeDeGrupo', nombre: 'Subjefe/Subjefa de grupo', ambito: 'grupo' },
  { id: 'jefeDeRama', nombre: 'Jefe/Jefa de rama', ambito: 'grupo' },
  { id: 'capellan', nombre: 'Capellán', ambito: 'grupo' },
  { id: 'director', nombre: 'Director', ambito: 'grupo' },
  { id: 'comisionadoDeDistrito', nombre: 'Comisionado/a de distrito', ambito: 'distrito' },
  { id: 'jefeScoutDiocesano', nombre: 'Jefe/Jefa scout diocesano', ambito: 'diocesis' },
] as const satisfies readonly { id: string; nombre: string; ambito: AmbitoDeCargo }[]

export type TipoDeCargo = (typeof TIPOS_DE_CARGO)[number]['id']

/** El ambito de un cargo, que es lo que decide contra que entidad se valida y
 *  que se guarda en `ambito_id`. Un id que no este en el catalogo cae en
 *  'grupo': es el caso de un cargo viejo que quedo en los datos, y tratarlo
 *  como de grupo es lo que menos dano hace, porque no habilita ningun ambito
 *  nuevo. */
export function ambitoDelCargo(cargo: TipoDeCargo): AmbitoDeCargo {
  return TIPOS_DE_CARGO.find((candidato) => candidato.id === cargo)?.ambito ?? 'grupo'
}

export function nombreDelCargo(cargo: TipoDeCargo): string {
  return TIPOS_DE_CARGO.find((candidato) => candidato.id === cargo)?.nombre ?? cargo
}
