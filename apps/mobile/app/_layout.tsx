import {
  almacenPorPersona,
  crearQueryClient,
  ProveedorDeApi,
  transporteHttp,
  useParticionDelCache,
  usePersonaActual,
  useVersion,
} from '@gps/api'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import Constants from 'expo-constants'
import { Stack } from 'expo-router'
import { Text, View } from 'react-native'
import { Ingreso } from '../src/Ingreso'
import { secretoDeSesion } from '../src/sesion'
import '../global.css'

const urlDeLaApi =
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ??
  process.env.EXPO_PUBLIC_API_URL ??
  'http://localhost:3000/graphql'

// Partido por persona, igual que en la web: ver almacenPorPersona. La sesión
// en sí no vive acá -va a expo-secure-store-, sólo los datos que ya se vieron.
const particion = almacenPorPersona(AsyncStorage)

const persister = createAsyncStoragePersister({ storage: particion.almacen, key: 'gps-cache' })

/** El origen del backend, para armar las URL que no son GraphQL: el login y
 *  las descargas. Sale de la misma URL de la API. */
const origen = new URL(urlDeLaApi).origin

/** El transporte manda el secreto como bearer: en mobile no hay cookie, y el
 *  secreto vive en el llavero del sistema (ver src/sesion.ts). */
const transporte = transporteHttp(urlDeLaApi, fetch, secretoDeSesion)

/** Adentro del proveedor porque necesita el QueryClient y la sesión: hasta que
 *  no se sabe quién es, no se dibuja ni el login ni la app. */
function Adentro() {
  useParticionDelCache(particion)
  const version = useVersion()
  const sesion = usePersonaActual()

  if (sesion.isPending) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <Text className="text-sm text-ink-muted">Un momento…</Text>
      </View>
    )
  }

  if (!sesion.data?.personaActual) {
    return <Ingreso origen={origen} entorno={version.data?.version.entorno ?? ''} />
  }

  return <Stack screenOptions={{ headerShown: false }} />
}

export default function Layout() {
  return (
    <ProveedorDeApi transporte={transporte} queryClient={crearQueryClient()} persister={persister}>
      <Adentro />
    </ProveedorDeApi>
  )
}
