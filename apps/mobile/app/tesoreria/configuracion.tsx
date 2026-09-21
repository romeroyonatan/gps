import { useDefinirCuotaDeAfiliacion, useTesoreria } from '@gps/api'
import { importeEnPesosValido } from '@gps/tesoreria/dominio'
import { useState } from 'react'
import { Text, TextInput, View } from 'react-native'
import {
  BotonPrincipal,
  CAMPO,
  Campo,
  Cargando,
  Falla,
  Filtros,
  Pantalla,
  pesos,
  Titulo,
  Vacio,
  Volver,
} from '../../componentes/ui'

export default function Pantalla_() {
  const consulta = useTesoreria()
  const definir = useDefinirCuotaDeAfiliacion()
  const [periodoElegido, setPeriodoElegido] = useState<string | null>(null)
  const [importe, setImporte] = useState('')

  const periodos = consulta.data?.periodosConfigurablesDeAfiliacion ?? []
  const cuotas = consulta.data?.cuotasDeAfiliacion ?? []
  const periodo = periodoElegido ?? (periodos[0] !== undefined ? String(periodos[0]) : null)
  const monto = Number(importe.replace(/\D/g, ''))

  return (
    <Pantalla>
      <Volver href="/tesoreria">Tesorería</Volver>
      <Titulo acompaña="Cada período comienza en marzo y conserva su importe histórico.">
        Cuotas de afiliación
      </Titulo>

      {consulta.isPending && <Cargando>Consultando…</Cargando>}
      {consulta.error && <Falla>{consulta.error.message}</Falla>}

      {periodo !== null && (
        <>
          <Campo etiqueta="Período de afiliación">
            <Filtros
              opciones={periodos.map((uno) => ({ id: String(uno), etiqueta: `${uno}/${uno + 1}` }))}
              valor={periodo}
              onElegir={setPeriodoElegido}
            />
          </Campo>

          <Campo etiqueta="Importe de la cuota">
            <TextInput
              accessibilityLabel="Importe en pesos"
              keyboardType="number-pad"
              placeholder="9000"
              value={importe}
              onChangeText={setImporte}
              className={CAMPO}
            />
          </Campo>

          <View className="mt-5">
            <BotonPrincipal
              disabled={definir.isPending || !importeEnPesosValido(monto)}
              onPress={() => definir.mutate({ periodo: Number(periodo), importe: monto })}
            >
              {definir.isPending ? 'Guardando…' : 'Guardar cuota'}
            </BotonPrincipal>
          </View>
          {definir.error && <Falla>{definir.error.message}</Falla>}
        </>
      )}

      <Text className="mt-6 text-lg font-bold text-ink">Historial</Text>
      <View className="mt-2">
        {cuotas.map((cuota) => (
          <View
            key={cuota.periodo}
            className="min-h-14 flex-row items-center justify-between gap-3 border-b border-line py-2"
          >
            <Text className="shrink text-sm font-semibold text-ink">
              Período {cuota.periodo}
              <Text className="font-normal text-ink-muted">
                {'  '}marzo {cuota.periodo} a febrero {cuota.periodo + 1}
              </Text>
            </Text>
            <Text className="shrink-0 text-sm font-bold text-ink">
              {pesos.format(cuota.importe)}
            </Text>
          </View>
        ))}
      </View>
      {cuotas.length === 0 && !consulta.isPending && (
        <Vacio>Todavía no hay ninguna cuota definida.</Vacio>
      )}
    </Pantalla>
  )
}
