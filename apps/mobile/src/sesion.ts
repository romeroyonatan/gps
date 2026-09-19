import * as Linking from 'expo-linking'
import * as SecureStore from 'expo-secure-store'
import * as WebBrowser from 'expo-web-browser'
import { Platform } from 'react-native'
import { urlDeIngreso } from './enlaces'

/** Dónde vive el secreto de la sesión en el teléfono.
 *
 *  `expo-secure-store` y nunca `AsyncStorage`: el primero lo guarda en el
 *  llavero del sistema -Keychain en iOS, Keystore en Android-, el segundo en
 *  un archivo plano que cualquier backup o dispositivo rooteado lee. El cache
 *  de datos sí va a AsyncStorage: son datos que esta persona ya vio, no una
 *  credencial que abre la cuenta. */
const CLAVE = 'gps.sesion'

/** A dónde vuelve el navegador del sistema. Coincide con el `scheme` de
 *  app.json y con el deep link que arma el callback del backend. */
const VUELTA = 'gps://sesion'

// `undefined` es "todavía no se leyó el llavero", que no es lo mismo que
// "no hay sesión": sin esta distinción el primer pedido saldría anónimo.
let enMemoria: string | null | undefined

export async function secretoDeSesion(): Promise<string | null> {
  if (enMemoria === undefined) enMemoria = await SecureStore.getItemAsync(CLAVE)
  return enMemoria
}

/** El login en mobile es el navegador del sistema, no un WebView propio:
 *  Google lo exige -un WebView no comparte la sesión del navegador y es
 *  indistinguible de uno que roba la contraseña- y de paso la persona ve la
 *  barra de direcciones del proveedor.
 *
 *  Devuelve el secreto si entró, o null si canceló. Cancelar no es un error:
 *  es cerrar la pestaña. */
export async function ingresar(
  origen: string,
  proveedor: string,
  perfil?: string,
): Promise<string | null> {
  const plataforma = Platform.OS === 'android' ? 'android' : 'ios'
  const resultado = await WebBrowser.openAuthSessionAsync(
    urlDeIngreso(origen, proveedor, plataforma, perfil),
    VUELTA,
  )
  if (resultado.type !== 'success') return null

  // `Linking.parse` y no `new URL`: el polyfill de URL de React Native no
  // trae searchParams completo.
  const secreto = Linking.parse(resultado.url).queryParams?.secreto
  if (typeof secreto !== 'string' || secreto === '') return null

  await SecureStore.setItemAsync(CLAVE, secreto)
  enMemoria = secreto
  return secreto
}

/** Borra el secreto del llavero. Quien llama además tiene que revocar la
 *  sesión en el servidor: borrar el teléfono no la cierra del otro lado. */
export async function olvidarSesion(): Promise<void> {
  await SecureStore.deleteItemAsync(CLAVE)
  enMemoria = null
}
