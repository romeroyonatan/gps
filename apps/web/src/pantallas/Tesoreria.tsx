import { useGenerarDeudasPendientes, useTesoreria } from '@gps/api'
import { useState } from 'react'
import { Link } from 'wouter'

type Filtro = 'todos' | 'deuda' | 'favor' | 'cero'
const pesos = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
})

export function Tesoreria() {
  const consulta = useTesoreria()
  const generar = useGenerarDeudasPendientes()
  const [filtro, setFiltro] = useState<Filtro>('todos')

  const cuentas = (consulta.data?.cuentasDeGrupos ?? []).filter((cuenta) => {
    if (filtro === 'deuda') return cuenta.saldo > 0
    if (filtro === 'favor') return cuenta.saldo < 0
    if (filtro === 'cero') return cuenta.saldo === 0
    return true
  })
  const pendientes = consulta.data?.deudasPendientes
  // Null quiere decir "esto no es para vos": el enlace a configurar cuotas no
  // se muestra si no se van a poder configurar.
  const configura = consulta.data?.periodosConfigurablesDeAfiliacion != null

  return (
    <>
      <Link href="/" className="mt-6 inline-block text-sm text-slate-500 hover:text-slate-900">
        ← Inicio
      </Link>
      <div className="mt-1 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Tesorería</h2>
        {configura && (
          <Link href="/tesoreria/configuracion" className="text-sm text-slate-600">
            Configurar cuotas
          </Link>
        )}
      </div>

      {consulta.isPending && <p className="mt-8 text-sm text-slate-500">Consultando cuentas…</p>}
      {consulta.error && (
        <p className="mt-6 rounded-lg bg-red-50 p-4 text-sm text-red-800">
          {consulta.error.message}
        </p>
      )}

      {pendientes && pendientes.cantidad > 0 && (
        <section className="mt-6 rounded-lg bg-amber-50 p-4">
          <p className="text-sm text-amber-900">
            Hay {pendientes.cantidad}{' '}
            {pendientes.cantidad === 1 ? 'deuda pendiente' : 'deudas pendientes'}.
          </p>
          {pendientes.periodosSinCuota.length > 0 && (
            <p className="mt-1 text-xs text-amber-800">
              Falta configurar la cuota de: {pendientes.periodosSinCuota.join(', ')}.
            </p>
          )}
          <button
            type="button"
            disabled={generar.isPending}
            onClick={() => generar.mutate()}
            className="mt-3 rounded-lg bg-amber-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {generar.isPending ? 'Generando…' : `Generar ${pendientes.cantidad} deudas pendientes`}
          </button>
        </section>
      )}

      <section className="mt-6">
        <h3 className="text-sm font-semibold">Cuentas de grupos</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          {(['todos', 'deuda', 'favor', 'cero'] as const).map((uno) => (
            <button
              key={uno}
              type="button"
              onClick={() => setFiltro(uno)}
              className={`rounded-full px-3 py-1.5 text-xs ${filtro === uno ? 'bg-slate-900 text-white' : 'bg-white text-slate-600'}`}
            >
              {uno === 'todos'
                ? 'Todos'
                : uno === 'deuda'
                  ? 'Con deuda'
                  : uno === 'favor'
                    ? 'Saldo a favor'
                    : 'Saldo cero'}
            </button>
          ))}
        </div>
        <ul className="mt-3 divide-y divide-slate-200 overflow-hidden rounded-lg bg-white shadow-sm">
          {cuentas.map((cuenta) => (
            <li key={cuenta.grupoId}>
              <Link
                href={`/tesoreria/grupos/${cuenta.grupoId}`}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <span className="text-sm">
                  Grupo Scout Nº{cuenta.numero} - {cuenta.nombre}
                  {cuenta.cerrado ? ' (cerrado)' : ''}
                </span>
                <strong
                  className={`shrink-0 text-sm ${cuenta.saldo > 0 ? 'text-red-700' : cuenta.saldo < 0 ? 'text-emerald-700' : 'text-slate-500'}`}
                >
                  {pesos.format(Math.abs(cuenta.saldo))}
                  {cuenta.saldo < 0 ? ' a favor' : ''}
                </strong>
              </Link>
            </li>
          ))}
        </ul>
        {cuentas.length === 0 && !consulta.isPending && (
          <p className="mt-3 text-sm text-slate-500">No hay grupos para este filtro.</p>
        )}
      </section>
    </>
  )
}
