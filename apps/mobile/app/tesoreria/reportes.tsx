import { periodoDe } from '@gps/afiliacion/dominio'
import { useReporteDeCobranza } from '@gps/api'
import { variacion } from '@gps/tesoreria/dominio'
import { useState } from 'react'
import { Text, View } from 'react-native'
import {
  Cargando,
  Falla,
  Filtros,
  Pantalla,
  pesos,
  Titulo,
  Vacio,
  Volver,
} from '../../componentes/ui'

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
    <View className="min-h-14 flex-row items-center justify-between gap-3 border-b border-line py-2">
      <Text numberOfLines={1} className="shrink text-base font-semibold text-ink">
        {props.concepto}
      </Text>
      <View className="shrink-0 flex-row items-baseline gap-2.5">
        <Text className="text-base text-ink">{formatear(props.ahora)}</Text>
        <Text
          className={`text-sm font-semibold ${absoluta > 0 ? 'text-ok' : absoluta < 0 ? 'text-danger' : 'text-ink-muted'}`}
        >
          {delta}
        </Text>
      </View>
    </View>
  )
}

export default function Pantalla_() {
  const mirables = periodosMirables(new Date())
  const [periodo, setPeriodo] = useState(mirables[0] as number)
  const consulta = useReporteDeCobranza(periodo)
  const reporte = consulta.data?.reporteDeCobranza

  return (
    <Pantalla>
      <Volver href="/tesoreria">Tesorería</Volver>
      <Titulo acompaña="Cómo viene la cobranza de la temporada, por distrito y contra el período anterior.">
        Reportes
      </Titulo>

      <View className="mt-5">
        <Filtros
          opciones={mirables.map((uno) => ({
            id: String(uno),
            etiqueta: `${uno}-03 → ${uno + 1}-02`,
          }))}
          valor={String(periodo)}
          onElegir={(elegido) => setPeriodo(Number(elegido))}
        />
      </View>

      {consulta.isPending && <Cargando>Armando el reporte…</Cargando>}
      {consulta.error && <Falla>{consulta.error.message}</Falla>}
      {consulta.data && !reporte && (
        <View className="mt-4 rounded-lg bg-surface-3 p-3">
          <Text className="text-sm text-ink-muted">
            El reporte de cobranza lo ve la Tesorería diocesana.
          </Text>
        </View>
      )}

      {reporte && (
        <>
          <Text className="mt-6 text-lg font-bold text-ink">Cobranza por distrito</Text>
          <View className="mt-2">
            {reporte.porDistrito.map((fila) => (
              <View key={fila.distritoId} className="gap-2 border-b border-line py-3.5">
                <View className="flex-row items-baseline justify-between gap-3">
                  <Text className="shrink text-base font-semibold text-ink">
                    Distrito {fila.numero}
                    <Text className="font-normal text-ink-muted"> {fila.zona}</Text>
                  </Text>
                  <Text className="shrink-0 text-label text-ink-muted">
                    {fila.declararon} de {fila.grupos} declararon
                  </Text>
                </View>
                {/* La barra dice lo mismo que el cociente de arriba, pero de un
                    vistazo: en el teléfono no hay columnas que comparar. */}
                <View
                  accessibilityRole="image"
                  accessibilityLabel={`${fila.declararon} de ${fila.grupos} grupos declararon`}
                  className="h-2 overflow-hidden rounded-full bg-surface-3"
                >
                  <View
                    className="h-full rounded-full bg-ok"
                    style={{
                      width: `${fila.grupos === 0 ? 0 : (fila.declararon / fila.grupos) * 100}%`,
                    }}
                  />
                </View>
                <View className="flex-row justify-between gap-3">
                  <View className="gap-0.5">
                    <Text className="text-label text-ink-muted">Cobrado</Text>
                    <Text className="text-base font-semibold text-ok">
                      {pesos.format(fila.cobrado)}
                    </Text>
                  </View>
                  <View className="items-end gap-0.5">
                    <Text className="text-label text-ink-muted">Deuda</Text>
                    <Text
                      className={`text-base font-semibold ${fila.deuda > 0 ? 'text-danger' : 'text-ink-muted'}`}
                    >
                      {pesos.format(fila.deuda)}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>

          {reporte.porDistrito.length === 0 && <Vacio>Todavía no hay ningún distrito.</Vacio>}

          <View className="mt-4 flex-row justify-between gap-3 rounded-lg bg-surface-3 p-3">
            <Text className="shrink text-sm text-ink-muted">
              {reporte.totales.distritos} distritos · {reporte.totales.grupos} grupos ·{' '}
              {reporte.totales.declararon} declararon
            </Text>
            <Text className="shrink-0 text-sm font-bold text-ink">
              {pesos.format(reporte.totales.deuda)}
            </Text>
          </View>

          <Text className="mt-6 text-lg font-bold text-ink">Contra el período anterior</Text>
          {/* La decisión del mockup, y es la de la guía: sin gráficos. */}
          <Text className="mt-1 text-sm text-ink-muted">
            Sin gráficos: la comparación entre dos períodos es una lista con la variación escrita
            con signo.
          </Text>
          <View className="mt-2">
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
          </View>

          {/* La definición que hace falta leer una vez para no leer mal la
              tabla: lo cobrado va por la fecha del pago. */}
          <Text className="mt-6 text-sm text-ink-faint">
            Lo facturado sale de los cargos del período. Lo cobrado, de los pagos con fecha adentro
            del período —un pago se asienta contra la cuenta del grupo, no contra un período—, así
            que un grupo que paga tarde una deuda vieja suma acá. La deuda de esta tabla es
            facturado menos cobrado, y no el saldo de las cuentas: ése está en Deuda.
          </Text>
        </>
      )}
    </Pantalla>
  )
}
