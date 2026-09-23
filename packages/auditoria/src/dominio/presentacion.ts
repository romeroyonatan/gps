/** Los módulos que escriben en la auditoría, con el nombre que se muestra. Es
 *  la lista del filtro por módulo: son pocos y no cambian con los datos. */
export const MODULOS_AUDITADOS = [
  { id: 'auth', etiqueta: 'Acceso' },
  { id: 'personas', etiqueta: 'Personas' },
  { id: 'afiliacion', etiqueta: 'Afiliación' },
  { id: 'tesoreria', etiqueta: 'Tesorería' },
  { id: 'archivos', etiqueta: 'Archivos' },
  { id: 'salidas', etiqueta: 'Salidas' },
] as const

export function etiquetaDeModulo(modulo: string): string {
  return MODULOS_AUDITADOS.find((uno) => uno.id === modulo)?.etiqueta ?? modulo
}

/** La acción guardada es un nombre de código (`crearPermiso`,
 *  `cargo.jefeDeGrupo.asignar`); la pantalla la escribe en palabras sin
 *  perder el orden, así el mismo nombre se reconoce en el filtro y en la fila. */
export function etiquetaDeAccion(accion: string): string {
  const texto = accion
    .split('.')
    .map((parte) => parte.replace(/([a-zá-ú])([A-Z])/g, '$1 $2').toLowerCase())
    .join(' · ')
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

/** Quién hizo algo, dicho para una persona: el nombre si lo hay, el origen si
 *  fue el sistema, y nunca una persona inventada. */
export function quienActuo(evento: {
  readonly actorNombre?: string | null
  readonly origenInterno?: string | null
}): string {
  if (evento.actorNombre) return evento.actorNombre
  return evento.origenInterno ? `Sistema · ${evento.origenInterno}` : 'Sin identificar'
}

/** Un día `aaaa-mm-dd` como límite de la consulta, en la hora local de quien
 *  mira: "hasta el 3" incluye todo el 3. Un día mal escrito no filtra. */
export function limiteDelDia(dia: string, fin: boolean): string | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) return undefined
  const instante = new Date(`${dia}T${fin ? '23:59:59.999' : '00:00:00'}`)
  return Number.isNaN(instante.getTime()) ? undefined : instante.toISOString()
}

/** Las opciones de un filtro que sólo se conocen mirando los eventos —quién
 *  actuó, qué acción—: las de lo ya cargado más la elegida, para que elegirla
 *  no la haga desaparecer de la lista. */
export function opcionesDelFiltro<T>(
  eventos: readonly T[],
  clave: (evento: T) => readonly [string, string] | null,
  elegida: string,
): { id: string; etiqueta: string }[] {
  const mapa = new Map<string, string>()
  for (const evento of eventos) {
    const par = clave(evento)
    if (par) mapa.set(par[0], par[1])
  }
  if (elegida && !mapa.has(elegida)) mapa.set(elegida, elegida)
  return [...mapa]
    .map(([id, etiqueta]) => ({ id, etiqueta }))
    .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta))
}
