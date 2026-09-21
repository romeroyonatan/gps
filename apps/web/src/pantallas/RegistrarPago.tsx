import { type MedioDePago, useActor, useRegistrarPago } from '@gps/api'
import { puedeRegistrarPagos } from '@gps/tesoreria/dominio'
import { type FormEvent, useState } from 'react'
import { useLocation } from 'wouter'
import { BOTON_PRINCIPAL, CAMPO, Campo, Falla, Nota, Titulo, Volver } from '../ui'

/** Asentar un pago recibido por fuera de GPS. Sólo Tesorería diocesana: la
 *  jefatura lee su cuenta pero no la escribe.
 *
 *  Pantalla propia y no un bloque metido entre el saldo y los movimientos: la
 *  cuenta es para leer, asentar un pago es una tarea que termina. */
export function RegistrarPago(props: { grupoId: string }) {
  const registrar = useRegistrarPago()
  const actor = useActor()
  const [, navegar] = useLocation()
  const [fecha, setFecha] = useState('')
  const [importe, setImporte] = useState('')
  const [medio, setMedio] = useState<MedioDePago>('transferencia')
  const [referencia, setReferencia] = useState('')
  const [observacion, setObservacion] = useState('')

  const volver = `/tesoreria/grupos/${props.grupoId}`

  function enviar(evento: FormEvent) {
    evento.preventDefault()
    registrar.mutate(
      {
        grupoId: props.grupoId,
        fecha,
        importe: Number(importe),
        medioDePago: medio,
        referencia,
        observacion,
      },
      // Vuelve a la cuenta: el movimiento recién asentado es la confirmación.
      { onSuccess: () => navegar(volver) },
    )
  }

  // La misma política pura que aplica el servidor. Quien llega de memoria a
  // esta dirección sin poder escribir se encuentra con el motivo y no con un
  // formulario que el servidor después rechaza.
  if (actor !== null && !puedeRegistrarPagos(actor)) {
    return (
      <>
        <Volver href={volver}>Cuenta del grupo</Volver>
        <Nota>Los pagos los asienta la Tesorería diocesana.</Nota>
      </>
    )
  }

  return (
    <>
      <Volver href={volver}>Cuenta del grupo</Volver>
      {/* En GPS no se paga: se asienta que se pagó. */}
      <Titulo acompaña="El grupo paga por fuera de GPS. Acá se asienta lo recibido y se imputa a la deuda.">
        Registrar pago externo
      </Titulo>

      <form onSubmit={enviar} className="mt-6 max-w-[560px] space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Fecha">
            <input
              type="date"
              required
              value={fecha}
              onChange={(evento) => setFecha(evento.target.value)}
              className={`${CAMPO} h-13 tabular-nums`}
            />
          </Campo>
          <Campo etiqueta="Importe">
            <input
              inputMode="numeric"
              required
              value={importe}
              onChange={(evento) => setImporte(evento.target.value)}
              className={`${CAMPO} h-13 tabular-nums`}
            />
          </Campo>
        </div>

        <Campo etiqueta="Medio">
          <select
            value={medio}
            onChange={(evento) => setMedio(evento.target.value as MedioDePago)}
            className={`${CAMPO} h-13`}
          >
            <option value="transferencia">Transferencia</option>
            <option value="efectivo">Efectivo</option>
            <option value="otro">Otro</option>
          </select>
        </Campo>

        <Campo etiqueta="Referencia">
          <input
            value={referencia}
            onChange={(evento) => setReferencia(evento.target.value)}
            placeholder="Opcional"
            className={`${CAMPO} h-13`}
          />
        </Campo>

        <Campo etiqueta="Observación">
          <textarea
            value={observacion}
            onChange={(evento) => setObservacion(evento.target.value)}
            placeholder="Opcional"
            className={`${CAMPO} py-2.5`}
          />
        </Campo>

        {registrar.error && <Falla>{registrar.error.message}</Falla>}

        <button type="submit" disabled={registrar.isPending} className={BOTON_PRINCIPAL}>
          {registrar.isPending ? 'Registrando…' : 'Asentar pago'}
        </button>
      </form>
    </>
  )
}
