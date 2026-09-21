import { useTesoreria } from '@gps/api'
import { ScrollView, Text, View } from 'react-native'
import { Accion, Cargando, Falla, FILA, Titulo, Vacio, Volver } from '../../../src/ui'

const pesos = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
})

/** El historial de cuotas. Definir una es una tarea que termina y tiene su
 *  propia pantalla: acá sólo se mira lo que ya está, con la acción arriba. */
export default function Pantalla() {
  const consulta = useTesoreria()
  const cuotas = consulta.data?.cuotasDeAfiliacion ?? []

  return (
    <ScrollView className="flex-1 bg-surface" contentContainerClassName="px-4 pb-10">
      <Volver href="/tesoreria">Tesorería</Volver>
      <Titulo acompaña="Cada período comienza en marzo y conserva su importe histórico.">
        Cuotas de afiliación
      </Titulo>

      <View className="mt-5">
        <Accion href="/tesoreria/configuracion/nueva">Definir una cuota</Accion>
      </View>

      {consulta.isPending && <Cargando>Consultando…</Cargando>}
      {consulta.error && <Falla>{consulta.error.message}</Falla>}

      <View className="mt-5">
        {cuotas.map((cuota) => (
          <View key={cuota.periodo} className={`${FILA} justify-between`}>
            <Text className="min-w-0 flex-1 text-sm font-semibold text-ink">
              Período {cuota.periodo}
              <Text className="font-normal text-ink-muted">
                {'  '}marzo {cuota.periodo} a febrero {cuota.periodo + 1}
              </Text>
            </Text>
            <Text className="shrink-0 text-sm font-bold text-ink">
              {pesos.format(cuota.importe)}
            </Text>
          </View>
        ))}
      </View>
      {cuotas.length === 0 && !consulta.isPending && (
        <Vacio>Todavía no hay ninguna cuota definida.</Vacio>
      )}
    </ScrollView>
  )
}
