import {
  type MedioDePago,
  useAnularPago,
  useCuentaDeGrupo,
  useRegistrarPago,
  useTesoreria,
} from '@gps/api'
import { type FormEvent, useState } from 'react'
import { Link } from 'wouter'

const pesos = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
})

export function CuentaDeGrupo(props: { grupoId: string }) {
  const resumen = useTesoreria()
  const consulta = useCuentaDeGrupo(props.grupoId)
  const registrar = useRegistrarPago()
  const anular = useAnularPago(props.grupoId)
  const [fecha, setFecha] = useState('')
  const [importe, setImporte] = useState('')
  const [medio, setMedio] = useState<MedioDePago>('transferencia')
  const [referencia, setReferencia] = useState('')
  const [observacion, setObservacion] = useState('')

  const cuenta = resumen.data?.cuentasDeGrupos.find((una) => una.grupoId === props.grupoId)
  const movimientos = consulta.data?.movimientosDeTesoreria ?? []
  const pagosAnulados = new Set(movimientos.map((uno) => uno.anulaA).filter(Boolean))

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
    <>
      <Link href="/tesoreria" className="mt-6 inline-block text-sm text-slate-500">
        ← Tesorería
      </Link>
      <h2 className="mt-1 text-lg font-semibold">
        {cuenta ? `Grupo Scout Nº${cuenta.numero} - ${cuenta.nombre}` : 'Cuenta del grupo'}
      </h2>
      {cuenta && (
        <p className="mt-1 text-sm text-slate-600">
          Saldo:{' '}
          <strong>
            {pesos.format(Math.abs(cuenta.saldo))}
            {cuenta.saldo < 0 ? ' a favor' : cuenta.saldo > 0 ? ' de deuda' : ''}
          </strong>
        </p>
      )}

      <section className="mt-6 rounded-lg bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold">Registrar pago externo</h3>
        <form onSubmit={enviar} className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-slate-600">
              Fecha
              <input
                type="date"
                required
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs text-slate-600">
              Importe
              <input
                inputMode="numeric"
                required
                value={importe}
                onChange={(e) => setImporte(e.target.value)}
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
          </div>
          <label className="block text-xs text-slate-600">
            Medio
            <select
              value={medio}
              onChange={(e) => setMedio(e.target.value as MedioDePago)}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="transferencia">Transferencia</option>
              <option value="efectivo">Efectivo</option>
              <option value="otro">Otro</option>
            </select>
          </label>
          <label className="block text-xs text-slate-600">
            Referencia opcional
            <input
              value={referencia}
              onChange={(e) => setReferencia(e.target.value)}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs text-slate-600">
            Observación opcional
            <textarea
              value={observacion}
              onChange={(e) => setObservacion(e.target.value)}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <button
            type="submit"
            disabled={registrar.isPending}
            className="w-full rounded bg-slate-900 px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
          >
            {registrar.isPending ? 'Registrando…' : 'Registrar pago'}
          </button>
        </form>
        {registrar.error && <p className="mt-2 text-sm text-red-700">{registrar.error.message}</p>}
      </section>

      <section className="mt-6">
        <h3 className="text-sm font-semibold">Movimientos</h3>
        {consulta.isPending && <p className="mt-3 text-sm text-slate-500">Consultando…</p>}
        {consulta.error && <p className="mt-3 text-sm text-red-700">{consulta.error.message}</p>}
        <ul className="mt-3 divide-y divide-slate-200 overflow-hidden rounded-lg bg-white shadow-sm">
          {movimientos.map((movimiento) => (
            <li key={movimiento.id} className="px-4 py-3">
              <div className="flex justify-between gap-3 text-sm">
                <span>
                  {movimiento.fecha} ·{' '}
                  {movimiento.tipo === 'cargo_afiliacion'
                    ? 'Afiliación'
                    : movimiento.tipo === 'pago'
                      ? 'Pago'
                      : 'Anulación de pago'}
                </span>
                <strong>
                  {movimiento.tipo === 'pago' ? '−' : '+'}
                  {pesos.format(movimiento.importe)}
                </strong>
              </div>
              {movimiento.cantidad && (
                <p className="mt-1 text-xs text-slate-500">
                  {movimiento.cantidad} × {pesos.format(movimiento.cuota ?? 0)}
                </p>
              )}
              {movimiento.referencia && (
                <p className="mt-1 text-xs text-slate-500">Referencia: {movimiento.referencia}</p>
              )}
              {movimiento.tipo === 'pago' && !pagosAnulados.has(movimiento.id) && (
                <button
                  type="button"
                  disabled={anular.isPending}
                  onClick={() => anular.mutate({ pagoId: movimiento.id })}
                  className="mt-2 text-xs text-red-700 disabled:opacity-50"
                >
                  Anular pago
                </button>
              )}
            </li>
          ))}
        </ul>
        {movimientos.length === 0 && !consulta.isPending && (
          <p className="mt-3 text-sm text-slate-500">La cuenta todavía no tiene movimientos.</p>
        )}
        {anular.error && <p className="mt-2 text-sm text-red-700">{anular.error.message}</p>}
      </section>
    </>
  )
}
