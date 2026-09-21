import {
  type MedioDePago,
  useAnularPago,
  useCuentaDeGrupo,
  useRegistrarPago,
  useTesoreria,
} from '@gps/api'
import { Link, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { Pressable, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native'

const pesos = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
})

export default function Pantalla() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const resumen = useTesoreria()
  const consulta = useCuentaDeGrupo(id)
  const registrar = useRegistrarPago()
  const anular = useAnularPago(id)
  const [fecha, setFecha] = useState('')
  const [importe, setImporte] = useState('')
  const [medio, setMedio] = useState<MedioDePago>('transferencia')
  const [referencia, setReferencia] = useState('')
  const [observacion, setObservacion] = useState('')
  const cuenta = resumen.data?.cuentasDeGrupos.find((una) => una.grupoId === id)
  const movimientos = consulta.data?.movimientosDeTesoreria ?? []
  const anulados = new Set(movimientos.map((uno) => uno.anulaA).filter(Boolean))

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <ScrollView contentContainerClassName="px-4 py-10">
        <Link href="/tesoreria" className="text-sm text-slate-500">
          ← Tesorería
        </Link>
        <Text className="mt-1 text-lg font-semibold text-slate-900">
          {cuenta ? `Grupo Scout Nº${cuenta.numero} - ${cuenta.nombre}` : 'Cuenta del grupo'}
        </Text>
        {cuenta && (
          <Text className="mt-1 text-sm text-slate-600">
            Saldo: {pesos.format(Math.abs(cuenta.saldo))}
            {cuenta.saldo < 0 ? ' a favor' : cuenta.saldo > 0 ? ' de deuda' : ''}
          </Text>
        )}

        <View className="mt-6 rounded-lg bg-white p-4">
          <Text className="text-sm font-semibold text-slate-900">Registrar pago externo</Text>
          <View className="mt-3 flex-row gap-2">
            <TextInput
              accessibilityLabel="Fecha del pago"
              placeholder="aaaa-mm-dd"
              value={fecha}
              onChangeText={setFecha}
              className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm"
            />
            <TextInput
              accessibilityLabel="Importe"
              placeholder="Importe"
              keyboardType="number-pad"
              value={importe}
              onChangeText={setImporte}
              className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </View>
          <View className="mt-2 flex-row gap-2">
            {(['transferencia', 'efectivo', 'otro'] as const).map((uno) => (
              <Pressable
                key={uno}
                onPress={() => setMedio(uno)}
                className={`rounded-full px-3 py-2 ${medio === uno ? 'bg-slate-900' : 'bg-slate-100'}`}
              >
                <Text className={`text-xs ${medio === uno ? 'text-white' : 'text-slate-700'}`}>
                  {uno}
                </Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            accessibilityLabel="Referencia opcional"
            placeholder="Referencia opcional"
            value={referencia}
            onChangeText={setReferencia}
            className="mt-2 rounded border border-slate-300 px-3 py-2 text-sm"
          />
          <TextInput
            accessibilityLabel="Observación opcional"
            placeholder="Observación opcional"
            value={observacion}
            onChangeText={setObservacion}
            multiline
            className="mt-2 rounded border border-slate-300 px-3 py-2 text-sm"
          />
          <Pressable
            disabled={registrar.isPending}
            onPress={() =>
              registrar.mutate(
                {
                  grupoId: id,
                  fecha,
                  importe: Number(importe),
                  medioDePago: medio,
                  referencia,
                  observacion,
                },
                {
                  onSuccess: () => {
                    setImporte('')
                    setReferencia('')
                    setObservacion('')
                  },
                },
              )
            }
            className="mt-3 rounded bg-slate-900 px-4 py-3"
          >
            <Text className="text-center text-sm font-medium text-white">
              {registrar.isPending ? 'Registrando…' : 'Registrar pago'}
            </Text>
          </Pressable>
          {registrar.error && (
            <Text className="mt-2 text-sm text-red-700">{registrar.error.message}</Text>
          )}
        </View>

        <Text className="mt-6 text-sm font-semibold text-slate-900">Movimientos</Text>
        {consulta.isPending && <Text className="mt-3 text-sm text-slate-500">Consultando…</Text>}
        {consulta.error && (
          <Text className="mt-3 text-sm text-red-700">{consulta.error.message}</Text>
        )}
        <View className="mt-3 overflow-hidden rounded-lg bg-white">
          {movimientos.map((movimiento) => (
            <View key={movimiento.id} className="border-b border-slate-200 px-4 py-3">
              <View className="flex-row justify-between gap-3">
                <Text className="flex-1 text-sm">
                  {movimiento.fecha} ·{' '}
                  {movimiento.tipo === 'cargo_afiliacion'
                    ? 'Afiliación'
                    : movimiento.tipo === 'pago'
                      ? 'Pago'
                      : 'Anulación'}
                </Text>
                <Text className="text-sm font-semibold">
                  {movimiento.tipo === 'pago' ? '−' : '+'}
                  {pesos.format(movimiento.importe)}
                </Text>
              </View>
              {movimiento.cantidad && (
                <Text className="mt-1 text-xs text-slate-500">
                  {movimiento.cantidad} × {pesos.format(movimiento.cuota ?? 0)}
                </Text>
              )}
              {movimiento.tipo === 'pago' && !anulados.has(movimiento.id) && (
                <Pressable
                  disabled={anular.isPending}
                  onPress={() => anular.mutate({ pagoId: movimiento.id })}
                >
                  <Text className="mt-2 text-xs text-red-700">Anular pago</Text>
                </Pressable>
              )}
            </View>
          ))}
        </View>
        {movimientos.length === 0 && !consulta.isPending && (
          <Text className="mt-3 text-sm text-slate-500">
            La cuenta todavía no tiene movimientos.
          </Text>
        )}
        {anular.error && <Text className="mt-2 text-sm text-red-700">{anular.error.message}</Text>}
      </ScrollView>
    </SafeAreaView>
  )
}
