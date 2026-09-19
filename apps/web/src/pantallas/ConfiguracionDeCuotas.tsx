import { useDefinirCuotaDeAfiliacion, useTesoreria } from '@gps/api'
import { type FormEvent, useState } from 'react'
import { Link } from 'wouter'

const pesos = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
})

export function ConfiguracionDeCuotas() {
  const consulta = useTesoreria()
  const definir = useDefinirCuotaDeAfiliacion()
  const [periodoElegido, setPeriodoElegido] = useState('')
  const [importe, setImporte] = useState('')
  const periodos = consulta.data?.periodosConfigurablesDeAfiliacion ?? []
  const periodo = periodoElegido || String(periodos[0] ?? '')

  function guardar(evento: FormEvent) {
    evento.preventDefault()
    definir.mutate({ periodo: Number(periodo), importe: Number(importe) })
  }

  return (
    <>
      <Link href="/tesoreria" className="mt-6 inline-block text-sm text-slate-500">
        ← Tesorería
      </Link>
      <h2 className="mt-1 text-lg font-semibold">Configuración de cuotas</h2>
      <p className="mt-1 text-sm text-slate-500">
        Cada período comienza en marzo y conserva su importe histórico.
      </p>

      <form onSubmit={guardar} className="mt-6 space-y-3 rounded-lg bg-white p-4 shadow-sm">
        <label className="block text-sm text-slate-700">
          Período de afiliación
          <select
            required
            value={periodo}
            onChange={(evento) => setPeriodoElegido(evento.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
          >
            {periodos.map((uno) => (
              <option key={uno} value={uno}>
                {uno} — marzo {uno} a febrero {uno + 1}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm text-slate-700">
          Importe en pesos
          <input
            type="number"
            min="1"
            step="1"
            required
            value={importe}
            onChange={(evento) => setImporte(evento.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
          />
        </label>
        <button
          type="submit"
          disabled={definir.isPending || periodo === ''}
          className="w-full rounded bg-slate-900 px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
        >
          {definir.isPending ? 'Guardando…' : 'Guardar cuota'}
        </button>
        {definir.error && <p className="text-sm text-red-700">{definir.error.message}</p>}
      </form>

      <section className="mt-6">
        <h3 className="text-sm font-semibold">Historial</h3>
        <ul className="mt-2 divide-y divide-slate-200 overflow-hidden rounded-lg bg-white shadow-sm">
          {(consulta.data?.cuotasDeAfiliacion ?? []).map((cuota) => (
            <li key={cuota.periodo} className="flex justify-between px-4 py-3 text-sm">
              <span>Período {cuota.periodo}</span>
              <strong>{pesos.format(cuota.importe)}</strong>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}
