import { useActor, useAnularPago, useCuentaDeGrupo, useTesoreria } from '@gps/api'
import { puedeRegistrarPagos, puedeVerTesoreriaDeLaDiocesis } from '@gps/tesoreria/dominio'
import { Accion, BOTON_AL_MARGEN, Cargando, Falla, Seccion, Titulo, Vacio, Volver } from '../ui'

const pesos = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
})

const NOMBRE_DEL_MOVIMIENTO = {
  cargo_afiliacion: 'Afiliación',
  pago: 'Pago',
} as const

export function CuentaDeGrupo(props: { grupoId: string }) {
  const resumen = useTesoreria()
  const consulta = useCuentaDeGrupo(props.grupoId)
  const anular = useAnularPago(props.grupoId)
  const actor = useActor()

  const cuenta = resumen.data?.cuentasDeGrupos.find((una) => una.grupoId === props.grupoId)
  const movimientos = consulta.data?.movimientosDeTesoreria ?? []
  const pagosAnulados = new Set(movimientos.map((uno) => uno.anulaA).filter(Boolean))

  const escribe = actor !== null && puedeRegistrarPagos(actor)
  // Si hay camino de vuelta depende de por dónde se entra. Para Tesorería
  // diocesana esto cuelga de /tesorería y el enlace la devuelve al panorama.
  // Para la jefatura es una de las cinco tareas de su grupo: la barra ya la
  // tiene a la vista y un "← Grupo" arriba sólo repetiría lo que ya está.
  const desdeLaDiocesis = actor !== null && puedeVerTesoreriaDeLaDiocesis(actor)

  return (
    <>
      {desdeLaDiocesis && <Volver href="/tesoreria">Tesorería</Volver>}
      <Titulo>{cuenta ? `Grupo ${cuenta.numero} — ${cuenta.nombre}` : 'Cuenta del grupo'}</Titulo>

      {cuenta && (
        <section className="mt-5">
          {/* El saldo positivo es deuda: así lo guarda tesorería. El signo se
              escribe, no se deduce del color. */}
          <p
            className={`text-2xl font-bold tabular-nums ${cuenta.saldo > 0 ? 'text-danger' : 'text-ink'}`}
          >
            {cuenta.saldo > 0 ? '−' : ''}
            {pesos.format(Math.abs(cuenta.saldo))}
          </p>
          <p className="mt-0.5 text-sm text-ink-muted">
            {cuenta.saldo > 0 ? 'De deuda' : cuenta.saldo < 0 ? 'A favor del grupo' : 'Sin deuda'}.
          </p>
        </section>
      )}

      {/* La acción arriba de la lista y no un formulario colgado abajo:
          asentar un pago es una tarea que termina, y tiene su pantalla. */}
      {escribe && (
        <div className="mt-5">
          <Accion href={`/tesoreria/grupos/${props.grupoId}/pago`}>Registrar pago externo</Accion>
        </div>
      )}

      <Seccion titulo="Movimientos" cuantos={movimientos.length}>
        {consulta.isPending && <Cargando>Consultando…</Cargando>}
        {consulta.error && <Falla>{consulta.error.message}</Falla>}

        <ul className="mt-2">
          {movimientos.map((movimiento) => (
            <li key={movimiento.id} className="border-b border-line py-3 last:border-b-0">
              <div className="flex items-baseline justify-between gap-3">
                <span className="tabular-nums">
                  {movimiento.fecha} ·{' '}
                  {NOMBRE_DEL_MOVIMIENTO[movimiento.tipo as keyof typeof NOMBRE_DEL_MOVIMIENTO] ??
                    'Anulación de pago'}
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
                  className={`${BOTON_AL_MARGEN} mt-1.5`}
                >
                  Anular pago
                </button>
              )}
            </li>
          ))}
        </ul>

        {movimientos.length === 0 && !consulta.isPending && (
          <Vacio>La cuenta todavía no tiene movimientos.</Vacio>
        )}
        {anular.error && <Falla>{anular.error.message}</Falla>}
      </Seccion>
    </>
  )
}
