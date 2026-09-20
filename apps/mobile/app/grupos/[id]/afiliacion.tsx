import { useDeclaraciones, useDeclararAfiliacion } from '@gps/api'
import { nombreDelTipo } from '@gps/personas/dominio'
import { Link, useLocalSearchParams } from 'expo-router'
import { Pressable, ScrollView, Text, View } from 'react-native'

type Declaracion = NonNullable<ReturnType<typeof useDeclaraciones>['data']>['declaraciones'][number]

function Nomina(props: { declaracion: Declaracion }) {
  const aCobrar = new Set(props.declaracion.aCobrar.map((uno) => uno.personaId))
  return (
    <View className="mt-2 overflow-hidden rounded-lg bg-white">
      {props.declaracion.afiliados.map((afiliado) => (
        <View key={afiliado.personaId} className="border-b border-slate-200 px-4 py-3">
          <Text className="text-sm font-medium text-slate-900">
            {afiliado.apellidos}, {afiliado.nombres}
          </Text>
          <Text className="mt-0.5 text-xs text-slate-500">
            {nombreDelTipo(afiliado.tipoDeDocumento)} {afiliado.numeroDeDocumento}
            {aCobrar.has(afiliado.personaId) ? (
              <Text className="text-amber-800"> · a cobrar</Text>
            ) : (
              <Text className="text-slate-400"> · ya afiliada</Text>
            )}
          </Text>
        </View>
      ))}
    </View>
  )
}

export default function Pantalla() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const consulta = useDeclaraciones(id)
  const declarar = useDeclararAfiliacion()

  return (
    <View className="flex-1 bg-slate-50">
      <ScrollView contentContainerClassName="px-4 py-10">
        <Link href={`/grupos/${id}`} className="text-sm text-slate-500">
          ← Grupo
        </Link>
        <Text className="mt-1 text-lg font-semibold text-slate-900">Afiliación</Text>

        {consulta.isPending && <Text className="mt-8 text-sm text-slate-500">Consultando…</Text>}

        {consulta.error && (
          <View className="mt-8 rounded-lg bg-red-50 p-4">
            <Text className="text-sm text-red-800">
              No se pudieron consultar las declaraciones: {consulta.error.message}
            </Text>
          </View>
        )}

        {(consulta.data?.declaraciones ?? []).map((declaracion) => (
          <View key={declaracion.id} className="mt-6">
            <Text className="text-sm font-semibold text-slate-900">
              {declaracion.fecha}
              <Text className="font-normal text-slate-400">
                {' '}
                período {declaracion.periodo} · {declaracion.afiliados.length} en la nómina ·{' '}
                {declaracion.aCobrar.length} a cobrar
              </Text>
            </Text>
            <Nomina declaracion={declaracion} />
          </View>
        ))}

        {consulta.data?.declaraciones.length === 0 && (
          <View className="mt-6 rounded-lg bg-white p-4">
            <Text className="text-sm text-slate-500">
              El grupo todavía no tiene ninguna declaración.
            </Text>
          </View>
        )}

        {/* Lo menos frecuente, asi que va al final y no compite por lugar. */}
        <Pressable
          disabled={declarar.isPending}
          onPress={() => declarar.mutate({ grupoId: id })}
          className="mt-8 rounded-lg bg-slate-900 px-4 py-3"
          style={declarar.isPending ? { opacity: 0.5 } : undefined}
        >
          <Text className="text-center text-sm font-medium text-white">
            {declarar.isPending ? 'Declarando…' : 'Declarar afiliación extraordinaria'}
          </Text>
        </Pressable>

        {declarar.error && (
          <View className="mt-2 rounded-lg bg-red-50 p-4">
            <Text className="text-sm text-red-800">{declarar.error.message}</Text>
          </View>
        )}
      </ScrollView>
    </View>
  )
}
