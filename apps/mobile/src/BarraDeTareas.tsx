import { router, usePathname } from 'expo-router'
import { Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { CARPA, CASA, GENTE, LISTA, MONEDA } from './iconos'
import { Icono } from './ui'

/** Las tareas del grupo, en el mismo orden que la web. Son cinco destinos
 *  fijos: el menú no cambia de tamaño según lo que se pueda hacer, porque una
 *  barra que se mueve obliga a leerla cada vez.
 *
 *  Tesorería apunta a la cuenta del grupo, que vive afuera de `/grupos`: la
 *  barra navega por dirección y no por pestaña de react-navigation, así que
 *  da lo mismo de qué carpeta cuelgue cada pantalla. */
const TAREAS = [
  { texto: 'Principal', a: (id: string) => `/grupos/${id}`, trazos: CASA },
  { texto: 'Padrón', a: (id: string) => `/grupos/${id}/padron`, trazos: LISTA },
  { texto: 'Salidas', a: (id: string) => `/grupos/${id}/salidas`, trazos: CARPA },
  { texto: 'Plantel', a: (id: string) => `/grupos/${id}/plantel`, trazos: GENTE },
  { texto: 'Tesorería', a: (id: string) => `/tesoreria/grupos/${id}`, trazos: MONEDA },
] as const

/** El menú de abajo: ahí llega el pulgar. Sólo aparece cuando el rol activo
 *  manda sobre un grupo —el resto de los roles no tiene estas cinco tareas—,
 *  que es la misma regla que aplica la web. */
export function BarraDeTareas(props: { grupoId: string }) {
  const donde = usePathname()
  const abajo = useSafeAreaInsets().bottom

  return (
    <View
      accessibilityRole="tablist"
      className="flex-row border-t border-line bg-surface"
      style={{ paddingBottom: abajo }}
    >
      {TAREAS.map((tarea) => {
        const href = tarea.a(props.grupoId)
        // "Principal" es la raíz del grupo, así que exacto: si no, quedaría
        // encendida en todas las demás, que cuelgan de ella.
        const activa = tarea.texto === 'Principal' ? donde === href : donde.startsWith(href)
        const tono = activa ? 'text-ink' : 'text-ink-faint'
        return (
          <Pressable
            key={tarea.texto}
            accessibilityRole="tab"
            accessibilityState={{ selected: activa }}
            onPress={() => router.navigate(href)}
            className="min-h-14 flex-1 items-center justify-center gap-0.5 py-1.5"
          >
            <Icono trazos={tarea.trazos} medida={22} className={tono} />
            <Text className={`text-xs ${activa ? 'font-semibold' : ''} ${tono}`}>
              {tarea.texto}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}
