import { useCerrarSesion, usePersonaActual } from '@gps/api'
import { Pressable, Text, View } from 'react-native'
import { CambioDeRol, olvidarRolActivo, useRol } from './CambioDeRol'
import { olvidarSesion } from './sesion'

/** La barra de arriba: con qué rol se está mirando, y la salida.
 *
 *  La salida vive acá y no en la hoja de roles porque quien tiene un solo rol
 *  no tiene hoja, y sin esto no tendría por dónde salir.
 *
 *  Cerrar sesión son tres cosas: revocarla en el servidor -así el secreto no
 *  sirve aunque alguien lo haya copiado-, borrarlo del llavero y olvidar el
 *  rol elegido. Si sólo se borrara del teléfono, la sesión seguiría abierta
 *  del otro lado. */
export function BarraDeSesion() {
  const sesion = usePersonaActual()
  const cerrar = useCerrarSesion()
  const rol = useRol()
  const quien = sesion.data?.personaActual
  if (!quien || !rol?.activo) return null

  return (
    <View className="h-11 flex-row items-center gap-2.5 border-b border-line">
      <Text className="text-base font-extrabold tracking-tight text-ink">GPS</Text>
      <CambioDeRol roles={rol.roles} activo={rol.activo} elegir={rol.elegir} />
      <Pressable
        className="min-h-9 justify-center"
        disabled={cerrar.isPending}
        onPress={() => {
          // El rol elegido se olvida al salir y no al entrar: es la decisión de
          // esta sesión, y la siguiente vuelve a preguntar.
          void olvidarRolActivo(quien.personaId)
          cerrar.mutate(undefined, { onSuccess: () => olvidarSesion() })
        }}
      >
        <Text className="text-xs font-medium text-ink-muted">Salir</Text>
      </Pressable>
    </View>
  )
}
