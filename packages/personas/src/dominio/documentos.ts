/** Los tipos de documento que la asociacion acepta. Es un conjunto cerrado, por
 *  eso es una constante y no una tabla: no hay siembra ni migracion que
 *  mantener, y al vivir en /dominio la comparten el servidor y las pantallas
 *  sin una tabla de traduccion en el medio.
 *
 *  Dos y no cinco: Libreta Civica y Libreta de Enrolamiento solo las tiene quien
 *  nacio antes de 1969, y la cedula aparece en zona de frontera. Ninguna tiene
 *  hoy una persona real detras.
 *
 *  Agregar un tipo es cambio solo de codigo. Sacar o renombrar uno NO lo es: la
 *  tabla personas sigue guardando el id viejo. Hay que migrar los datos en la
 *  misma entrega. */
export const TIPOS_DE_DOCUMENTO = [
  { id: 'dni', nombre: 'DNI' },
  { id: 'pasaporte', nombre: 'Pasaporte' },
] as const

export type TipoDeDocumento = (typeof TIPOS_DE_DOCUMENTO)[number]['id']

/** Como la pantalla nombra el tipo. Vive en el dominio y no en cada pantalla por
 *  la misma razon que etiquetaDeEdades en estructura: es presentacion del
 *  dominio, y dos copias divergen sin que nadie se entere. */
export function nombreDelTipo(tipo: TipoDeDocumento): string {
  return TIPOS_DE_DOCUMENTO.find((candidato) => candidato.id === tipo)?.nombre ?? tipo
}

/** Saca puntos, espacios y guiones, y pasa a mayusculas. Se aplica al guardar,
 *  nunca al leer.
 *
 *  No es cosmetica: es lo que hace que el UNIQUE de (tipo, numero) signifique
 *  algo. Sin esto "30.111.222" y "30111222" entran como dos personas distintas
 *  y el indice no se entera, que es justo el caso que existe para impedir:
 *  quien carga la segunda es alguien que no encontro a la primera al buscarla
 *  escrita de la otra forma. */
export function normalizarNumero(numero: string): string {
  return numero.replace(/[\s.-]/g, '').toUpperCase()
}
