import { useTesoreria } from '@gps/api'
import { Accion, Cargando, Falla, FILA, Titulo, Vacio, Volver } from '../ui'

const pesos = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
})

/** El historial de cuotas. Definir una es una tarea que termina y tiene su
 *  propia pantalla: acá sólo se mira lo que ya está, con la acción arriba. */
export function ConfiguracionDeCuotas() {
  const consulta = useTesoreria()
  const cuotas = consulta.data?.cuotasDeAfiliacion ?? []

  return (
    <>
      <Volver href="/tesoreria">Tesorería</Volver>
      <Titulo acompaña="Cada período comienza en marzo y conserva su importe histórico.">
        Cuotas de afiliación
      </Titulo>

      <div className="mt-5">
        <Accion href="/tesoreria/configuracion/nueva">Definir una cuota</Accion>
      </div>

      {consulta.isPending && <Cargando>Consultando…</Cargando>}
      {consulta.error && <Falla>{consulta.error.message}</Falla>}

      <ul className="mt-5">
        {cuotas.map((cuota) => (
          <li key={cuota.periodo} className={`${FILA} justify-between`}>
            <span className="text-sm font-semibold tabular-nums">
              Período {cuota.periodo}
              <span className="ml-2 font-normal text-ink-muted">
                marzo {cuota.periodo} a febrero {cuota.periodo + 1}
              </span>
            </span>
            <strong className="shrink-0 text-sm tabular-nums">{pesos.format(cuota.importe)}</strong>
          </li>
        ))}
      </ul>
      {cuotas.length === 0 && !consulta.isPending && (
        <Vacio>Todavía no hay ninguna cuota definida.</Vacio>
      )}
    </>
  )
}
