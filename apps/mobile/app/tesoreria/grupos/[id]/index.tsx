import { useActor, useAnularPago, useCuentaDeGrupo, useTesoreria } from '@gps/api'
import { enPesos, puedeRegistrarPagos, puedeVerTesoreriaDeLaDiocesis } from '@gps/tesoreria/dominio'
import { useLocalSearchParams } from 'expo-router'
import { ScrollView, Text, View } from 'react-native'
import {
  Accion,
  AccionAlMargen,
  Cargando,
  Falla,
  Saldo,
  Seccion,
  Titulo,
  Vacio,
  Volver,
} from '../../../../src/ui'

const NOMBRE_DEL_MOVIMIENTO = {
  cargo_afiliacion: 'Afiliación',
  pago: 'Pago',
} as const

export default function Pantalla() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const resumen = useTesoreria()
  const consulta = useCuentaDeGrupo(id)
  const anular = useAnularPago(id)
  const actor = useActor()

  const cuenta = resumen.data?.cuentasDeGrupos.find((una) => una.grupoId === id)
  const movimientos = consulta.data?.movimientosDeTesoreria ?? []
  const pagosAnulados = new Set(movimientos.map((uno) => uno.anulaA).filter(Boolean))

  const escribe = actor !== null && puedeRegistrarPagos(actor)
  // A dónde vuelve depende de por dónde se entra: para Tesorería diocesana
  // esto cuelga de /tesorería; para la jefatura es una de las tareas de su
  // grupo. En el teléfono, a diferencia de la web, el camino de vuelta se
  // dibuja siempre: acá no hay barra de navegación que lo tenga a la vista.
  const desdeLaDiocesis = actor !== null && puedeVerTesoreriaDeLaDiocesis(actor)

  return (
    <ScrollView className="flex-1 bg-surface" contentContainerClassName="px-4 pb-10">
      {desdeLaDiocesis ? (
        <Volver href="/tesoreria">Tesorería</Volver>
      ) : (
        <Volver href={`/grupos/${id}`}>Grupo</Volver>
      )}
      <Titulo>{cuenta ? `Grupo ${cuenta.numero} — ${cuenta.nombre}` : 'Cuenta del grupo'}</Titulo>

      {cuenta && (
        <View className="mt-5">
          <Saldo importe={cuenta.saldo} />
        </View>
      )}

      {/* La acción arriba de la lista y no un formulario colgado abajo:
            asentar un pago es una tarea que termina, y tiene su pantalla. */}
      {escribe && (
        <View className="mt-5">
          <Accion href={`/tesoreria/grupos/${id}/pago`}>Registrar pago externo</Accion>
        </View>
      )}

      <Seccion titulo="Movimientos" cuantos={movimientos.length}>
        {consulta.isPending && <Cargando>Consultando…</Cargando>}
        {consulta.error && <Falla>{consulta.error.message}</Falla>}

        <View className="mt-2">
          {movimientos.map((movimiento) => (
            <View key={movimiento.id} className="border-b border-line py-3">
              <View className="flex-row items-baseline justify-between gap-3">
                <Text className="min-w-0 flex-1 text-sm text-ink">
                  {movimiento.fecha} ·{' '}
                  {NOMBRE_DEL_MOVIMIENTO[movimiento.tipo as keyof typeof NOMBRE_DEL_MOVIMIENTO] ??
                    'Anulación de pago'}
                </Text>
                {/* Un cargo suma deuda y un pago la baja: el signo dice de
                      qué lado va el movimiento, no si el número es grande. */}
                <Text className="shrink-0 text-sm font-bold text-ink">
                  {movimiento.tipo === 'pago' ? '−' : '+'}
                  {enPesos(movimiento.importe)}
                </Text>
              </View>
              {movimiento.cantidad && (
                <Text className="mt-0.5 text-label text-ink-muted">
                  {movimiento.cantidad} × {enPesos(movimiento.cuota ?? 0)}
                </Text>
              )}
              {movimiento.referencia && (
                <Text className="mt-0.5 text-label text-ink-muted">
                  Referencia: {movimiento.referencia}
                </Text>
              )}
              {/* El pago no se edita: si está mal, se anula y se carga de
                    nuevo. Queda el rastro de los dos asientos. */}
              {escribe && movimiento.tipo === 'pago' && !pagosAnulados.has(movimiento.id) && (
                <AccionAlMargen
                  disabled={anular.isPending}
                  onPress={() => anular.mutate({ pagoId: movimiento.id })}
                >
                  Anular pago
                </AccionAlMargen>
              )}
            </View>
          ))}
        </View>

        {movimientos.length === 0 && !consulta.isPending && (
          <Vacio>La cuenta todavía no tiene movimientos.</Vacio>
        )}
        {anular.error && <Falla>{anular.error.message}</Falla>}
      </Seccion>
    </ScrollView>
  )
}
