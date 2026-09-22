import { useRefrescarSesion } from '@gps/api'
import { useState } from 'react'
import { Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native'
import { ingresar } from './sesion'

/** Los mismos perfiles que siembra el escenario demo, con la misma bajada que
 *  la web: cada uno abre una sesión de verdad, con lo que le dan sus cargos y
 *  equipos. Sólo se muestran en ese entorno; afuera la ruta del proveedor no
 *  existe. */
const PERFILES_DEMO = [
  { subject: 'jefatura', nombre: 'Jefatura de grupo', que: 'Administra su grupo y lee su cuenta' },
  { subject: 'secretaria', nombre: 'Secretaría', que: 'Lo mismo, desde el equipo del grupo' },
  { subject: 'tesoreria', nombre: 'Tesorería diocesana', que: 'La única que registra pagos' },
  {
    subject: 'comisionado',
    nombre: 'Comisionado de distrito',
    que: 'Firma los permisos de su distrito, no ve los grupos por dentro',
  },
  {
    subject: 'administrador',
    nombre: 'Administración',
    que: 'Entra sin alcance global: tiene que elevarse',
  },
] as const

/** La marca del proveedor es una letra en un cuadrado, no un logo: no se
 *  recibió el material de marca de Apple ni de Google y dibujarlo a mano sería
 *  inventarlo. Se reemplaza cuando lleguen los SVG oficiales. */
function Inicial(props: { letra: string; sobreAcento?: boolean }) {
  return (
    <View
      className={`h-5 w-5 items-center justify-center rounded-full ${
        props.sobreAcento ? 'bg-ink-muted' : 'bg-surface-3'
      }`}
    >
      <Text
        className={`text-label font-bold ${props.sobreAcento ? 'text-accent-ink' : 'text-ink-muted'}`}
      >
        {props.letra}
      </Text>
    </View>
  )
}

/** El botón de proveedor: 56px de alto, el objetivo táctil holgado que pide la
 *  guía para el teléfono. Apple va sólido porque es el primero. */
function Proveedor(props: {
  onPress: () => void
  disabled: boolean
  letra: string
  solido?: boolean
  children: string
}) {
  return (
    <Pressable
      onPress={props.onPress}
      disabled={props.disabled}
      className={`min-h-14 w-full flex-row items-center justify-center gap-2.5 rounded-lg ${
        props.solido ? 'bg-accent' : 'border border-line-strong'
      } ${props.disabled ? 'opacity-50' : ''}`}
    >
      <Inicial letra={props.letra} sobreAcento={props.solido} />
      <Text className={`text-base font-semibold ${props.solido ? 'text-accent-ink' : 'text-ink'}`}>
        {props.children}
      </Text>
    </Pressable>
  )
}

/** La puerta. A 375px es blanca entera: la mitad oscura de la web es una
 *  decisión de escritorio, y acá no hay escritorio. */
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
    <SafeAreaView className="flex-1 bg-surface">
      <ScrollView contentContainerClassName="gap-3 px-6 py-10">
        <Text className="text-3xl font-bold text-ink">GPS</Text>
        <Text className="text-2xl font-bold text-ink">Entrar</Text>

        {/* Apple primero: lo exige la App Store cuando hay ingreso social. */}
        <View className="mt-2 gap-3">
          <Proveedor onPress={() => entrar('apple')} disabled={entrando} letra="A" solido>
            Continuar con Apple
          </Proveedor>
          <Proveedor onPress={() => entrar('google')} disabled={entrando} letra="G">
            Continuar con Google
          </Proveedor>
          {props.entorno === 'demo' && (
            <Proveedor onPress={() => entrar('demo', 'demo')} disabled={entrando} letra="D">
              Iniciar sesión demo
            </Proveedor>
          )}
        </View>

        {props.entorno === 'demo' && (
          <View className="mt-4">
            <Text className="text-label font-medium text-ink-muted">Una función por vez</Text>
            <Text className="mt-1 text-xs text-ink-faint">
              Para mirar una historia de permisos sola, sin las otras encima.
            </Text>
            <View className="mt-3 gap-2">
              {PERFILES_DEMO.map((perfil) => (
                <Pressable
                  key={perfil.subject}
                  onPress={() => entrar('demo', perfil.subject)}
                  disabled={entrando}
                  className="rounded-lg border border-line-strong px-4 py-3"
                >
                  <Text className="text-sm font-semibold text-ink">{perfil.nombre}</Text>
                  <Text className="mt-0.5 text-xs text-ink-muted">{perfil.que}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {cancelado && (
          <Text className="mt-4 text-sm text-ink-muted">
            Cerraste el navegador antes de terminar. Podés intentar de nuevo.
          </Text>
        )}

        <Text className="mt-4 text-label text-ink-faint">
          Si todavía no tenés acceso, pedile el enlace de activación a la jefatura o a la Secretaría
          de tu grupo.
        </Text>
      </ScrollView>
    </SafeAreaView>
  )
}
