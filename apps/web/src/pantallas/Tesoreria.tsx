import { useGenerarDeudasPendientes, useTesoreria } from '@gps/api'
import { useState } from 'react'
import { Link } from 'wouter'
import {
  BOTON_PRINCIPAL,
  Cargando,
  Falla,
  FILA,
  Filtros,
  Seccion,
  Titulo,
  Vacio,
  Volver,
} from '../ui'

type Filtro = 'todos' | 'deuda' | 'favor' | 'cero'

const pesos = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
})

const FILTROS = [
  { id: 'todos', etiqueta: 'Todos' },
  { id: 'deuda', etiqueta: 'Con deuda' },
  { id: 'favor', etiqueta: 'Saldo a favor' },
  { id: 'cero', etiqueta: 'Saldo cero' },
] as const satisfies readonly { id: Filtro; etiqueta: string }[]

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
      <Volver href="/">Directorio</Volver>
      <Titulo
        enlace={configura ? { texto: 'Cuotas', href: '/tesoreria/configuracion' } : undefined}
      >
        Tesorería
      </Titulo>

      {consulta.isPending && <Cargando>Consultando cuentas…</Cargando>}
      {consulta.error && <Falla>{consulta.error.message}</Falla>}

      {/* Lo que exige acción va arriba de todo, y sólo aparece si hay algo que
          hacer: un bloque destacado que dice "0" no destaca nada. */}
      {pendientes && pendientes.cantidad > 0 && (
        <section className="mt-5 rounded-lg bg-warn-soft p-4">
          <p className="font-semibold text-warn">
            Hay {pendientes.cantidad}{' '}
            {pendientes.cantidad === 1 ? 'deuda pendiente' : 'deudas pendientes'}.
          </p>
          {pendientes.periodosSinCuota.length > 0 && (
            <p className="mt-1 text-label tabular-nums text-warn">
              Falta configurar la cuota de: {pendientes.periodosSinCuota.join(', ')}.
            </p>
          )}
          <button
            type="button"
            disabled={generar.isPending}
            onClick={() => generar.mutate()}
            className={`${BOTON_PRINCIPAL} mt-3 sm:w-fit`}
          >
            {generar.isPending ? 'Generando…' : `Generar ${pendientes.cantidad} deudas pendientes`}
          </button>
        </section>
      )}

      <Seccion titulo="Cuentas de grupos" cuantos={cuentas.length}>
        <div className="mt-3">
          <Filtros opciones={FILTROS} valor={filtro} onElegir={setFiltro} />
        </div>
        <ul className="mt-3">
          {cuentas.map((cuenta) => (
            <li key={cuenta.grupoId} className="border-b border-line last:border-b-0">
              <Link
                href={`/tesoreria/grupos/${cuenta.grupoId}`}
                className={`${FILA} justify-between border-b-0 active:bg-surface-3`}
              >
                <span className="min-w-0 text-sm font-semibold">
                  Grupo Scout Nº{cuenta.numero} — {cuenta.nombre}
                  {cuenta.cerrado ? ' (cerrado)' : ''}
                </span>
                {/* El signo y la palabra dicen de qué lado va el saldo; el
                    color es refuerzo, nunca el dato. */}
                <strong
                  className={`shrink-0 text-sm tabular-nums ${cuenta.saldo > 0 ? 'text-danger' : cuenta.saldo < 0 ? 'text-ok' : 'text-ink-muted'}`}
                >
                  {pesos.format(Math.abs(cuenta.saldo))}
                  {cuenta.saldo < 0 ? ' a favor' : ''}
                </strong>
              </Link>
            </li>
          ))}
        </ul>
        {cuentas.length === 0 && !consulta.isPending && (
          <Vacio>No hay grupos para este filtro.</Vacio>
        )}
      </Seccion>
    </>
  )
}
