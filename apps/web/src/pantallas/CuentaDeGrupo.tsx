import {
  type MedioDePago,
  useActor,
  useAnularPago,
  useCuentaDeGrupo,
  useRegistrarPago,
  useTesoreria,
} from '@gps/api'
import { puedeRegistrarPagos, puedeVerTesoreriaDeLaDiocesis } from '@gps/tesoreria/dominio'
import { type FormEvent, useState } from 'react'
import { Link } from 'wouter'

const pesos = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
})

const CAMPO =
  'w-full rounded-lg border border-line-strong bg-surface-2 px-3 text-base text-ink placeholder:text-ink-faint focus:border-ink focus:outline-none'

/** Asentar un pago recibido por fuera de GPS. Sólo Tesorería diocesana: la
 *  jefatura lee su cuenta pero no la escribe, y ofrecerle el formulario sería
 *  ofrecerle algo que el servidor después rechaza. */
function RegistrarPago(props: { grupoId: string }) {
  const registrar = useRegistrarPago()
  const [fecha, setFecha] = useState('')
  const [importe, setImporte] = useState('')
  const [medio, setMedio] = useState<MedioDePago>('transferencia')
  const [referencia, setReferencia] = useState('')
  const [observacion, setObservacion] = useState('')

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
      {
        onSuccess: () => {
          setImporte('')
          setReferencia('')
          setObservacion('')
        },
      },
    )
  }

  return (
    <section className="mt-6 border-t border-line pt-5">
      <h3 className="text-lg font-bold">Registrar pago externo</h3>
      {/* En GPS no se paga: se asienta que se pagó. */}
      <p className="mt-0.5 text-sm text-ink-muted">
        El grupo paga por fuera de GPS. Acá se asienta lo recibido y se imputa a la deuda.
      </p>
      <form onSubmit={enviar} className="mt-3 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <label className="text-label font-medium text-ink-muted">
            Fecha
            <input
              type="date"
              required
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className={`${CAMPO} mt-1 h-12 tabular-nums`}
            />
          </label>
          <label className="text-label font-medium text-ink-muted">
            Importe
            <input
              inputMode="numeric"
              required
              value={importe}
              onChange={(e) => setImporte(e.target.value)}
              className={`${CAMPO} mt-1 h-12 tabular-nums`}
            />
          </label>
        </div>
        <label className="block text-label font-medium text-ink-muted">
          Medio
          <select
            value={medio}
            onChange={(e) => setMedio(e.target.value as MedioDePago)}
            className={`${CAMPO} mt-1 h-12`}
          >
            <option value="transferencia">Transferencia</option>
            <option value="efectivo">Efectivo</option>
            <option value="otro">Otro</option>
          </select>
        </label>
        <label className="block text-label font-medium text-ink-muted">
          Referencia opcional
          <input
            value={referencia}
            onChange={(e) => setReferencia(e.target.value)}
            className={`${CAMPO} mt-1 h-12`}
          />
        </label>
        <label className="block text-label font-medium text-ink-muted">
          Observación opcional
          <textarea
            value={observacion}
            onChange={(e) => setObservacion(e.target.value)}
            className={`${CAMPO} mt-1 py-2.5`}
          />
        </label>
        <button
          type="submit"
          disabled={registrar.isPending}
          className="flex min-h-12 w-full items-center justify-center rounded-lg bg-accent px-4 text-base font-semibold text-accent-ink hover:bg-accent-strong disabled:opacity-40"
        >
          {registrar.isPending ? 'Registrando…' : 'Asentar pago'}
        </button>
      </form>
      {registrar.error && (
        <p className="mt-2 rounded-lg bg-danger-soft p-3 text-sm break-words text-danger">
          {registrar.error.message}
        </p>
      )}
    </section>
  )
}

export function CuentaDeGrupo(props: { grupoId: string }) {
  const resumen = useTesoreria()
  const consulta = useCuentaDeGrupo(props.grupoId)
  const anular = useAnularPago(props.grupoId)
  const actor = useActor()

  const cuenta = resumen.data?.cuentasDeGrupos.find((una) => una.grupoId === props.grupoId)
  const movimientos = consulta.data?.movimientosDeTesoreria ?? []
  const pagosAnulados = new Set(movimientos.map((uno) => uno.anulaA).filter(Boolean))

  const escribe = actor !== null && puedeRegistrarPagos(actor)
  // A dónde vuelve depende de por dónde entró: la jefatura llega desde su
  // grupo y no tiene el panorama diocesano, así que mandarla a /tesorería la
  // deja en una pantalla que no puede ver.
  const volver =
    actor !== null && puedeVerTesoreriaDeLaDiocesis(actor)
      ? { href: '/tesoreria', texto: '← Tesorería' }
      : { href: `/grupos/${props.grupoId}`, texto: '← Grupo' }

  return (
    <>
      <Link href={volver.href} className="text-label text-ink-muted hover:text-ink">
        {volver.texto}
      </Link>
      <h2 className="mt-1 text-2xl font-bold">
        {cuenta ? `Grupo ${cuenta.numero} — ${cuenta.nombre}` : 'Cuenta del grupo'}
      </h2>

      {cuenta && (
        <section className="mt-4">
          <h3 className="font-semibold">Cuenta corriente</h3>
          {/* El saldo positivo es deuda: así lo guarda tesorería. El signo se
              escribe, no se deduce del color. */}
          <p
            className={`mt-1.5 text-2xl font-bold tabular-nums ${cuenta.saldo > 0 ? 'text-danger' : 'text-ink'}`}
          >
            {cuenta.saldo > 0 ? '−' : ''}
            {pesos.format(Math.abs(cuenta.saldo))}
          </p>
          <p className="mt-0.5 text-sm text-ink-muted">
            {cuenta.saldo > 0 ? 'De deuda' : cuenta.saldo < 0 ? 'A favor del grupo' : 'Sin deuda'}.
          </p>
        </section>
      )}

      {escribe && <RegistrarPago grupoId={props.grupoId} />}

      <section className="mt-6 border-t border-line pt-5">
        <h3 className="text-lg font-bold">Movimientos</h3>
        {consulta.isPending && <p className="mt-3 text-sm text-ink-muted">Consultando…</p>}
        {consulta.error && (
          <p className="mt-3 rounded-lg bg-danger-soft p-3 text-sm break-words text-danger">
            {consulta.error.message}
          </p>
        )}
        <ul className="mt-2">
          {movimientos.map((movimiento) => (
            <li key={movimiento.id} className="border-b border-line py-3 last:border-b-0">
              <div className="flex items-baseline justify-between gap-3">
                <span className="tabular-nums">
                  {movimiento.fecha} ·{' '}
                  {movimiento.tipo === 'cargo_afiliacion'
                    ? 'Afiliación'
                    : movimiento.tipo === 'pago'
                      ? 'Pago'
                      : 'Anulación de pago'}
                </span>
                {/* Un cargo suma deuda y un pago la baja: el signo dice de qué
                    lado va el movimiento, no si el número es grande. */}
                <strong className="shrink-0 tabular-nums">
                  {movimiento.tipo === 'pago' ? '−' : '+'}
                  {pesos.format(movimiento.importe)}
                </strong>
              </div>
              {movimiento.cantidad && (
                <p className="mt-0.5 text-label tabular-nums text-ink-muted">
                  {movimiento.cantidad} × {pesos.format(movimiento.cuota ?? 0)}
                </p>
              )}
              {movimiento.referencia && (
                <p className="mt-0.5 text-label text-ink-muted">
                  Referencia: {movimiento.referencia}
                </p>
              )}
              {/* El pago no se edita: si está mal, se anula y se carga de
                  nuevo. Queda el rastro de los dos asientos. */}
              {escribe && movimiento.tipo === 'pago' && !pagosAnulados.has(movimiento.id) && (
                <button
                  type="button"
                  disabled={anular.isPending}
                  onClick={() => anular.mutate({ pagoId: movimiento.id })}
                  className="mt-1.5 min-h-9 text-label text-ink-faint hover:text-danger disabled:opacity-40"
                >
                  Anular pago
                </button>
              )}
            </li>
          ))}
        </ul>
        {movimientos.length === 0 && !consulta.isPending && (
          <p className="mt-2 text-sm text-ink-muted">La cuenta todavía no tiene movimientos.</p>
        )}
        {anular.error && (
          <p className="mt-2 rounded-lg bg-danger-soft p-3 text-sm break-words text-danger">
            {anular.error.message}
          </p>
        )}
      </section>
    </>
  )
}
