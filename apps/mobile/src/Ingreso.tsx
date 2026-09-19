import { useRefrescarSesion } from '@gps/api'
import { useState } from 'react'
import { Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native'
import { ingresar } from './sesion'

/** Los mismos perfiles que siembra el escenario demo. Sólo se muestran en ese
 *  entorno; afuera la ruta del proveedor no existe. */
const PERFILES_DEMO = [
  { subject: 'jefatura', nombre: 'Jefatura de grupo' },
  { subject: 'secretaria', nombre: 'Secretaría' },
  { subject: 'tesoreria', nombre: 'Tesorería diocesana' },
  { subject: 'comisionado', nombre: 'Comisionado de distrito' },
  { subject: 'administrador', nombre: 'Administración' },
] as const

function Boton(props: { onPress: () => void; disabled: boolean; children: React.ReactNode }) {
  return (
    <Pressable
      onPress={props.onPress}
      disabled={props.disabled}
      className="rounded-lg border border-slate-300 bg-white px-4 py-3"
    >
      <Text className="text-center text-sm font-medium text-slate-900">{props.children}</Text>
    </Pressable>
  )
}

export function Ingreso(props: { origen: string; entorno: string }) {
  const refrescar = useRefrescarSesion()
  const [entrando, setEntrando] = useState(false)
  const [cancelado, setCancelado] = useState(false)

  const entrar = async (proveedor: string, perfil?: string) => {
    setEntrando(true)
    setCancelado(false)
    try {
      const secreto = await ingresar(props.origen, proveedor, perfil)
      if (!secreto) {
        setCancelado(true)
        return
      }
      // El transporte lee el secreto nuevo en el próximo pedido; lo que falta
      // es volver a preguntar quién es.
      await refrescar()
    } finally {
      setEntrando(false)
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <ScrollView contentContainerClassName="px-4 py-10">
        <Text className="text-2xl font-semibold text-slate-900">GPS</Text>
        <Text className="mt-1 text-sm text-slate-500">
          GPS no tiene contraseña propia: entrás con la cuenta que ya usás.
        </Text>

        <View className="mt-6 gap-2">
          <Boton onPress={() => entrar('google')} disabled={entrando}>
            Continuar con Google
          </Boton>
          <Boton onPress={() => entrar('apple')} disabled={entrando}>
            Continuar con Apple
          </Boton>
        </View>

        {props.entorno === 'demo' && (
          <View className="mt-8 gap-2">
            <Text className="text-sm font-medium text-slate-900">Perfiles de demostración</Text>
            {PERFILES_DEMO.map((perfil) => (
              <Boton
                key={perfil.subject}
                onPress={() => entrar('demo', perfil.subject)}
                disabled={entrando}
              >
                {perfil.nombre}
              </Boton>
            ))}
          </View>
        )}

        {cancelado && (
          <Text className="mt-6 text-sm text-slate-500">
            Cerraste el navegador antes de terminar. Podés intentar de nuevo.
          </Text>
        )}

        <Text className="mt-8 text-xs text-slate-400">
          Si todavía no tenés acceso, pedile el enlace de activación a la jefatura o a la Secretaría
          de tu grupo.
        </Text>
      </ScrollView>
    </SafeAreaView>
  )
}
