import {
  almacenPorPersona,
  crearQueryClient,
  ProveedorDeApi,
  transporteHttp,
  useParticionDelCache,
} from '@gps/api'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import Constants from 'expo-constants'
import { Stack } from 'expo-router'
import '../global.css'

const urlDeLaApi =
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ??
  process.env.EXPO_PUBLIC_API_URL ??
  'http://localhost:3000/graphql'

// Partido por persona, igual que en la web: ver almacenPorPersona. La sesión
// en sí no vive acá -va a expo-secure-store-, sólo los datos que ya se vieron.
const particion = almacenPorPersona(AsyncStorage)

const persister = createAsyncStoragePersister({ storage: particion.almacen, key: 'gps-cache' })

/** Adentro del proveedor porque necesita el QueryClient y la sesión. */
function ParticionDelCache() {
  useParticionDelCache(particion)
  return null
}

export default function Layout() {
  return (
    <ProveedorDeApi
      transporte={transporteHttp(urlDeLaApi)}
      queryClient={crearQueryClient()}
      persister={persister}
    >
      <ParticionDelCache />
      <Stack screenOptions={{ headerShown: false }} />
    </ProveedorDeApi>
  )
}
