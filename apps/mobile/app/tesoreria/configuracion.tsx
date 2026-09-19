import { useDefinirCuotaDeAfiliacion, useTesoreria } from '@gps/api'
import { Link } from 'expo-router'
import { useState } from 'react'
import { Pressable, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native'

const pesos = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
})

export default function Pantalla() {
  const consulta = useTesoreria()
  const definir = useDefinirCuotaDeAfiliacion()
  const [periodoElegido, setPeriodoElegido] = useState<number | null>(null)
  const [importe, setImporte] = useState('')
  const periodos = consulta.data?.periodosConfigurablesDeAfiliacion ?? []
  const periodo = periodoElegido ?? periodos[0]

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <ScrollView contentContainerClassName="px-4 py-10">
        <Link href="/tesoreria" className="text-sm text-slate-500">
          ← Tesorería
        </Link>
        <Text className="mt-1 text-lg font-semibold text-slate-900">Configuración de cuotas</Text>
        <Text className="mt-1 text-sm text-slate-500">
          Cada período comienza en marzo y conserva su importe histórico.
        </Text>

        <View className="mt-6 rounded-lg bg-white p-4">
          <Text className="text-sm text-slate-700">Período de afiliación</Text>
          <View className="mt-2 flex-row flex-wrap gap-2">
            {periodos.map((uno) => (
              <Pressable
                key={uno}
                accessibilityRole="radio"
                accessibilityState={{ selected: periodo === uno }}
                onPress={() => setPeriodoElegido(uno)}
                className={`rounded-full px-3 py-2 ${periodo === uno ? 'bg-slate-900' : 'bg-slate-100'}`}
              >
                <Text className={periodo === uno ? 'text-white' : 'text-slate-700'}>
                  {uno}/{uno + 1}
                </Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            accessibilityLabel="Importe en pesos"
            placeholder="Importe en pesos"
            keyboardType="number-pad"
            value={importe}
            onChangeText={setImporte}
            className="mt-3 rounded border border-slate-300 px-3 py-2 text-sm"
          />
          <Pressable
            disabled={definir.isPending || periodo === undefined}
            onPress={() => {
              if (periodo !== undefined) definir.mutate({ periodo, importe: Number(importe) })
            }}
            className="mt-3 rounded bg-slate-900 px-4 py-3 disabled:opacity-50"
          >
            <Text className="text-center text-sm font-medium text-white">
              {definir.isPending ? 'Guardando…' : 'Guardar cuota'}
            </Text>
          </Pressable>
          {definir.error && (
            <Text className="mt-2 text-sm text-red-700">{definir.error.message}</Text>
          )}
        </View>

        <Text className="mt-6 text-sm font-semibold text-slate-900">Historial</Text>
        <View className="mt-2 overflow-hidden rounded-lg bg-white">
          {(consulta.data?.cuotasDeAfiliacion ?? []).map((cuota) => (
            <View
              key={cuota.periodo}
              className="flex-row justify-between border-b border-slate-200 px-4 py-3"
            >
              <Text className="text-sm">Período {cuota.periodo}</Text>
              <Text className="text-sm font-semibold">{pesos.format(cuota.importe)}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
