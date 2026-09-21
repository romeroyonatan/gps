import { useActor, useAnularPago, useCuentaDeGrupo, useTesoreria } from '@gps/api'
import { puedeRegistrarPagos, puedeVerTesoreriaDeLaDiocesis } from '@gps/tesoreria/dominio'
import { Link, useLocalSearchParams } from 'expo-router'
import { Pressable, Text, View } from 'react-native'
import { Cargando, Falla, Pantalla, pesos, Titulo, Vacio, Volver } from '../../../../componentes/ui'

const NOMBRE_DEL_MOVIMIENTO = {
  cargo_afiliacion: 'Afiliación',
  pago: 'Pago',
} as const

export default function Pantalla_() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const resumen = useTesoreria()
  const consulta = useCuentaDeGrupo(id)
  const anular = useAnularPago(id)
  const actor = useActor()

  const cuenta = resumen.data?.cuentasDeGrupos.find((una) => una.grupoId === id)
  const movimientos = consulta.data?.movimientosDeTesoreria ?? []
  const pagosAnulados = new Set(movimientos.map((uno) => uno.anulaA).filter(Boolean))

  const escribe = actor !== null && puedeRegistrarPagos(actor)
  // Si hay camino de vuelta depende de por dónde se entra: para la jefatura
  // esto es una de las tareas de su grupo, no una fila de la lista diocesana.
  const desdeLaDiocesis = actor !== null && puedeVerTesoreriaDeLaDiocesis(actor)

  return (
    <Pantalla>
      {desdeLaDiocesis && <Volver href="/tesoreria">Tesorería</Volver>}
      <Titulo>{cuenta ? `Grupo ${cuenta.numero} — ${cuenta.nombre}` : 'Cuenta del grupo'}</Titulo>

      {cuenta && (
        <View className="mt-5">
          {/* El saldo positivo es deuda: así lo guarda tesorería. El signo se
              escribe, no se deduce del color. */}
          <Text className={`text-2xl font-bold ${cuenta.saldo > 0 ? 'text-danger' : 'text-ink'}`}>
            {cuenta.saldo > 0 ? '−' : ''}
            {pesos.format(Math.abs(cuenta.saldo))}
          </Text>
          <Text className="mt-0.5 text-sm text-ink-muted">
            {cuenta.saldo > 0 ? 'De deuda' : cuenta.saldo < 0 ? 'A favor del grupo' : 'Sin deuda'}.
          </Text>
        </View>
      )}

      {/* La acción arriba de la lista y no un formulario colgado abajo:
          asentar un pago es una tarea que termina, y tiene su pantalla. */}
      {escribe && (
        <View className="mt-5 flex-row">
          <Link href={`/tesoreria/grupos/${id}/pago`} asChild>
            <Pressable className="min-h-11 items-center justify-center rounded-lg bg-accent px-3.5 active:bg-accent-strong">
              <Text className="text-sm font-semibold text-accent-ink">Registrar pago externo</Text>
            </Pressable>
          </Link>
        </View>
      )}

      <Text className="mt-6 text-lg font-bold text-ink">
        Movimientos
        {movimientos.length > 0 && (
          <Text className="text-label font-medium text-ink-muted"> {movimientos.length}</Text>
        )}
      </Text>
      {consulta.isPending && <Cargando>Consultando…</Cargando>}
      {consulta.error && <Falla>{consulta.error.message}</Falla>}

      <View className="mt-2">
        {movimientos.map((movimiento) => (
          <View key={movimiento.id} className="border-b border-line py-3">
            <View className="flex-row items-baseline justify-between gap-3">
              <Text className="shrink text-base text-ink">
                {movimiento.fecha} ·{' '}
                {NOMBRE_DEL_MOVIMIENTO[movimiento.tipo as keyof typeof NOMBRE_DEL_MOVIMIENTO] ??
                  'Anulación de pago'}
              </Text>
              {/* Un cargo suma deuda y un pago la baja: el signo dice de qué
                  lado va el movimiento, no si el número es grande. */}
              <Text className="shrink-0 text-base font-bold text-ink">
                {movimiento.tipo === 'pago' ? '−' : '+'}
                {pesos.format(Math.abs(movimiento.importe))}
              </Text>
            </View>
            {movimiento.cantidad && (
              <Text className="mt-0.5 text-label text-ink-muted">
                {movimiento.cantidad} × {pesos.format(movimiento.cuota ?? 0)}
              </Text>
            )}
            {movimiento.referencia && (
              <Text className="mt-0.5 text-label text-ink-muted">
                Referencia: {movimiento.referencia}
              </Text>
            )}
            {/* El pago no se edita: si está mal, se anula y se carga de nuevo.
                Queda el rastro de los dos asientos. */}
            {escribe && movimiento.tipo === 'pago' && !pagosAnulados.has(movimiento.id) && (
              <Pressable
                accessibilityRole="button"
                disabled={anular.isPending}
                onPress={() => anular.mutate({ pagoId: movimiento.id })}
                className="mt-1.5 min-h-9 justify-center"
              >
                <Text className="text-label text-ink-faint">Anular pago</Text>
              </Pressable>
            )}
          </View>
        ))}
      </View>

      {movimientos.length === 0 && !consulta.isPending && (
        <Vacio>La cuenta todavía no tiene movimientos.</Vacio>
      )}
      {anular.error && <Falla>{anular.error.message}</Falla>}
    </Pantalla>
  )
}
