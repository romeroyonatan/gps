import { type MedioDePago, useActor, useRegistrarPago, useTesoreria } from '@gps/api'
import {
  fechaValida,
  importeEnPesosValido,
  imputacionDelPago,
  puedeRegistrarPagos,
} from '@gps/tesoreria/dominio'
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { Pressable, Text, TextInput, View } from 'react-native'
import {
  BotonPrincipal,
  CAMPO,
  Campo,
  Falla,
  Filtros,
  Pantalla,
  pesos,
  Titulo,
  Volver,
} from '../../../../componentes/ui'

const MEDIOS = [
  { id: 'transferencia', etiqueta: 'Transferencia' },
  { id: 'efectivo', etiqueta: 'Efectivo' },
  { id: 'otro', etiqueta: 'Otro' },
] as const satisfies readonly { id: MedioDePago; etiqueta: string }[]

/** Efectivo y transferencia piden respaldos distintos —quién recibió contra
 *  número de comprobante—, así que el campo cambia con el medio en vez de
 *  mostrar los dos siempre. Los dos terminan en la misma referencia. */
const RESPALDO = {
  transferencia: { etiqueta: 'Número de comprobante', pista: '0012-00458871', ayuda: undefined },
  efectivo: {
    etiqueta: 'Quién recibió',
    pista: 'Nombre de quien recibió el efectivo',
    ayuda: 'En efectivo no hay comprobante bancario: el respaldo es quién lo recibió y cuándo.',
  },
  otro: { etiqueta: 'Referencia', pista: 'Opcional', ayuda: undefined },
} as const satisfies Record<MedioDePago, { etiqueta: string; pista: string; ayuda?: string }>

/** El día de hoy en la zona del teléfono, en aaaa-mm-dd. `en-CA` es el único
 *  locale que formatea justo así, y es más corto que armarlo a mano. */
const hoy = () => new Date().toLocaleDateString('en-CA')

/** Asentar un pago recibido por fuera de GPS. Sólo Tesorería diocesana: la
 *  jefatura lee su cuenta pero no la escribe. Pantalla propia y no un bloque
 *  colgado de la cuenta: la cuenta es para leer, asentar un pago es una tarea
 *  que termina. */
export default function Pantalla_() {
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

  // La misma política pura que aplica el servidor. Quien llega de memoria a
  // esta pantalla sin poder escribir se encuentra con el motivo y no con un
  // formulario que el servidor después rechaza.
  if (actor !== null && !puedeRegistrarPagos(actor)) {
    return (
      <Pantalla>
        <Volver href={volver}>Cuenta del grupo</Volver>
        <View className="mt-4 rounded-lg bg-surface-3 p-3">
          <Text className="text-sm text-ink-muted">
            Los pagos los asienta la Tesorería diocesana.
          </Text>
        </View>
      </Pantalla>
    )
  }

  const respaldo = RESPALDO[medio]

  return (
    <Pantalla
      pie={
        // El resumen y el botón viven fijos abajo, sobre el teclado, para que
        // la consecuencia del importe se lea sin volver a subir.
        <View className="gap-2.5 border-t border-line bg-surface px-5 pt-3 pb-6">
          <Text
            className={`text-sm ${imputacion.tipo === 'aFavor' ? 'text-ok' : 'text-ink-muted'}`}
          >
            {imputacion.tipo === 'sinImporte'
              ? 'Cargá el importe recibido.'
              : imputacion.tipo === 'cancela'
                ? 'Cancela la deuda del grupo. La cuenta queda en cero.'
                : imputacion.tipo === 'parcial'
                  ? `Pago parcial. Quedan ${pesos.format(imputacion.resta)} de deuda.`
                  : `Supera la deuda: quedan ${pesos.format(imputacion.sobra)} a favor del grupo.`}
          </Text>
          <BotonPrincipal
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
                // Vuelve a la cuenta: el movimiento recién asentado es la
                // confirmación, y no hace falta inventar un cartel.
                { onSuccess: () => router.replace(volver) },
              )
            }
          >
            {registrar.isPending ? 'Asentando…' : 'Asentar pago'}
          </BotonPrincipal>
        </View>
      }
    >
      <Volver href={volver}>Cuenta del grupo</Volver>
      {/* En GPS no se paga: se asienta que se pagó. */}
      <Titulo acompaña="El grupo paga por fuera de GPS. Acá se asienta lo recibido y se imputa a la deuda.">
        Registrar pago
      </Titulo>

      {cuenta && (
        <Text className="mt-3 text-sm text-ink-muted">
          Grupo {cuenta.numero} — {cuenta.nombre} ·{' '}
          {saldo > 0 ? `deuda actual ${pesos.format(saldo)}` : 'sin deuda'}
        </Text>
      )}

      <Campo etiqueta="Medio de pago">
        <Filtros opciones={MEDIOS} valor={medio} onElegir={setMedio} />
      </Campo>

      <Campo etiqueta="Importe recibido">
        {/* El campo alto: en mostrador se tipea con una mano y el importe es
            el dato de la pantalla, no uno más de la lista. */}
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
              { etiqueta: `Deuda completa ${pesos.format(saldo)}`, valor: saldo },
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
        ayuda={fecha !== '' && !fechaValida(fecha) ? 'La fecha va en aaaa-mm-dd.' : undefined}
      >
        <TextInput
          accessibilityLabel="Fecha del pago"
          placeholder="aaaa-mm-dd"
          value={fecha}
          onChangeText={setFecha}
          className={CAMPO}
        />
      </Campo>

      <Campo etiqueta={respaldo.etiqueta} ayuda={respaldo.ayuda}>
        <TextInput
          accessibilityLabel={respaldo.etiqueta}
          placeholder={respaldo.pista}
          value={referencia}
          onChangeText={setReferencia}
          className={CAMPO}
        />
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

      {registrar.error && <Falla>{registrar.error.message}</Falla>}
    </Pantalla>
  )
}
