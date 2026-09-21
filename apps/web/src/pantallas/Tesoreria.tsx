import { useGenerarDeudasPendientes, useTesoreria } from '@gps/api'
import { useState } from 'react'
import { Link } from 'wouter'
import {
  BOTON_PRINCIPAL,
  BOTON_SECUNDARIO,
  CAMPO,
  Cargando,
  Chip,
  Falla,
  Filtros,
  Pendiente,
  PIE_DE_TABLA,
  pesos,
  TABLA,
  Titulo,
  Vacio,
  Volver,
} from '../ui'

type Filtro = 'todos' | 'deuda' | 'favor' | 'cero'

const FILTROS = [
  { id: 'todos', etiqueta: 'Todos' },
  { id: 'deuda', etiqueta: 'A cobrar' },
  { id: 'favor', etiqueta: 'A favor' },
  { id: 'cero', etiqueta: 'Sin deuda' },
] as const satisfies readonly { id: Filtro; etiqueta: string }[]

type Cuenta = NonNullable<ReturnType<typeof useTesoreria>['data']>['cuentasDeGrupos'][number]

/** El total de un lado de la cuenta, escrito grande. Dos y no cuatro: los
 *  otros dos del mockup —lo cobrado del período y los grupos sin declarar— no
 *  existen todavía como consulta, y una tarjeta que miente es peor que una
 *  tarjeta que falta. */
function Total(props: { titulo: string; importe: number; tono: 'danger' | 'ok' }) {
  const color = props.tono === 'danger' ? 'text-danger' : 'text-ok'
  return (
    <div
      className={`flex-1 rounded-lg p-4 ${props.tono === 'danger' ? 'bg-danger-soft' : 'bg-ok-soft'}`}
    >
      <p className={`text-label ${color}`}>{props.titulo}</p>
      <p className={`mt-1 text-xl font-bold tabular-nums ${color}`}>
        {pesos.format(props.importe)}
      </p>
    </div>
  )
}

export function Tesoreria() {
  const consulta = useTesoreria()
  const generar = useGenerarDeudasPendientes()
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [busqueda, setBusqueda] = useState('')

  const todas = consulta.data?.cuentasDeGrupos ?? []
  const pendientes = consulta.data?.deudasPendientes
  // Null quiere decir "esto no es para vos": el enlace a configurar cuotas no
  // se muestra si no se van a poder configurar.
  const configura = consulta.data?.periodosConfigurablesDeAfiliacion != null

  const buscado = busqueda.trim().toLowerCase()
  const cuentas = todas.filter((cuenta) => {
    if (buscado && !`${cuenta.numero} ${cuenta.nombre}`.toLowerCase().includes(buscado))
      return false
    if (filtro === 'deuda') return cuenta.saldo > 0
    if (filtro === 'favor') return cuenta.saldo < 0
    if (filtro === 'cero') return cuenta.saldo === 0
    return true
  })

  const sumar = (cuáles: readonly Cuenta[], signo: 1 | -1) =>
    cuáles.reduce((total, una) => total + (una.saldo * signo > 0 ? Math.abs(una.saldo) : 0), 0)

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

      {todas.length > 0 && (
        <section className="mt-5 flex gap-3">
          <Total titulo="Deuda total" importe={sumar(todas, 1)} tono="danger" />
          <Total titulo="A favor" importe={sumar(todas, -1)} tono="ok" />
        </section>
      )}

      {pendientes && pendientes.cantidad > 0 && (
        <Pendiente>
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
        </Pendiente>
      )}

      <section className={TABLA}>
        {/* Buscar antes que filtrar: se busca por nombre, y los recortes por
            estado quedan en las píldoras al lado. */}
        <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:border-b md:border-line md:p-4">
          <input
            type="search"
            aria-label="Buscar grupo"
            placeholder="Buscar grupo"
            value={busqueda}
            onChange={(evento) => setBusqueda(evento.target.value)}
            className={`${CAMPO} h-12 md:h-10 md:min-w-[200px] md:flex-1`}
          />
          <Filtros opciones={FILTROS} valor={filtro} onElegir={setFiltro} />
        </div>

        {/* Los nombres de las columnas sólo existen cuando hay columnas. */}
        {cuentas.length > 0 && (
          <div className="hidden md:grid md:grid-cols-[1fr_9rem_11rem_9rem] md:items-center md:gap-4 md:border-b md:border-line md:px-4 md:py-2.5 md:text-label md:text-ink-muted">
            <span>Grupo</span>
            <span>Estado</span>
            <span className="text-right">Saldo</span>
            <span />
          </div>
        )}

        <ul className="mt-2 md:mt-0">
          {cuentas.map((cuenta) => (
            // La fila es el enlace, y "Cargar pago" es un enlace hermano: uno
            // adentro del otro no es HTML válido ni se puede tabular.
            <li key={cuenta.grupoId} className="flex items-center border-b border-line md:px-4">
              <Link
                href={`/tesoreria/grupos/${cuenta.grupoId}`}
                className="grid min-h-[88px] flex-1 grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1.5 py-3.5 hover:bg-surface-3 md:col-start-auto md:min-h-14 md:grid-cols-[1fr_9rem_11rem] md:gap-y-0 md:py-0"
              >
                <span className="col-start-1 row-start-1 truncate font-semibold md:row-start-1">
                  Grupo Scout Nº{cuenta.numero} — {cuenta.nombre}
                </span>
                <span className="col-start-1 row-start-2 flex items-center gap-2 md:col-start-2 md:row-start-1">
                  <Chip tono={cuenta.saldo > 0 ? 'warn' : cuenta.saldo < 0 ? 'ok' : 'neutro'}>
                    {cuenta.saldo > 0 ? 'A cobrar' : cuenta.saldo < 0 ? 'A favor' : 'Sin deuda'}
                  </Chip>
                  {cuenta.cerrado && (
                    <span className="text-label text-ink-faint">Grupo cerrado</span>
                  )}
                </span>
                {/* El signo y la palabra dicen de qué lado va el saldo; el
                    color es refuerzo, nunca el dato. */}
                <span className="col-start-2 row-span-2 row-start-1 flex flex-col items-end gap-1 md:col-start-3 md:row-span-1 md:flex-row md:items-baseline md:justify-end md:gap-2">
                  <strong
                    className={`text-lg tabular-nums md:text-base ${cuenta.saldo > 0 ? 'text-danger' : cuenta.saldo < 0 ? 'text-ok' : 'text-ink-faint'}`}
                  >
                    {cuenta.saldo === 0 ? '—' : pesos.format(Math.abs(cuenta.saldo))}
                  </strong>
                  <span className="text-label text-ink-faint">
                    {cuenta.saldo > 0 ? 'de deuda' : cuenta.saldo < 0 ? 'a favor' : 'al día'}
                  </span>
                </span>
              </Link>
              {/* El atajo del mockup: en escritorio la tesorera cobra de a
                  varios y no quiere entrar a la cuenta para asentar cada uno.
                  En el teléfono no está: la fila entera ya es el camino. */}
              {cuenta.saldo > 0 && (
                <Link
                  href={`/tesoreria/grupos/${cuenta.grupoId}/pago`}
                  className={`${BOTON_SECUNDARIO} hidden md:ml-4 md:inline-flex md:w-[7.5rem] md:shrink-0`}
                >
                  Cargar pago
                </Link>
              )}
            </li>
          ))}
        </ul>

        {cuentas.length === 0 && !consulta.isPending && (
          <div className="md:p-4">
            <Vacio>Ningún grupo coincide. Probá con otro filtro o limpiá la búsqueda.</Vacio>
          </div>
        )}

        {/* El pie del mockup: el filtro cambia la pregunta, así que el total
            tiene que cambiar con ella. */}
        {cuentas.length > 0 && (
          <div className={PIE_DE_TABLA}>
            <span className="text-ink-muted">
              {cuentas.length} {cuentas.length === 1 ? 'grupo' : 'grupos'}
            </span>
            <strong className="tabular-nums">
              Deuda filtrada {pesos.format(sumar(cuentas, 1))}
            </strong>
          </div>
        )}
      </section>

      {/* La deuda no se arma a mano: la genera cada declaración de nómina. */}
      <p className="mt-4 max-w-[66ch] text-sm text-ink-faint">
        La deuda de un grupo es la suma de sus cargos de afiliación no pagados. No se edita a mano:
        si un importe está mal, se corrige la declaración.
      </p>
    </>
  )
}
