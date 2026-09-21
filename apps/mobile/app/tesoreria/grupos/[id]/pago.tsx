import { type MedioDePago, useActor, useRegistrarPago } from '@gps/api'
import { puedeRegistrarPagos } from '@gps/tesoreria/dominio'
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { ScrollView, TextInput, View } from 'react-native'
import { Boton, CAMPO, Campo, Falla, Filtros, Nota, Titulo, Volver } from '../../../../src/ui'

const MEDIOS = [
  { id: 'transferencia', etiqueta: 'Transferencia' },
  { id: 'efectivo', etiqueta: 'Efectivo' },
  { id: 'otro', etiqueta: 'Otro' },
] as const satisfies readonly { id: MedioDePago; etiqueta: string }[]

/** Asentar un pago recibido por fuera de GPS. Sólo Tesorería diocesana: la
 *  jefatura lee su cuenta pero no la escribe.
 *
 *  Pantalla propia y no un bloque metido entre el saldo y los movimientos: la
 *  cuenta es para leer, asentar un pago es una tarea que termina. */
export default function Pantalla() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const registrar = useRegistrarPago()
  const actor = useActor()
  const [fecha, setFecha] = useState('')
  const [importe, setImporte] = useState('')
  const [medio, setMedio] = useState<MedioDePago>('transferencia')
  const [referencia, setReferencia] = useState('')
  const [observacion, setObservacion] = useState('')

  const volver = `/tesoreria/grupos/${id}`

  // La misma política pura que aplica el servidor. Quien llega de memoria a
  // esta dirección sin poder escribir se encuentra con el motivo y no con un
  // formulario que el servidor después rechaza.
  if (actor !== null && !puedeRegistrarPagos(actor)) {
    return (
      <ScrollView className="flex-1 bg-surface" contentContainerClassName="px-4 pb-10">
        <Volver href={volver}>Cuenta del grupo</Volver>
        <Nota>Los pagos los asienta la Tesorería diocesana.</Nota>
      </ScrollView>
    )
  }

  return (
    <ScrollView className="flex-1 bg-surface" contentContainerClassName="px-4 pb-10">
      <Volver href={volver}>Cuenta del grupo</Volver>
      {/* En GPS no se paga: se asienta que se pagó. */}
      <Titulo acompaña="El grupo paga por fuera de GPS. Acá se asienta lo recibido y se imputa a la deuda.">
        Registrar pago externo
      </Titulo>

      <View className="mt-6 gap-5">
        <View className="flex-row gap-3">
          <View className="flex-1">
            <Campo etiqueta="Fecha">
              {/* No hay <input type="date"> en React Native: el texto crudo
                    alcanza porque el servidor rechaza lo que no sea una fecha
                    del almanaque. */}
              <TextInput
                accessibilityLabel="Fecha del pago"
                placeholder="aaaa-mm-dd"
                keyboardType="numbers-and-punctuation"
                value={fecha}
                onChangeText={setFecha}
                className={CAMPO}
              />
            </Campo>
          </View>
          <View className="flex-1">
            <Campo etiqueta="Importe">
              <TextInput
                accessibilityLabel="Importe"
                keyboardType="number-pad"
                value={importe}
                onChangeText={setImporte}
                className={CAMPO}
              />
            </Campo>
          </View>
        </View>

        <Campo etiqueta="Medio">
          <Filtros opciones={MEDIOS} valor={medio} onElegir={setMedio} />
        </Campo>

        <Campo etiqueta="Referencia">
          <TextInput
            accessibilityLabel="Referencia"
            placeholder="Opcional"
            value={referencia}
            onChangeText={setReferencia}
            className={CAMPO}
          />
        </Campo>

        <Campo etiqueta="Observación">
          <TextInput
            accessibilityLabel="Observación"
            placeholder="Opcional"
            multiline
            value={observacion}
            onChangeText={setObservacion}
            className={`${CAMPO} py-2.5`}
          />
        </Campo>

        {registrar.error && <Falla>{registrar.error.message}</Falla>}

        <Boton
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
              // Vuelve a la cuenta: el movimiento recién asentado es la
              // confirmación de que salió bien.
              { onSuccess: () => router.back() },
            )
          }
        >
          {registrar.isPending ? 'Registrando…' : 'Asentar pago'}
        </Boton>
      </View>
    </ScrollView>
  )
}
