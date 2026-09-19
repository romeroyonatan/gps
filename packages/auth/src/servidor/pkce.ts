import type { Core } from '@gps/core'

/** El `code_verifier` de PKCE (RFC 7636 §4.1): un secreto de alta entropía en
 *  el alfabeto sin reservados. Hex cumple ese alfabeto y cae dentro de los
 *  43-128 caracteres permitidos, así que `core.nuevoSecreto` alcanza sin
 *  necesitar un generador propio. */
export function nuevoVerificador(core: Core): string {
  return core.nuevoSecreto(32)
}

/** El `code_challenge` S256: base64url del SHA-256 del verificador (RFC 7636
 *  §4.2). `core.hash` da el mismo digest en hexadecimal -es la misma entrada,
 *  el mismo algoritmo-, así que alcanza con reempaquetar esos bytes en
 *  base64url en vez de pedirle a Core un método más para esto. */
export function desafioDe(core: Core, verificador: string): string {
  const hex = core.hash(verificador)
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++) bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return base64Url(bytes)
}

function base64Url(bytes: Uint8Array): string {
  let binario = ''
  for (const byte of bytes) binario += String.fromCharCode(byte)
  return btoa(binario).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}
