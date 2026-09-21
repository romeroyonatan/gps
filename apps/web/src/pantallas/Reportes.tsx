import { periodoDe } from '@gps/afiliacion/dominio'
import { useReporteDeCobranza } from '@gps/api'
import { variacion } from '@gps/tesoreria/dominio'
import { useState } from 'react'
import { Cargando, Falla, Filtros, Nota, Titulo, Vacio, Volver } from '../ui'

const pesos = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
})
const entero = new Intl.NumberFormat('es-AR')
const porciento = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 })

/** Los períodos que se pueden mirar: el corriente y los dos anteriores. Sale
 *  del almanaque y no de una consulta —`periodoDe` es la misma regla con la
 *  que Afiliación parte la historia—, así que no hay una lista que mantener. */
function periodosMirables(hoy: Date): readonly number[] {
  const actual = periodoDe(hoy.toLocaleDateString('en-CA'))
  return [actual, actual - 1, actual - 2]
}

/** El signo se escribe siempre, también el más: "117" no dice si subió. */
const conSigno = (numero: number, texto: string) =>
  `${numero > 0 ? '+' : numero < 0 ? '−' : ''}${texto}`

/** Una fila de la evolución. Las cantidades se comparan en absoluto y la plata
 *  en porcentaje: "+117 personas" se entiende y "+5,9 % de personas" no. */
function FilaDeEvolucion(props: {
  concepto: string
  antes: number
  ahora: number
  comoPlata?: boolean
}) {
  const { absoluta, porcentaje } = variacion(props.antes, props.ahora)
  const formatear = (numero: number) =>
    props.comoPlata ? pesos.format(numero) : entero.format(numero)
  const delta =
    props.comoPlata && porcentaje !== null
      ? conSigno(porcentaje, `${porciento.format(Math.abs(porcentaje))} %`)
      : conSigno(absoluta, formatear(Math.abs(absoluta)))

  return (
    <li className="grid min-h-14 grid-cols-[1fr_auto] items-center gap-x-4 gap-y-0.5 border-b border-line py-2 md:grid-cols-[1fr_8rem_8rem_7rem]">
      <span className="col-start-1 font-semibold">{props.concepto}</span>
      {/* En el teléfono el período anterior no entra: lo que importa es el
          número de hoy y cuánto se movió. */}
      <span className="hidden text-right tabular-nums text-ink-muted md:block">
        {formatear(props.antes)}
      </span>
      <span className="col-start-2 row-start-1 text-right tabular-nums md:col-start-3">
        {formatear(props.ahora)}
      </span>
      <span
        className={`col-start-2 text-right font-semibold tabular-nums md:col-start-4 ${
          absoluta > 0 ? 'text-ok' : absoluta < 0 ? 'text-danger' : 'text-ink-muted'
        }`}
      >
        {delta}
      </span>
    </li>
  )
}

export function Reportes() {
  const mirables = periodosMirables(new Date())
  const [periodo, setPeriodo] = useState(mirables[0] as number)
  const consulta = useReporteDeCobranza(periodo)
  const reporte = consulta.data?.reporteDeCobranza

  return (
    <>
      <Volver href="/tesoreria">Tesorería</Volver>
      <Titulo acompaña="Cómo viene la cobranza de la temporada, por distrito y contra el período anterior.">
        Reportes
      </Titulo>

      <div className="mt-5">
        <Filtros
          opciones={mirables.map((uno) => ({
            id: String(uno),
            etiqueta: `${uno}-03 → ${uno + 1}-02`,
          }))}
          valor={String(periodo)}
          onElegir={(elegido) => setPeriodo(Number(elegido))}
        />
      </div>

      {consulta.isPending && <Cargando>Armando el reporte…</Cargando>}
      {consulta.error && <Falla>{consulta.error.message}</Falla>}
      {consulta.data && !reporte && (
        <Nota>El reporte de cobranza lo ve la Tesorería diocesana.</Nota>
      )}

      {reporte && (
        <>
          <section className="mt-5 md:rounded-xl md:border md:border-line-strong">
            <h3 className="text-lg font-bold md:border-b md:border-line md:p-4">
              Cobranza por distrito
            </h3>

            <div className="hidden md:grid md:grid-cols-[1fr_5rem_6rem_8rem_8rem_8rem] md:gap-4 md:border-b md:border-line md:px-4 md:py-2.5 md:text-label md:text-ink-muted">
              <span>Distrito</span>
              <span className="text-right">Grupos</span>
              <span className="text-right">Declararon</span>
              <span className="text-right">Facturado</span>
              <span className="text-right">Cobrado</span>
              <span className="text-right">Deuda</span>
            </div>

            <ul className="mt-2 md:mt-0">
              {reporte.porDistrito.map((fila) => (
                <li
                  key={fila.distritoId}
                  className="grid grid-cols-2 gap-x-4 gap-y-2 border-b border-line py-3.5 md:grid-cols-[1fr_5rem_6rem_8rem_8rem_8rem] md:items-center md:gap-y-0 md:px-4 md:py-0 md:min-h-14"
                >
                  <span className="col-span-2 flex items-baseline justify-between gap-3 md:col-span-1 md:block">
                    <span className="font-semibold">
                      Distrito {fila.numero}
                      <span className="ml-2 font-normal text-ink-muted">{fila.zona}</span>
                    </span>
                    {/* En el teléfono no hay columnas donde poner el cociente,
                        así que se escribe al lado del nombre. */}
                    <span className="text-label tabular-nums text-ink-muted md:hidden">
                      {fila.declararon} de {fila.grupos} declararon
                    </span>
                  </span>

                  {/* La barra es del teléfono: en la tabla las dos columnas ya
                      dicen lo mismo y con más precisión. */}
                  <span
                    className="col-span-2 h-2 overflow-hidden rounded-full bg-surface-3 md:hidden"
                    role="img"
                    aria-label={`${fila.declararon} de ${fila.grupos} grupos declararon`}
                  >
                    <span
                      className="block h-full rounded-full bg-ok"
                      style={{
                        width: `${fila.grupos === 0 ? 0 : (fila.declararon / fila.grupos) * 100}%`,
                      }}
                    />
                  </span>

                  <span className="hidden text-right tabular-nums text-ink-muted md:block">
                    {fila.grupos}
                  </span>
                  <span className="hidden text-right tabular-nums md:block">{fila.declararon}</span>
                  <span className="hidden text-right tabular-nums md:block">
                    {pesos.format(fila.facturado)}
                  </span>

                  <span className="flex flex-col gap-0.5 md:block md:text-right">
                    <span className="text-label text-ink-muted md:hidden">Cobrado</span>
                    <span className="font-semibold tabular-nums text-ok md:font-normal">
                      {pesos.format(fila.cobrado)}
                    </span>
                  </span>
                  <span className="flex flex-col items-end gap-0.5 md:block md:text-right">
                    <span className="text-label text-ink-muted md:hidden">Deuda</span>
                    <span
                      className={`font-semibold tabular-nums ${fila.deuda > 0 ? 'text-danger' : 'text-ink-muted'}`}
                    >
                      {pesos.format(fila.deuda)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>

            {reporte.porDistrito.length === 0 && (
              <div className="md:p-4">
                <Vacio>Todavía no hay ningún distrito.</Vacio>
              </div>
            )}

            <div className="mt-4 flex flex-wrap justify-between gap-3 rounded-lg bg-surface-3 px-4 py-3 text-sm md:mt-0 md:rounded-none md:rounded-b-xl">
              <span className="tabular-nums text-ink-muted">
                {reporte.totales.distritos} distritos · {reporte.totales.grupos} grupos ·{' '}
                {reporte.totales.declararon} declararon
              </span>
              <strong className="tabular-nums">
                Deuda total {pesos.format(reporte.totales.deuda)}
              </strong>
            </div>
          </section>

          <section className="mt-6 md:rounded-xl md:border md:border-line-strong md:p-4">
            <h3 className="text-lg font-bold">Evolución entre períodos</h3>
            {/* La decisión del mockup, y es la de la guía: sin gráficos. */}
            <p className="mt-1 max-w-[66ch] text-sm text-ink-muted">
              Sin gráficos: la comparación entre dos períodos es una tabla con la variación escrita
              con signo. Un gráfico acá no agrega nada que la cifra no diga.
            </p>

            <div className="mt-4 hidden md:grid md:grid-cols-[1fr_8rem_8rem_7rem] md:gap-4 md:border-b md:border-line md:pb-2.5 md:text-label md:text-ink-muted">
              <span>Concepto</span>
              <span className="text-right tabular-nums">{reporte.anterior.periodo}-03</span>
              <span className="text-right tabular-nums">{reporte.periodo}-03</span>
              <span className="text-right">Variación</span>
            </div>

            <ul className="mt-2 md:mt-0">
              <FilaDeEvolucion
                concepto="Personas cobradas"
                antes={reporte.anterior.personasCobradas}
                ahora={reporte.totales.personasCobradas}
              />
              <FilaDeEvolucion
                concepto="Grupos que declararon"
                antes={reporte.anterior.declararon}
                ahora={reporte.totales.declararon}
              />
              <FilaDeEvolucion
                concepto="Facturado"
                antes={reporte.anterior.facturado}
                ahora={reporte.totales.facturado}
                comoPlata
              />
              <FilaDeEvolucion
                concepto="Cobrado"
                antes={reporte.anterior.cobrado}
                ahora={reporte.totales.cobrado}
                comoPlata
              />
            </ul>
          </section>

          {/* La definición que hace falta leer una vez para no leer mal la
              tabla: lo cobrado va por la fecha del pago. */}
          <p className="mt-4 max-w-[66ch] text-sm text-ink-faint">
            Lo facturado sale de los cargos del período. Lo cobrado, de los pagos con fecha adentro
            del período —un pago se asienta contra la cuenta del grupo, no contra un período—, así
            que un grupo que paga tarde una deuda vieja suma acá. La deuda de esta tabla es
            facturado menos cobrado, y no el saldo de las cuentas: ése está en Deuda.
          </p>
        </>
      )}
    </>
  )
}
