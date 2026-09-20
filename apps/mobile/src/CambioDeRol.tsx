import { useDistritos } from '@gps/api'
import type { Actor, RolConAmbito } from '@gps/core'
import { claveDelRol, nombreDelRol, rolesParaElegir } from '@gps/personas/dominio'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { router } from 'expo-router'
import { createContext, type ReactNode, useContext, useEffect, useState } from 'react'
import { Modal, Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native'

type Funcion = RolConAmbito

/** A dónde entra cada rol. Cambiar de rol vuelve a este inicio y no intenta
 *  traducir la pantalla actual: la bandeja del comisionado no tiene
 *  equivalente en tesorería.
 *
 *  Las cuatro líneas están duplicadas de la web a propósito: son las rutas que
 *  sirve cada app, y da la casualidad de que tienen la misma forma. Si alguna
 *  vez dejan de tenerla, esto se entera acá y no rompe allá. */
export function inicioDelRol(funcion: Funcion): string {
  if (funcion.ambito.tipo === 'grupo' && funcion.ambito.id) return `/grupos/${funcion.ambito.id}`
  if (funcion.rol === 'tesoreriaDiocesana') return '/tesoreria'
  return '/'
}

/** El rol activo se recuerda mientras dure la sesión: se vuelve a la pantalla
 *  donde se dejó sin volver a elegir. Va en AsyncStorage y no en el servidor
 *  porque es una preferencia de este dispositivo, no un hecho de la persona
 *  —y la autorización no depende de ella: el servidor sigue mirando todas las
 *  funciones vigentes—. Por lo mismo no va al llavero: no es una credencial.
 *
 *  Cerrar sesión lo olvida: entrar de nuevo es empezar de nuevo, y en un
 *  teléfono prestado heredar el rol de quien salió es lo contrario de lo que
 *  se pidió al salir. */
function clavePersistida(personaId: string) {
  return `gps.rol:${personaId}`
}

/** Lo llama la salida: sin esto, volver a entrar reabre el último rol en vez
 *  de preguntar. */
export async function olvidarRolActivo(personaId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(clavePersistida(personaId))
  } catch {
    // Almacenamiento bloqueado: no había nada que olvidar.
  }
}

export function useRolActivo(actor: Actor) {
  const roles = rolesParaElegir(actor)
  // `undefined` es "todavía no se leyó el disco", que no es lo mismo que "no
  // eligió nada": sin la distinción, la hoja de roles parpadea en cada arranque
  // aunque ya haya una elección guardada.
  const [elegida, setElegida] = useState<string | null | undefined>(undefined)

  useEffect(() => {
    let vigente = true
    AsyncStorage.getItem(clavePersistida(actor.personaId))
      .catch(() => null)
      .then((guardado) => {
        if (vigente) setElegida(guardado)
      })
    return () => {
      vigente = false
    }
  }, [actor.personaId])

  const guardado = roles.find((funcion) => claveDelRol(funcion) === elegida) ?? null
  // Si lo guardado ya no corresponde -le revocaron el cargo- se cae al primero
  // en vez de dejar la pantalla sin rol.
  const activo = guardado ?? roles[0] ?? null

  return {
    roles,
    activo,
    leyendo: elegida === undefined,
    /** Si ya hay una decisión, propia o porque no había nada que decidir. Con
     *  una sola función no se pregunta: se entra con ésa. */
    elegido: guardado !== null || roles.length <= 1,
    elegir(funcion: Funcion) {
      const clave = claveDelRol(funcion)
      setElegida(clave)
      AsyncStorage.setItem(clavePersistida(actor.personaId), clave).catch(() => {
        // El rol vale igual para esta sesión, sólo no se recuerda para la
        // próxima.
      })
    },
  }
}

type RolActivo = ReturnType<typeof useRolActivo>

/** El rol activo lo lee una sola vez la cáscara y lo comparten las pantallas:
 *  dos `useRolActivo` serían dos estados que se pisan al cambiar de rol. */
const Contexto = createContext<RolActivo | null>(null)

export function ProveedorDeRol(props: { rol: RolActivo; children: ReactNode }) {
  return <Contexto.Provider value={props.rol}>{props.children}</Contexto.Provider>
}

export function useRol(): RolActivo | null {
  return useContext(Contexto)
}

/** El nombre de la entidad sobre la que manda un rol. Sale del directorio de
 *  la asociación, que ve cualquiera con sesión. */
export function useNombreDelAmbito() {
  const { data } = useDistritos()
  const distritos = data?.distritos ?? []

  return (funcion: Funcion): string => {
    if (funcion.ambito.tipo === 'diocesis') return 'Toda la diócesis'
    if (funcion.ambito.tipo === 'distrito') {
      const distrito = distritos.find((uno) => uno.id === funcion.ambito.id)
      return distrito ? `Distrito ${distrito.numero} · ${distrito.zona}` : 'Su distrito'
    }
    for (const distrito of distritos) {
      const grupo = distrito.grupos.find((uno) => uno.id === funcion.ambito.id)
      if (grupo) return `Grupo Nº${grupo.numero} · ${grupo.nombre}`
    }
    return 'Su grupo'
  }
}

/** Una función de la lista: el nombre del rol y, abajo, sobre qué manda. */
function FilaDeRol(props: {
  funcion: Funcion
  ambito: string
  activa?: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={props.onPress}
      className={`min-h-16 flex-row items-center gap-3 border-b border-line px-4 py-3 ${
        props.activa ? 'bg-surface-3' : ''
      }`}
    >
      <View className="min-w-0 flex-1">
        <Text className="text-base font-semibold text-ink">{nombreDelRol(props.funcion.rol)}</Text>
        <Text className="text-label text-ink-muted">{props.ambito}</Text>
      </View>
      <Text className="text-ink-faint">{props.activa ? '✓' : '›'}</Text>
    </Pressable>
  )
}

/** Con qué rol entra quien tiene más de uno.
 *
 *  Va antes de la app y no en un menú escondido: el rol define qué app se ve,
 *  así que preguntarlo después de dibujar una app sería dibujar la equivocada.
 *  Quien tiene una sola función nunca llega acá —entra directo con ésa—, que es
 *  la otra mitad de la misma regla. */
export function ElegirRol(props: {
  nombre: string | null
  roles: readonly Funcion[]
  ambitoDe: (funcion: Funcion) => string
  elegir: (funcion: Funcion) => void
}) {
  return (
    <SafeAreaView className="flex-1 bg-surface">
      <ScrollView contentContainerClassName="px-6 py-10">
        <Text className="text-3xl font-bold text-ink">GPS</Text>
        <View className="mt-6 overflow-hidden rounded-lg border border-line-strong">
          <View className="border-b border-line px-4 py-3.5">
            <Text className="text-lg font-semibold text-ink">
              {props.nombre ? `Hola, ${props.nombre}` : 'Hola'}
            </Text>
            <Text className="mt-0.5 text-sm text-ink-muted">
              Tenés {props.roles.length} roles. ¿Con cuál entrás?
            </Text>
          </View>
          {props.roles.map((funcion) => (
            <FilaDeRol
              key={claveDelRol(funcion)}
              funcion={funcion}
              ambito={props.ambitoDe(funcion)}
              onPress={() => props.elegir(funcion)}
            />
          ))}
          <Text className="px-4 py-3 text-label text-ink-faint">
            Se puede cambiar después desde la barra de arriba.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

/** El conmutador, en la barra de sesión. Con una sola función no hay control:
 *  se muestra el ámbito y nada más. No se ofrece un menú de una sola opción. */
export function CambioDeRol(props: {
  roles: readonly Funcion[]
  activo: Funcion
  elegir: (funcion: Funcion) => void
}) {
  const nombreDelAmbito = useNombreDelAmbito()
  const [abierta, abrir] = useState(false)

  if (props.roles.length === 1) {
    return (
      <Text className="flex-1 text-sm text-ink-muted" numberOfLines={1}>
        {nombreDelAmbito(props.activo)}
      </Text>
    )
  }

  return (
    <>
      <Pressable
        onPress={() => abrir(true)}
        className="min-h-9 flex-1 flex-row items-center gap-1.5 self-start rounded-full border border-line-strong px-2.5"
      >
        <Text className="flex-1 text-sm font-semibold text-ink" numberOfLines={1}>
          {nombreDelRol(props.activo.rol)}
        </Text>
        <Text className="text-xs text-ink-muted">▼</Text>
      </Pressable>

      <Modal visible={abierta} animationType="slide" onRequestClose={() => abrir(false)}>
        <SafeAreaView className="flex-1 bg-surface">
          <View className="flex-row items-center justify-between px-4 py-3">
            <Text className="text-label text-ink-muted">Entrar como</Text>
            <Pressable onPress={() => abrir(false)} className="min-h-12 justify-center px-2">
              <Text className="text-sm text-ink-muted">Cerrar</Text>
            </Pressable>
          </View>
          <ScrollView>
            {props.roles.map((funcion) => (
              <FilaDeRol
                key={claveDelRol(funcion)}
                funcion={funcion}
                ambito={nombreDelAmbito(funcion)}
                activa={claveDelRol(funcion) === claveDelRol(props.activo)}
                onPress={() => {
                  props.elegir(funcion)
                  abrir(false)
                  router.replace(inicioDelRol(funcion))
                }}
              />
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
  )
}
