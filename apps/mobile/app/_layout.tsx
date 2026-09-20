import {
  almacenPorPersona,
  crearQueryClient,
  ProveedorDeApi,
  transporteHttp,
  useActor,
  useParticionDelCache,
  usePersonaActual,
  useVersion,
} from '@gps/api'
import type { Actor } from '@gps/core'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import Constants from 'expo-constants'
import { router, Stack, usePathname } from 'expo-router'
import { useEffect, useRef } from 'react'
import { Text, View } from 'react-native'
import {
  ElegirRol,
  inicioDelRol,
  ProveedorDeRol,
  useNombreDelAmbito,
  useRolActivo,
} from '../src/CambioDeRol'
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

function Espera(props: { children: string }) {
  return (
    <View className="flex-1 items-center justify-center bg-surface px-6">
      <Text className="text-sm text-ink-muted">{props.children}</Text>
    </View>
  )
}

/** Lo que hay adentro de una sesión: primero con qué rol se entra, después la
 *  app. Es un componente aparte y no un `if` en Adentro porque `useRolActivo`
 *  guarda la elección por persona, y un hook no puede esperar a que se sepa
 *  quién es: hasta que hay actor, esto no se monta. Salir lo desmonta, que es
 *  lo que limpia el rol de la sesión anterior. */
function ConSesion(props: { actor: Actor; nombre: string | null }) {
  const rol = useRolActivo(props.actor)
  const nombreDelAmbito = useNombreDelAmbito()
  const donde = usePathname()

  // Entrar cae en el inicio del rol activo, tenga uno solo o varios: la
  // jefatura de un grupo entra a su grupo, no al directorio de la diócesis.
  // Una sola vez, y sólo desde la portada: un enlace profundo compartido gana.
  const yaAterrizo = useRef(false)
  const activo = rol.activo
  const listo = rol.elegido && activo !== null
  useEffect(() => {
    if (yaAterrizo.current || !listo || !activo) return
    yaAterrizo.current = true
    const inicio = inicioDelRol(activo)
    if (donde === '/' && inicio !== '/') router.replace(inicio)
  }, [listo, activo, donde])

  if (rol.leyendo) return <Espera>Un momento…</Espera>
  if (!rol.activo) return <Espera>No tenés ninguna función vigente.</Espera>

  // Elegir rol todavía es entrar: la sesión existe pero la app no se dibujó.
  // Se pregunta antes y no después porque el rol define qué app se ve, y
  // dibujar una para cambiarla en el toque siguiente es dibujar la equivocada.
  if (!rol.elegido) {
    return (
      <ElegirRol
        nombre={props.nombre}
        roles={rol.roles}
        ambitoDe={nombreDelAmbito}
        elegir={rol.elegir}
      />
    )
  }

  return (
    <ProveedorDeRol rol={rol}>
      <Stack screenOptions={{ headerShown: false }} />
    </ProveedorDeRol>
  )
}

/** Adentro del proveedor porque necesita el QueryClient y la sesión: hasta que
 *  no se sabe quién es, no se dibuja ni el login ni la app. */
function Adentro() {
  useParticionDelCache(particion)
  const version = useVersion()
  const sesion = usePersonaActual()
  const actor = useActor()

  if (sesion.isPending) return <Espera>Un momento…</Espera>

  const quien = sesion.data?.personaActual
  if (!quien || !actor) {
    return <Ingreso origen={origen} entorno={version.data?.version.entorno ?? ''} />
  }

  return <ConSesion actor={actor} nombre={quien.nombres ?? null} />
}

export default function Layout() {
  return (
    <ProveedorDeApi transporte={transporte} queryClient={crearQueryClient()} persister={persister}>
      <Adentro />
    </ProveedorDeApi>
  )
}
