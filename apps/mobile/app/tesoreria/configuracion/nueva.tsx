import { useDefinirCuotaDeAfiliacion, useTesoreria } from '@gps/api'
import { router } from 'expo-router'
import { useState } from 'react'
import { ScrollView, TextInput, View } from 'react-native'
import { Boton, CAMPO, Campo, Falla, Filtros, Titulo, Volver } from '../../../src/ui'

/** Definir la cuota de un período. Pantalla propia y no un formulario colgado
 *  del historial: es una tarea que termina, y al terminar vuelve a la lista,
 *  que recién cargada es la confirmación de que salió bien.
 *
 *  El período se elige con píldoras y no con un `<select>`: no hay select en
 *  React Native, y los períodos configurables son dos o tres. */
export default function Pantalla() {
  const consulta = useTesoreria()
  const definir = useDefinirCuotaDeAfiliacion()
  const [periodoElegido, setPeriodoElegido] = useState<string | null>(null)
  const [importe, setImporte] = useState('')
  const periodos = consulta.data?.periodosConfigurablesDeAfiliacion ?? []
  const periodo = periodoElegido ?? (periodos[0] === undefined ? null : String(periodos[0]))

  return (
    <ScrollView
      className="flex-1 bg-surface"
      contentContainerClassName="px-4 pb-10"
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      <Volver href="/tesoreria/configuracion">Cuotas</Volver>
      <Titulo acompaña="Se aplica a las declaraciones del período. Lo ya cobrado conserva su importe.">
        Definir una cuota
      </Titulo>

      <View className="mt-6 gap-5">
        <Campo etiqueta="Período de afiliación">
          <Filtros
            opciones={periodos.map((uno) => ({
              id: String(uno),
              etiqueta: `${uno}/${uno + 1}`,
            }))}
            valor={periodo}
            onElegir={setPeriodoElegido}
          />
        </Campo>

        <Campo etiqueta="Importe en pesos">
          <TextInput
            accessibilityLabel="Importe en pesos"
            keyboardType="number-pad"
            value={importe}
            onChangeText={setImporte}
            className={CAMPO}
          />
        </Campo>

        {definir.error && <Falla>{definir.error.message}</Falla>}

        <Boton
          disabled={definir.isPending || periodo === null || importe === ''}
          onPress={() => {
            if (periodo === null) return
            definir.mutate(
              { periodo: Number(periodo), importe: Number(importe) },
              { onSuccess: () => router.back() },
            )
          }}
        >
          {definir.isPending ? 'Guardando…' : 'Guardar cuota'}
        </Boton>
      </View>
    </ScrollView>
  )
}
