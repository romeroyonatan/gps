import { useGenerarDeudasPendientes, useTesoreria } from '@gps/api'
import { Link } from 'expo-router'
import { useState } from 'react'
import { Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native'

type Filtro = 'todos' | 'deuda' | 'favor' | 'cero'
const pesos = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
})

export default function Pantalla() {
  const consulta = useTesoreria()
  const generar = useGenerarDeudasPendientes()
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const pendientes = consulta.data?.deudasPendientes
  // Null quiere decir "esto no es para vos": el enlace a configurar cuotas no
  // se muestra si no se van a poder configurar.
  const configura = consulta.data?.periodosConfigurablesDeAfiliacion != null
  const cuentas = (consulta.data?.cuentasDeGrupos ?? []).filter((cuenta) =>
    filtro === 'deuda'
      ? cuenta.saldo > 0
      : filtro === 'favor'
        ? cuenta.saldo < 0
        : filtro === 'cero'
          ? cuenta.saldo === 0
          : true,
  )

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <ScrollView contentContainerClassName="px-4 py-10">
        <Link href="/" className="text-sm text-slate-500">
          ← Inicio
        </Link>
        <View className="mt-1 flex-row items-center justify-between gap-3">
          <Text className="text-lg font-semibold text-slate-900">Tesorería</Text>
          {configura && (
            <Link href="/tesoreria/configuracion" className="text-sm text-slate-600">
              Configurar cuotas
            </Link>
          )}
        </View>
        {consulta.isPending && (
          <Text className="mt-8 text-sm text-slate-500">Consultando cuentas…</Text>
        )}
        {consulta.error && (
          <View className="mt-6 rounded-lg bg-red-50 p-4">
            <Text className="text-sm text-red-800">{consulta.error.message}</Text>
          </View>
        )}

        {pendientes && pendientes.cantidad > 0 && (
          <View className="mt-6 rounded-lg bg-amber-50 p-4">
            <Text className="text-sm text-amber-900">
              Hay {pendientes.cantidad} deudas pendientes.
            </Text>
            {pendientes.periodosSinCuota.length > 0 && (
              <Text className="mt-1 text-xs text-amber-800">
                Falta cuota para: {pendientes.periodosSinCuota.join(', ')}.
              </Text>
            )}
            <Pressable
              disabled={generar.isPending}
              onPress={() => generar.mutate()}
              className="mt-3 rounded-lg bg-amber-900 px-3 py-2"
            >
              <Text className="text-center text-sm font-medium text-white">
                {generar.isPending
                  ? 'Generando…'
                  : `Generar ${pendientes.cantidad} deudas pendientes`}
              </Text>
            </Pressable>
          </View>
        )}

        <Text className="mt-6 text-sm font-semibold text-slate-900">Cuentas de grupos</Text>
        <View className="mt-2 flex-row flex-wrap gap-2">
          {(['todos', 'deuda', 'favor', 'cero'] as const).map((uno) => (
            <Pressable
              key={uno}
              onPress={() => setFiltro(uno)}
              className={`rounded-full px-3 py-2 ${filtro === uno ? 'bg-slate-900' : 'bg-white'}`}
            >
              <Text className={`text-xs ${filtro === uno ? 'text-white' : 'text-slate-600'}`}>
                {uno === 'todos'
                  ? 'Todos'
                  : uno === 'deuda'
                    ? 'Con deuda'
                    : uno === 'favor'
                      ? 'Saldo a favor'
                      : 'Saldo cero'}
              </Text>
            </Pressable>
          ))}
        </View>
        <View className="mt-3 overflow-hidden rounded-lg bg-white">
          {cuentas.map((cuenta) => (
            <Link key={cuenta.grupoId} href={`/tesoreria/grupos/${cuenta.grupoId}`} asChild>
              <Pressable className="flex-row items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
                <Text className="flex-1 text-sm">
                  Grupo Scout Nº{cuenta.numero} - {cuenta.nombre}
                </Text>
                <Text
                  className={`text-sm font-semibold ${cuenta.saldo > 0 ? 'text-red-700' : cuenta.saldo < 0 ? 'text-emerald-700' : 'text-slate-500'}`}
                >
                  {pesos.format(Math.abs(cuenta.saldo))}
                  {cuenta.saldo < 0 ? ' a favor' : ''}
                </Text>
              </Pressable>
            </Link>
          ))}
        </View>
        {cuentas.length === 0 && !consulta.isPending && (
          <Text className="mt-3 text-sm text-slate-500">No hay grupos para este filtro.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
