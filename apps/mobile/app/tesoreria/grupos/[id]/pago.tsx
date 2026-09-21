import { type MedioDePago, useActor, useRegistrarPago, useTesoreria } from '@gps/api'
import {
  enPesos,
  fechaValida,
  importeEnPesosValido,
  imputacionDelPago,
  puedeRegistrarPagos,
} from '@gps/tesoreria/dominio'
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { Boton, CAMPO, Campo, Falla, Filtros, Nota, Titulo, Volver } from '../../../../src/ui'

const MEDIOS = [
  { id: 'transferencia', etiqueta: 'Transferencia' },
  { id: 'efectivo', etiqueta: 'Efectivo' },
  { id: 'otro', etiqueta: 'Otro' },
] as const satisfies readonly { id: MedioDePago; etiqueta: string }[]

const RESPALDO = {
  transferencia: { etiqueta: 'Número de comprobante', pista: '0012-00458871' },
  efectivo: { etiqueta: 'Quién recibió', pista: 'Nombre de quien recibió el efectivo' },
  otro: { etiqueta: 'Referencia', pista: 'Opcional' },
} as const satisfies Record<MedioDePago, { etiqueta: string; pista: string }>

const hoy = () => new Date().toLocaleDateString('en-CA')

/** Asentar un pago recibido por fuera de GPS. Sólo Tesorería diocesana: la
 *  jefatura lee su cuenta pero no la escribe. */
export default function Pantalla() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const resumen = useTesoreria()
  const registrar = useRegistrarPago()
  const actor = useActor()
  const [fecha, setFecha] = useState(hoy)
  const [importe, setImporte] = useState('')
  const [medio, setMedio] = useState<MedioDePago>('transferencia')
  const [referencia, setReferencia] = useState('')
  const [observacion, setObservacion] = useState('')

  const volver = `/tesoreria/grupos/${id}` as const
  const cuenta = resumen.data?.cuentasDeGrupos.find((una) => una.grupoId === id)
  const saldo = cuenta?.saldo ?? 0
  const monto = Number(importe.replace(/\D/g, ''))
  const imputacion = imputacionDelPago(saldo, monto)
  const puede = importeEnPesosValido(monto) && fechaValida(fecha)
  const respaldo = RESPALDO[medio]

  if (actor !== null && !puedeRegistrarPagos(actor)) {
    return (
      <ScrollView className="flex-1 bg-surface" contentContainerClassName="px-4 pb-10">
        <Volver href={volver}>Cuenta del grupo</Volver>
        <Nota>Los pagos los asienta la Tesorería diocesana.</Nota>
      </ScrollView>
    )
  }

  return (
    <ScrollView
      className="flex-1 bg-surface"
      contentContainerClassName="px-4 pb-10"
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      <Volver href={volver}>Cuenta del grupo</Volver>
      <Titulo acompaña="El grupo paga por fuera de GPS. Acá se asienta lo recibido y se imputa a la deuda.">
        Registrar pago
      </Titulo>

      {cuenta && (
        <Text className="mt-3 text-sm text-ink-muted">
          Grupo {cuenta.numero} — {cuenta.nombre} ·{' '}
          {saldo > 0 ? `deuda actual ${enPesos(saldo)}` : 'sin deuda'}
        </Text>
      )}

      <View className="mt-6 gap-5">
        <Campo etiqueta="Medio de pago">
          <Filtros opciones={MEDIOS} valor={medio} onElegir={setMedio} />
        </Campo>

        <Campo etiqueta="Importe recibido">
          <TextInput
            accessibilityLabel="Importe recibido"
            keyboardType="number-pad"
            placeholder="207000"
            value={importe}
            onChangeText={setImporte}
            className={`${CAMPO} h-16 text-2xl font-bold`}
          />
          {saldo > 0 && (
            <View className="mt-1 flex-row flex-wrap gap-2">
              {[
                { etiqueta: `Deuda completa ${enPesos(saldo)}`, valor: saldo },
                { etiqueta: 'Mitad', valor: Math.round(saldo / 2) },
              ].map((atajo) => (
                <Pressable
                  key={atajo.etiqueta}
                  accessibilityRole="button"
                  onPress={() => setImporte(String(atajo.valor))}
                  className="min-h-11 justify-center rounded-full border border-line-strong px-3 active:bg-surface-3"
                >
                  <Text className="text-sm font-semibold text-ink">{atajo.etiqueta}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </Campo>

        <Campo
          etiqueta="Fecha del pago"
          problema={fecha !== '' && !fechaValida(fecha) ? 'La fecha va en aaaa-mm-dd.' : undefined}
        >
          <TextInput
            accessibilityLabel="Fecha del pago"
            placeholder="aaaa-mm-dd"
            keyboardType="numbers-and-punctuation"
            value={fecha}
            onChangeText={setFecha}
            className={CAMPO}
          />
        </Campo>

        <Campo etiqueta={respaldo.etiqueta}>
          <TextInput
            accessibilityLabel={respaldo.etiqueta}
            placeholder={respaldo.pista}
            value={referencia}
            onChangeText={setReferencia}
            className={CAMPO}
          />
          {medio === 'efectivo' && (
            <Text className="mt-1.5 text-sm text-ink-muted">
              En efectivo, el respaldo es quién lo recibió y cuándo.
            </Text>
          )}
        </Campo>

        <Campo etiqueta="Nota">
          <TextInput
            accessibilityLabel="Nota opcional"
            placeholder="Pago parcial acordado con el jefe de grupo"
            value={observacion}
            onChangeText={setObservacion}
            multiline
            className={`${CAMPO} h-20 py-3`}
          />
        </Campo>

        <Text className={`text-sm ${imputacion.tipo === 'aFavor' ? 'text-ok' : 'text-ink-muted'}`}>
          {imputacion.tipo === 'sinImporte'
            ? 'Cargá el importe recibido.'
            : imputacion.tipo === 'cancela'
              ? 'Cancela la deuda del grupo. La cuenta queda en cero.'
              : imputacion.tipo === 'parcial'
                ? `Pago parcial. Quedan ${enPesos(imputacion.resta)} de deuda.`
                : `Supera la deuda: quedan ${enPesos(imputacion.sobra)} a favor del grupo.`}
        </Text>

        {registrar.error && <Falla>{registrar.error.message}</Falla>}

        <Boton
          disabled={!puede || registrar.isPending}
          onPress={() =>
            registrar.mutate(
              {
                grupoId: id,
                fecha,
                importe: monto,
                medioDePago: medio,
                referencia,
                observacion,
              },
              { onSuccess: () => router.replace(volver) },
            )
          }
        >
          {registrar.isPending ? 'Asentando…' : 'Asentar pago'}
        </Boton>
      </View>
    </ScrollView>
  )
}
