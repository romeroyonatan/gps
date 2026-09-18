import { useDistritos, useVersion } from '@gps/api'
import { etiquetaDeEdades, ramaDelCatalogo, type Unidad } from '@gps/estructura/dominio'
import { Link } from 'expo-router'
import { Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native'

/** El nombre propio y, en gris, el tramo de edad de su rama. Se muestra el
 *  nombre y no la rama porque es lo que distingue dos tropas del mismo grupo. */
function EtiquetaDeUnidad(props: { unidad: Pick<Unidad, 'rama' | 'nombre'> }) {
  const rama = ramaDelCatalogo(props.unidad.rama)
  if (!rama) return null
  return (
    <View className="rounded-full bg-slate-100 px-2.5 py-1">
      <Text className="text-xs text-slate-700">
        {props.unidad.nombre} <Text className="text-slate-400">{etiquetaDeEdades(rama)}</Text>
      </Text>
    </View>
  )
}

function Grupo(props: {
  id: string
  numero: number
  nombre: string
  unidades: readonly Pick<Unidad, 'id' | 'rama' | 'nombre'>[]
}) {
  return (
    <Link href={`/grupos/${props.id}`} asChild>
      <Pressable className="border-b border-slate-200 px-4 py-3">
        <Text className="text-sm font-medium text-slate-900">
          <Text className="text-slate-400">Grupo Scout Nº{props.numero} -</Text> {props.nombre}
        </Text>
        {props.unidades.length === 0 ? (
          <Text className="mt-1.5 text-xs text-slate-400">Todavía no abrió ninguna unidad</Text>
        ) : (
          <View className="mt-1.5 flex-row flex-wrap gap-1.5">
            {props.unidades.map((unidad) => (
              <EtiquetaDeUnidad key={unidad.id} unidad={unidad} />
            ))}
          </View>
        )}
      </Pressable>
    </Link>
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
                  id={grupo.id}
                  numero={grupo.numero}
                  nombre={grupo.nombre}
                  unidades={grupo.unidades}
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
