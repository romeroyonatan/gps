import { crearQueryClient, ProveedorDeApi, transporteHttp } from '@gps/api'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import Constants from 'expo-constants'
import { Stack } from 'expo-router'
import '../global.css'

const urlDeLaApi =
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ??
  process.env.EXPO_PUBLIC_API_URL ??
  'http://localhost:3000/graphql'

const persister = createAsyncStoragePersister({ storage: AsyncStorage, key: 'gps-cache' })

export default function Layout() {
  return (
    <ProveedorDeApi
      transporte={transporteHttp(urlDeLaApi)}
      queryClient={crearQueryClient()}
      persister={persister}
    >
      <Stack screenOptions={{ headerShown: false }} />
    </ProveedorDeApi>
  )
}
