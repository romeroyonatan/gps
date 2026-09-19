import { useCerrarSesion, usePersonaActual } from '@gps/api'
import { Pressable, Text, View } from 'react-native'
import { olvidarSesion } from './sesion'

/** Las funciones vigentes de quien está adentro, y la salida.
 *
 *  Cerrar sesión son dos cosas: revocarla en el servidor -así el secreto no
 *  sirve aunque alguien lo haya copiado- y borrarlo del llavero. Si sólo se
 *  borrara del teléfono, la sesión seguiría abierta del otro lado. */
export function BarraDeSesion() {
  const sesion = usePersonaActual()
  const cerrar = useCerrarSesion()
  const quien = sesion.data?.personaActual
  if (!quien) return null

  const funciones = [...new Set(quien.roles.map((funcion) => funcion.rol))]

  return (
    <View className="mt-4 flex-row flex-wrap items-center gap-2 border-b border-slate-200 pb-4">
      {funciones.map((funcion) => (
        <View key={funcion} className="rounded-full bg-slate-100 px-2.5 py-1">
          <Text className="text-xs text-slate-700">{funcion}</Text>
        </View>
      ))}
      <Pressable
        className="ml-auto"
        disabled={cerrar.isPending}
        onPress={() => {
          cerrar.mutate(undefined, { onSuccess: () => olvidarSesion() })
        }}
      >
        <Text className="text-xs font-medium text-slate-500">Cerrar sesión</Text>
      </Pressable>
    </View>
  )
}
