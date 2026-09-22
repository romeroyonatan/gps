import { usePersonasDelGrupo } from '@gps/api'
import type { ReactNode } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { Cargando, Falla, Vacio, Volver } from '../src/ui'

export type Persona = NonNullable<
  ReturnType<typeof usePersonasDelGrupo>['data']
>['personas'][number]

/** Lo que la persona es hoy. Se busca en la nómina del grupo y no se consulta
 *  de a una: la lista ya está en la caché cuando se viene de ahí, y una
 *  consulta por persona no traería ningún dato nuevo. Es lo mismo que hace la
 *  web en `apps/web/src/pantallas/Persona.tsx`. */
export function usePersona(grupoId: string, personaId: string) {
  const lista = usePersonasDelGrupo(grupoId)
  return {
    ...lista,
    persona: lista.data?.personas.find((persona) => persona.id === personaId),
  }
}

/** La cáscara de las tres pantallas de una persona: el mismo scroll, el mismo
 *  camino de vuelta, la misma carga y el mismo vacío. */
export function PantallaDePersona(props: {
  grupoId: string
  personaId: string
  volverA: string
  volverTexto: string
  children: (persona: Persona) => ReactNode
}) {
  const { persona, isPending, error } = usePersona(props.grupoId, props.personaId)

  return (
    <ScrollView
      className="flex-1 bg-surface"
      contentContainerClassName="px-4 pb-10"
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      <Volver href={props.volverA}>{props.volverTexto}</Volver>
      {isPending && <Cargando>Consultando la nómina…</Cargando>}
      {error && <Falla>No se pudo consultar la nómina: {error.message}</Falla>}
      {!isPending && !error && !persona && (
        <Vacio>No hay ninguna persona de este grupo con esa dirección.</Vacio>
      )}
      {persona && props.children(persona)}
    </ScrollView>
  )
}

/** Un dato con su nombre a la izquierda, en la fila de 56px de la guía. La
 *  gemela del `Dato` de web. */
export function Dato(props: { nombre: string; children: ReactNode; onPress?: () => void }) {
  // Subrayado sólo cuando se toca: sin eso nadie sabe que el número llama. Es
  // lo mismo que hace el enlace `tel:` de la web.
  const valor = (
    <Text
      className={`shrink text-right text-sm font-semibold text-ink ${props.onPress ? 'underline' : ''}`}
    >
      {props.children}
    </Text>
  )
  return (
    <View className="min-h-14 flex-row items-center justify-between gap-3 border-b border-line py-2">
      <Text className="text-sm text-ink-muted">{props.nombre}</Text>
      {/* Con `onPress` el valor se toca —el teléfono llama—, y sigue siendo la
          misma fila que en la web, no una acción aparte. */}
      {props.onPress ? (
        <Pressable accessibilityRole="button" onPress={props.onPress} className="shrink">
          {valor}
        </Pressable>
      ) : (
        valor
      )}
    </View>
  )
}
