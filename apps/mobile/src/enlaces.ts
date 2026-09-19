/** Las URL del backend que no son GraphQL. Sin imports de React Native ni de
 *  Expo a propósito: es la parte que se puede probar sin simulador. */

/** La URL que abre el navegador del sistema para entrar. `plataforma` le dice
 *  al backend que la sesión vuelve por deep link y no en una cookie, y
 *  `perfil` sólo existe para el proveedor demo. */
export function urlDeIngreso(
  origen: string,
  proveedor: string,
  plataforma: 'ios' | 'android',
  perfil?: string,
): string {
  const extra = perfil ? `&perfil=${encodeURIComponent(perfil)}` : ''
  return `${origen}/auth/${encodeURIComponent(proveedor)}/iniciar?plataforma=${plataforma}${extra}`
}
