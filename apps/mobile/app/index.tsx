import { useDistritos, useVersion } from '@gps/api'
import { etiquetaDeEdades, RAMAS, type Rama } from '@gps/estructura/dominio'
import { SafeAreaView, ScrollView, Text, View } from 'react-native'

const RAMA_POR_ID = new Map(RAMAS.map((rama) => [rama.id, rama]))

function EtiquetaDeRama(props: { rama: Rama }) {
  const rama = RAMA_POR_ID.get(props.rama)
  if (!rama) return null
  const edades = etiquetaDeEdades(rama)
  return (
    <View className="rounded-full bg-slate-100 px-2.5 py-1">
      <Text className="text-xs text-slate-700">
        {rama.nombre} <Text className="text-slate-400">{edades}</Text>
      </Text>
    </View>
  )
}

function Grupo(props: { numero: number; nombre: string; ramas: readonly Rama[] }) {
  return (
    <View className="border-b border-slate-200 px-4 py-3">
      <Text className="text-sm font-medium text-slate-900">
        <Text className="text-slate-400">Grupo Scout Nº{props.numero} -</Text> {props.nombre}
      </Text>
      {props.ramas.length === 0 ? (
        <Text className="mt-1.5 text-xs text-slate-400">Todavía no abrió ninguna rama</Text>
      ) : (
        <View className="mt-1.5 flex-row flex-wrap gap-1.5">
          {props.ramas.map((rama) => (
            <EtiquetaDeRama key={rama} rama={rama} />
          ))}
        </View>
      )}
    </View>
  )
}

export default function Pantalla() {
  const { data, isPending, error } = useDistritos()
  const version = useVersion()

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <ScrollView contentContainerClassName="px-4 py-10">
        <Text className="text-2xl font-semibold text-slate-900">GPS</Text>
        <Text className="mt-1 text-sm text-slate-500">Gestión para Scouts</Text>

        {isPending && (
          <Text className="mt-8 text-sm text-slate-500">Consultando la estructura…</Text>
        )}

        {error && (
          <View className="mt-8 rounded-lg bg-red-50 p-4">
            <Text className="text-sm text-red-800">
              No se pudo consultar la estructura: {error.message}
            </Text>
          </View>
        )}

        {data?.distritos.length === 0 && (
          <View className="mt-8 rounded-lg bg-white p-4">
            <Text className="text-sm text-slate-500">No hay distritos cargados todavía.</Text>
          </View>
        )}

        {data?.distritos.map((distrito) => (
          <View key={distrito.id} className="mt-6">
            <Text className="text-sm font-semibold text-slate-900">Distrito {distrito.numero}</Text>
            <Text className="text-xs text-slate-500">{distrito.zona}</Text>
            <View className="mt-2 overflow-hidden rounded-lg bg-white">
              {distrito.grupos.map((grupo) => (
                <Grupo
                  key={grupo.id}
                  numero={grupo.numero}
                  nombre={grupo.nombre}
                  ramas={grupo.ramas}
                />
              ))}
            </View>
          </View>
        ))}

        {version.data && (
          <Text className="mt-10 text-xs text-slate-400">
            v{version.data.version.numero} · {version.data.version.entorno} ·{' '}
            {version.data.version.modulos.join(', ')}
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
