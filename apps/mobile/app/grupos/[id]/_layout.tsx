import { Tabs } from 'expo-router'
import type { ComponentProps } from 'react'
import { Pressable, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

/** Las tres pestañas son del grupo, no de la app: se entra a un grupo y se
 *  navega adentro. Plantel y afiliación cuelgan del mismo grupo pero no son
 *  pestañas —se llega desde el inicio—, así que se esconden de la barra. */
const PESTANAS = [
  { name: 'index', etiqueta: 'Inicio' },
  { name: 'padron', etiqueta: 'Padrón' },
  { name: 'salidas', etiqueta: 'Salidas' },
] as const

type PropsDeLaBarra = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0]

/** La barra de abajo, a mano y no con las opciones de react-navigation: así
 *  los colores salen de los tokens y no de un hex suelto.
 *
 *  Sin íconos: no hay ninguna librería instalada y no se agrega una por esto.
 *  La etiqueta sola alcanza con tres pestañas. */
function BarraDePestanas(props: PropsDeLaBarra) {
  const actual = props.state.routes[props.state.index]?.name
  return (
    <View className="min-h-14 flex-row border-t border-line bg-surface">
      {PESTANAS.map((pestana) => {
        const activa = pestana.name === actual
        return (
          <Pressable
            key={pestana.name}
            accessibilityRole="button"
            accessibilityState={{ selected: activa }}
            onPress={() => props.navigation.navigate(pestana.name)}
            className="min-h-14 flex-1 items-center justify-center"
          >
            <Text
              className={`text-xs ${activa ? 'font-semibold text-ink' : 'text-ink-faint'}`}
              style={{ fontSize: 11 }}
            >
              {pestana.etiqueta}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

export default function Layout() {
  return (
    // El margen de arriba lo pone la cáscara del grupo y no cada pantalla: las
    // tres comparten la barra de sesión.
    <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
      <Tabs
        screenOptions={{ headerShown: false }}
        tabBar={(props) => <BarraDePestanas {...props} />}
      >
        <Tabs.Screen name="plantel" options={{ href: null }} />
        <Tabs.Screen name="afiliacion" options={{ href: null }} />
      </Tabs>
    </SafeAreaView>
  )
}
