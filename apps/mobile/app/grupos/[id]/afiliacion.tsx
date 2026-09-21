import { useDeclaraciones, useDeclararAfiliacion } from '@gps/api'
import { nombreDelTipo } from '@gps/personas/dominio'
import { useLocalSearchParams } from 'expo-router'
import { ScrollView, Text, View } from 'react-native'
import {
  BotonSecundario,
  Cargando,
  Chip,
  Falla,
  FILA,
  Titulo,
  Vacio,
  Volver,
} from '../../../src/ui'

type Declaracion = NonNullable<ReturnType<typeof useDeclaraciones>['data']>['declaraciones'][number]

function Nomina(props: { declaracion: Declaracion }) {
  const aCobrar = new Set(props.declaracion.aCobrar.map((uno) => uno.personaId))
  return (
    <View className="mt-2">
      {props.declaracion.afiliados.map((afiliado) => (
        <View key={afiliado.personaId} className={FILA}>
          <View className="min-w-0 flex-1">
            <Text className="text-sm font-semibold text-ink">
              {afiliado.apellidos}, {afiliado.nombres}
            </Text>
            <Text className="mt-0.5 text-xs text-ink-muted">
              {nombreDelTipo(afiliado.tipoDeDocumento)} {afiliado.numeroDeDocumento}
            </Text>
          </View>
          <Chip tono={aCobrar.has(afiliado.personaId) ? 'warn' : 'neutro'}>
            {aCobrar.has(afiliado.personaId) ? 'A cobrar' : 'Ya afiliada'}
          </Chip>
        </View>
      ))}
    </View>
  )
}

export default function Pantalla() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const consulta = useDeclaraciones(id)
  const declarar = useDeclararAfiliacion()

  return (
    <ScrollView className="flex-1 bg-surface" contentContainerClassName="px-4 pb-10">
      <Volver href={`/grupos/${id}`}>Grupo</Volver>
      <Titulo>Declaraciones de afiliación</Titulo>

      {consulta.isPending && <Cargando>Consultando…</Cargando>}
      {consulta.error && (
        <Falla>No se pudieron consultar las declaraciones: {consulta.error.message}</Falla>
      )}

      {(consulta.data?.declaraciones ?? []).map((declaracion) => (
        <View key={declaracion.id} className="mt-6">
          <Text className="text-lg font-bold text-ink">{declaracion.fecha}</Text>
          <Text className="mt-0.5 text-label text-ink-muted">
            Período {declaracion.periodo} · {declaracion.afiliados.length} en la nómina ·{' '}
            {declaracion.aCobrar.length} a cobrar
          </Text>
          <Nomina declaracion={declaracion} />
        </View>
      ))}

      {consulta.data?.declaraciones.length === 0 && (
        <Vacio>El grupo todavía no tiene ninguna declaración.</Vacio>
      )}

      {/* Lo menos frecuente, así que va al final y no compite por lugar. Es el
          botón secundario y no el negro: declarar fuera de término no es la
          acción de esta pantalla, es la excepción. */}
      <View className="mt-8">
        <BotonSecundario
          disabled={declarar.isPending}
          onPress={() => declarar.mutate({ grupoId: id })}
        >
          {declarar.isPending ? 'Declarando…' : 'Declarar afiliación extraordinaria'}
        </BotonSecundario>
      </View>

      {declarar.error && <Falla>{declarar.error.message}</Falla>}
    </ScrollView>
  )
}
