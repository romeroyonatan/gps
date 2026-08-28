import { ErrorDeApi, useCrearPersona, usePersonas } from '@gps/api'
import {
  calcularEdad,
  type DatosDePersona,
  nombreCompleto,
  nombreDelTipo,
  type Problema,
  TIPOS_DE_DOCUMENTO,
  validarPersona,
} from '@gps/personas/dominio'
import { Stack } from 'expo-router'
import { type ReactNode, useState } from 'react'
import { Pressable, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native'

const VACIO: DatosDePersona = {
  tipoDeDocumento: 'dni',
  numeroDeDocumento: '',
  nombres: '',
  apellidos: '',
  fechaDeNacimiento: '',
}

const CLASE_DE_INPUT = 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm'

function Campo(props: { etiqueta: string; problema?: string; children: ReactNode }) {
  return (
    <View className="mt-3">
      <Text className="text-xs font-medium text-slate-600">{props.etiqueta}</Text>
      <View className="mt-1">{props.children}</View>
      {props.problema && <Text className="mt-1 text-xs text-red-700">{props.problema}</Text>}
    </View>
  )
}

export default function Pantalla() {
  const { data, isPending, error } = usePersonas()
  const alta = useCrearPersona()
  const [datos, setDatos] = useState<DatosDePersona>(VACIO)
  const [problemas, setProblemas] = useState<readonly Problema[]>([])
  const hoy = new Date()

  const problemaDe = (campo: Problema['campo']) =>
    problemas.find((problema) => problema.campo === campo)?.mensaje

  function enviar() {
    // Las mismas funciones puras que corre el servicio, y las mismas que corre
    // la web: una sola implementacion de las reglas para los tres lados.
    const encontrados = validarPersona(datos, hoy)
    setProblemas(encontrados)
    if (encontrados.length > 0) return
    alta.mutate({ datos }, { onSuccess: () => setDatos(VACIO) })
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <Stack.Screen options={{ headerShown: true, title: 'Personas' }} />
      <ScrollView contentContainerClassName="px-4 py-6">
        <View className="rounded-lg bg-white p-4">
          <Text className="text-sm font-semibold text-slate-900">Cargar una persona</Text>

          <Campo etiqueta="Tipo de documento">
            <View className="flex-row gap-2">
              {TIPOS_DE_DOCUMENTO.map((tipo) => (
                <Pressable
                  key={tipo.id}
                  onPress={() => setDatos({ ...datos, tipoDeDocumento: tipo.id })}
                  className={`rounded-full px-3 py-1.5 ${
                    datos.tipoDeDocumento === tipo.id ? 'bg-slate-900' : 'bg-slate-100'
                  }`}
                >
                  <Text
                    className={`text-xs ${
                      datos.tipoDeDocumento === tipo.id ? 'text-white' : 'text-slate-700'
                    }`}
                  >
                    {tipo.nombre}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Campo>

          <Campo etiqueta="Número" problema={problemaDe('numeroDeDocumento')}>
            <TextInput
              className={CLASE_DE_INPUT}
              value={datos.numeroDeDocumento}
              onChangeText={(numeroDeDocumento) => setDatos({ ...datos, numeroDeDocumento })}
              autoCapitalize="characters"
            />
          </Campo>

          <Campo etiqueta="Apellidos" problema={problemaDe('apellidos')}>
            <TextInput
              className={CLASE_DE_INPUT}
              value={datos.apellidos}
              onChangeText={(apellidos) => setDatos({ ...datos, apellidos })}
              autoCapitalize="words"
            />
          </Campo>

          <Campo etiqueta="Nombres" problema={problemaDe('nombres')}>
            <TextInput
              className={CLASE_DE_INPUT}
              value={datos.nombres}
              onChangeText={(nombres) => setDatos({ ...datos, nombres })}
              autoCapitalize="words"
            />
          </Campo>

          {/* ponytail: un TextInput con el formato crudo aaaa-mm-dd en vez de un
              calendario. React Native no tiene equivalente de <input type="date">
              y el picker es @react-native-community/datetimepicker, una
              dependencia nativa para el primer formulario del proyecto. Techo:
              tipear una fecha en un telefono es peor que elegirla. Cuando el alta
              desde el telefono sea un camino real y no una demostracion, sumar el
              picker; la validacion pura no cambia. */}
          <Campo etiqueta="Fecha de nacimiento" problema={problemaDe('fechaDeNacimiento')}>
            <TextInput
              className={CLASE_DE_INPUT}
              value={datos.fechaDeNacimiento}
              onChangeText={(fechaDeNacimiento) => setDatos({ ...datos, fechaDeNacimiento })}
              placeholder="aaaa-mm-dd"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </Campo>

          {alta.isError && (
            <View className="mt-3 rounded-lg bg-red-50 p-3">
              <Text className="text-sm text-red-800">
                {alta.error instanceof ErrorDeApi
                  ? alta.error.errores.join(' ')
                  : alta.error.message}
              </Text>
            </View>
          )}

          <Pressable
            onPress={enviar}
            disabled={alta.isPending}
            className="mt-4 rounded-lg bg-slate-900 px-4 py-2.5"
          >
            <Text className="text-center text-sm font-medium text-white">
              {alta.isPending ? 'Guardando…' : 'Guardar'}
            </Text>
          </Pressable>
        </View>

        {isPending && (
          <Text className="mt-6 text-sm text-slate-500">Consultando las personas…</Text>
        )}

        {error && (
          <View className="mt-6 rounded-lg bg-red-50 p-4">
            <Text className="text-sm text-red-800">
              No se pudieron consultar las personas: {error.message}
            </Text>
          </View>
        )}

        {data?.personas.length === 0 && (
          <View className="mt-6 rounded-lg bg-white p-4">
            <Text className="text-sm text-slate-500">No hay personas cargadas todavía.</Text>
          </View>
        )}

        {data && data.personas.length > 0 && (
          <View className="mt-6 overflow-hidden rounded-lg bg-white">
            {data.personas.map((persona) => (
              <View key={persona.id} className="border-b border-slate-200 px-4 py-3">
                <Text className="text-sm font-medium text-slate-900">
                  {nombreCompleto(persona)}
                </Text>
                <Text className="mt-0.5 text-xs text-slate-500">
                  {nombreDelTipo(persona.tipoDeDocumento)} {persona.numeroDeDocumento}
                  <Text className="text-slate-400">
                    {' · '}
                    {calcularEdad(persona.fechaDeNacimiento, hoy)} años
                  </Text>
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
