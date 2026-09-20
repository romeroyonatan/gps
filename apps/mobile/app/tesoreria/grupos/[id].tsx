import {
  type MedioDePago,
  useActor,
  useAnularPago,
  useCuentaDeGrupo,
  useRegistrarPago,
  useTesoreria,
} from '@gps/api'
import { puedeRegistrarPagos } from '@gps/tesoreria/dominio'
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { Pressable, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native'

const pesos = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
})

const CLASE_DE_INPUT = 'min-h-12 rounded-lg border border-line-strong px-3 py-2 text-base text-ink'

const NOMBRE_DEL_MEDIO: Record<MedioDePago, string> = {
  transferencia: 'Transferencia',
  efectivo: 'Efectivo',
  otro: 'Otro',
}

/** Registrar un pago es privativo de Tesorería diocesana: la jefatura lee su
 *  cuenta pero no la escribe. El formulario no se dibuja para quien no puede. */
function RegistrarPago(props: { grupoId: string }) {
  const registrar = useRegistrarPago()
  const [fecha, setFecha] = useState('')
  const [importe, setImporte] = useState('')
  const [medio, setMedio] = useState<MedioDePago>('transferencia')
  const [referencia, setReferencia] = useState('')
  const [observacion, setObservacion] = useState('')

  return (
    <View className="mt-6 gap-2 rounded-lg border border-line p-4">
      <Text className="text-lg font-bold text-ink">Registrar pago externo</Text>
      <View className="flex-row gap-2">
        <TextInput
          accessibilityLabel="Fecha del pago"
          placeholder="aaaa-mm-dd"
          value={fecha}
          onChangeText={setFecha}
          className={`${CLASE_DE_INPUT} flex-1`}
        />
        <TextInput
          accessibilityLabel="Importe"
          placeholder="Importe"
          keyboardType="number-pad"
          value={importe}
          onChangeText={setImporte}
          className={`${CLASE_DE_INPUT} flex-1`}
        />
      </View>
      <View className="flex-row gap-2">
        {(['transferencia', 'efectivo', 'otro'] as const).map((uno) => (
          <Pressable
            key={uno}
            onPress={() => setMedio(uno)}
            className={`min-h-12 justify-center rounded-full px-3 ${
              medio === uno ? 'bg-accent' : 'bg-surface-3'
            }`}
          >
            <Text
              className={`text-sm font-medium ${medio === uno ? 'text-accent-ink' : 'text-ink'}`}
            >
              {NOMBRE_DEL_MEDIO[uno]}
            </Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        accessibilityLabel="Referencia opcional"
        placeholder="Referencia opcional"
        value={referencia}
        onChangeText={setReferencia}
        className={CLASE_DE_INPUT}
      />
      <TextInput
        accessibilityLabel="Observación opcional"
        placeholder="Observación opcional"
        value={observacion}
        onChangeText={setObservacion}
        multiline
        className={CLASE_DE_INPUT}
      />
      <Pressable
        disabled={registrar.isPending}
        onPress={() =>
          registrar.mutate(
            {
              grupoId: props.grupoId,
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
        className={`mt-1 min-h-12 items-center justify-center rounded-lg bg-accent px-4 ${
          registrar.isPending ? 'opacity-50' : ''
        }`}
      >
        <Text className="text-base font-semibold text-accent-ink">
          {registrar.isPending ? 'Registrando…' : 'Registrar pago'}
        </Text>
      </Pressable>
      {registrar.error && (
        <Text className="mt-1 text-sm text-danger">{registrar.error.message}</Text>
      )}
    </View>
  )
}

export default function Pantalla() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const resumen = useTesoreria()
  const consulta = useCuentaDeGrupo(id)
  const anular = useAnularPago(id)
  const actor = useActor()
  const cuenta = resumen.data?.cuentasDeGrupos.find((una) => una.grupoId === id)
  const movimientos = consulta.data?.movimientosDeTesoreria ?? []
  const anulados = new Set(movimientos.map((uno) => uno.anulaA).filter(Boolean))
  const escribe = actor !== null && puedeRegistrarPagos(actor)

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <ScrollView contentContainerClassName="px-4 py-6">
        {/* Se llega desde el grupo o desde el panorama diocesano, según quién
            mire: volver es volver a donde estaba, no a una pantalla fija. */}
        <Pressable onPress={() => router.back()} className="min-h-12 justify-center">
          <Text className="text-label text-ink-muted">← Volver</Text>
        </Pressable>
        <Text className="text-2xl font-bold text-ink">
          {cuenta ? `Grupo ${cuenta.numero} — ${cuenta.nombre}` : 'Cuenta del grupo'}
        </Text>

        {cuenta && (
          <>
            {/* El saldo positivo es deuda: así lo guarda tesorería. El signo se
                escribe, no se deduce del color. */}
            <Text
              className={`mt-3 text-2xl font-bold ${cuenta.saldo > 0 ? 'text-danger' : 'text-ink'}`}
            >
              {cuenta.saldo > 0 ? '−' : ''}
              {pesos.format(Math.abs(cuenta.saldo))}
            </Text>
            <Text className="mt-0.5 text-sm text-ink-muted">
              {cuenta.saldo > 0 ? 'De deuda' : cuenta.saldo < 0 ? 'A favor del grupo' : 'Sin deuda'}
            </Text>
          </>
        )}

        {escribe && <RegistrarPago grupoId={id} />}

        <Text className="mt-6 text-lg font-bold text-ink">Movimientos</Text>
        {consulta.isPending && <Text className="mt-3 text-sm text-ink-muted">Consultando…</Text>}
        {consulta.error && (
          <Text className="mt-3 text-sm text-danger">{consulta.error.message}</Text>
        )}
        <View className="mt-2">
          {movimientos.map((movimiento) => (
            <View key={movimiento.id} className="border-b border-line py-3">
              <View className="flex-row justify-between gap-3">
                <Text className="flex-1 text-sm text-ink">
                  {movimiento.fecha} ·{' '}
                  {movimiento.tipo === 'cargo_afiliacion'
                    ? 'Afiliación'
                    : movimiento.tipo === 'pago'
                      ? 'Pago'
                      : 'Anulación de pago'}
                </Text>
                <Text className="text-sm font-bold text-ink">
                  {movimiento.tipo === 'pago' ? '−' : '+'}
                  {pesos.format(movimiento.importe)}
                </Text>
              </View>
              {movimiento.cantidad && (
                <Text className="mt-1 text-xs text-ink-muted">
                  {movimiento.cantidad} × {pesos.format(movimiento.cuota ?? 0)}
                </Text>
              )}
              {movimiento.referencia && (
                <Text className="mt-1 text-xs text-ink-muted">
                  Referencia: {movimiento.referencia}
                </Text>
              )}
              {escribe && movimiento.tipo === 'pago' && !anulados.has(movimiento.id) && (
                <Pressable
                  disabled={anular.isPending}
                  onPress={() => anular.mutate({ pagoId: movimiento.id })}
                  className="min-h-12 justify-center"
                >
                  <Text className="text-xs text-ink-muted">Anular pago</Text>
                </Pressable>
              )}
            </View>
          ))}
        </View>
        {movimientos.length === 0 && !consulta.isPending && (
          <Text className="mt-3 text-sm text-ink-muted">
            La cuenta todavía no tiene movimientos.
          </Text>
        )}
        {anular.error && <Text className="mt-2 text-sm text-danger">{anular.error.message}</Text>}
      </ScrollView>
    </SafeAreaView>
  )
}
