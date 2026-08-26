import { useVersion } from '@gps/api'
import { SafeAreaView, Text, View } from 'react-native'

function Fila(props: { etiqueta: string; valor: string }) {
  return (
    <View className="flex-row justify-between border-b border-slate-200 px-4 py-3">
      <Text className="text-sm text-slate-500">{props.etiqueta}</Text>
      <Text className="text-sm font-medium text-slate-900">{props.valor}</Text>
    </View>
  )
}

export default function Pantalla() {
  const { data, isPending, error } = useVersion()

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <View className="px-4 py-10">
        <Text className="text-2xl font-semibold text-slate-900">GPS</Text>
        <Text className="mt-1 text-sm text-slate-500">Gestión para Scouts</Text>

        {isPending && <Text className="mt-8 text-sm text-slate-500">Consultando la versión…</Text>}

        {error && (
          <View className="mt-8 rounded-lg bg-red-50 p-4">
            <Text className="text-sm text-red-800">
              No se pudo consultar la versión: {error.message}
            </Text>
          </View>
        )}

        {data && (
          <View className="mt-8 rounded-lg bg-white">
            <Fila etiqueta="Versión" valor={data.version.numero} />
            <Fila etiqueta="Entorno" valor={data.version.entorno} />
            <Fila etiqueta="Módulos" valor={data.version.modulos.join(', ')} />
          </View>
        )}
      </View>
    </SafeAreaView>
  )
}
