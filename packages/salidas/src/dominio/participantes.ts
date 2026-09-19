/** "1 dirigente" y no "1 dirigentes". Es lo primero que se ve mal, tanto en la
 *  pantalla como en el papel que despues alguien firma.
 *
 *  Vive en el dominio y no en cada lugar que cuenta gente por la misma razon
 *  que etiquetaDeEdades en estructura: es presentacion del dominio, y dos
 *  copias divergen sin que nadie se entere -que es justo lo que paso: el PDF lo
 *  decia bien y la pantalla no-. */
export function cuantos(cantidad: number, singular: string): string {
  return `${cantidad} ${singular}${cantidad === 1 ? '' : 's'}`
}

/** Cuantos van de cada tipo, ya escrito para mostrar: "1 dirigente, 4
 *  beneficiarios". */
export function resumenDeParticipantes(
  participantes: readonly { marca: 'dirigente' | 'beneficiario' }[],
): string {
  const dirigentes = participantes.filter((uno) => uno.marca === 'dirigente').length
  return `${cuantos(dirigentes, 'dirigente')}, ${cuantos(participantes.length - dirigentes, 'beneficiario')}`
}
