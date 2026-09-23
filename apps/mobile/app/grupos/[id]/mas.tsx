import { useActor } from '@gps/api'
import { puedeAuditarGrupo } from '@gps/auditoria/dominio'
import { Link, useLocalSearchParams } from 'expo-router'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { Chevron, FILA, Titulo } from '../../../src/ui'

/** El quinto destino de la barra: lo que no entra en cuatro. Es una pantalla
 *  y no una hoja, igual que en la web. */
export default function Pantalla() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const actor = useActor()
  const entradas = [
    { texto: 'Plantel', detalle: 'Jefatura y Secretaría del grupo', href: `/grupos/${id}/plantel` },
    ...(actor && puedeAuditarGrupo(actor, id)
      ? [
          {
            texto: 'Auditoría',
            detalle: 'Quién cambió qué y cuándo',
            href: `/grupos/${id}/auditoria`,
          },
        ]
      : []),
  ]

  return (
    <ScrollView className="flex-1 bg-surface" contentContainerClassName="px-4 pb-10">
      <Titulo>Más</Titulo>
      <View className="mt-5">
        {entradas.map((entrada) => (
          <Link key={entrada.href} href={entrada.href} asChild>
            <Pressable accessibilityRole="link" className={`${FILA} active:bg-surface-3`}>
              <View className="min-w-0 flex-1">
                <Text className="text-base font-semibold text-ink">{entrada.texto}</Text>
                <Text className="text-label text-ink-muted">{entrada.detalle}</Text>
              </View>
              <Chevron />
            </Pressable>
          </Link>
        ))}
      </View>
    </ScrollView>
  )
}
