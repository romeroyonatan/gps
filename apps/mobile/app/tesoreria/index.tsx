import { useGenerarDeudasPendientes, useTesoreria } from '@gps/api'
import { Link } from 'expo-router'
import { useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { Boton, Cargando, Falla, FILA, Filtros, Seccion, Titulo, Vacio, Volver } from '../../src/ui'

type Filtro = 'todos' | 'deuda' | 'favor' | 'cero'

const pesos = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
})

const FILTROS = [
  { id: 'todos', etiqueta: 'Todos' },
  { id: 'deuda', etiqueta: 'Con deuda' },
  { id: 'favor', etiqueta: 'A favor' },
  { id: 'cero', etiqueta: 'En cero' },
] as const satisfies readonly { id: Filtro; etiqueta: string }[]

export default function Pantalla() {
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
    <ScrollView className="flex-1 bg-surface" contentContainerClassName="px-4 pb-10">
      <Volver href="/">Directorio</Volver>
      <Titulo
        enlace={configura ? { texto: 'Cuotas', href: '/tesoreria/configuracion' } : undefined}
      >
        Tesorería
      </Titulo>

      {consulta.isPending && <Cargando>Consultando cuentas…</Cargando>}
      {consulta.error && <Falla>{consulta.error.message}</Falla>}

      {/* Lo que exige acción va arriba de todo, y sólo aparece si hay algo
            que hacer: un bloque destacado que dice "0" no destaca nada. */}
      {pendientes && pendientes.cantidad > 0 && (
        <View className="mt-5 rounded-lg bg-warn-soft p-4">
          <Text className="font-semibold text-warn">
            Hay {pendientes.cantidad}{' '}
            {pendientes.cantidad === 1 ? 'deuda pendiente' : 'deudas pendientes'}.
          </Text>
          {pendientes.periodosSinCuota.length > 0 && (
            <Text className="mt-1 text-label text-warn">
              Falta configurar la cuota de: {pendientes.periodosSinCuota.join(', ')}.
            </Text>
          )}
          <View className="mt-3">
            <Boton disabled={generar.isPending} onPress={() => generar.mutate()}>
              {generar.isPending
                ? 'Generando…'
                : `Generar ${pendientes.cantidad} deudas pendientes`}
            </Boton>
          </View>
        </View>
      )}

      <Seccion titulo="Cuentas de grupos" cuantos={cuentas.length}>
        <View className="mt-3">
          <Filtros opciones={FILTROS} valor={filtro} onElegir={setFiltro} />
        </View>
        <View className="mt-3">
          {cuentas.map((cuenta) => (
            <Link key={cuenta.grupoId} href={`/tesoreria/grupos/${cuenta.grupoId}`} asChild>
              <Pressable className={`${FILA} justify-between active:bg-surface-3`}>
                <Text className="min-w-0 flex-1 text-sm font-semibold text-ink">
                  Grupo Scout Nº{cuenta.numero} — {cuenta.nombre}
                  {cuenta.cerrado ? ' (cerrado)' : ''}
                </Text>
                {/* El signo y la palabra dicen de qué lado va el saldo; el
                      color es refuerzo, nunca el dato. */}
                <Text
                  className={`shrink-0 text-sm font-bold ${
                    cuenta.saldo > 0
                      ? 'text-danger'
                      : cuenta.saldo < 0
                        ? 'text-ok'
                        : 'text-ink-muted'
                  }`}
                >
                  {pesos.format(Math.abs(cuenta.saldo))}
                  {cuenta.saldo < 0 ? ' a favor' : ''}
                </Text>
              </Pressable>
            </Link>
          ))}
        </View>
        {cuentas.length === 0 && !consulta.isPending && (
          <Vacio>No hay grupos para este filtro.</Vacio>
        )}
      </Seccion>
    </ScrollView>
  )
}
