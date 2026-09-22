import { useGenerarDeudasPendientes, useTesoreria } from '@gps/api'
import { enPesos } from '@gps/tesoreria/dominio'
import { Link } from 'expo-router'
import { useState } from 'react'
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import {
  Aviso,
  Boton,
  CAMPO,
  Cargando,
  Chip,
  Falla,
  Filtros,
  Titulo,
  Vacio,
  Volver,
} from '../../src/ui'

type Filtro = 'todos' | 'deuda' | 'favor' | 'cero'
type Cuenta = NonNullable<ReturnType<typeof useTesoreria>['data']>['cuentasDeGrupos'][number]

const FILTROS = [
  { id: 'todos', etiqueta: 'Todos' },
  { id: 'deuda', etiqueta: 'A cobrar' },
  { id: 'favor', etiqueta: 'A favor' },
  { id: 'cero', etiqueta: 'Sin deuda' },
] as const satisfies readonly { id: Filtro; etiqueta: string }[]

function total(cuentas: readonly Cuenta[], signo: 1 | -1) {
  return cuentas.reduce(
    (suma, cuenta) => suma + (cuenta.saldo * signo > 0 ? Math.abs(cuenta.saldo) : 0),
    0,
  )
}

function Total(props: { titulo: string; importe: number; tono: 'danger' | 'ok' }) {
  return (
    <View
      className={`flex-1 rounded-lg p-3 ${props.tono === 'danger' ? 'bg-danger-soft' : 'bg-ok-soft'}`}
    >
      <Text className={`text-label ${props.tono === 'danger' ? 'text-danger' : 'text-ok'}`}>
        {props.titulo}
      </Text>
      <Text
        className={`mt-1 text-xl font-bold ${props.tono === 'danger' ? 'text-danger' : 'text-ok'}`}
      >
        {enPesos(props.importe)}
      </Text>
    </View>
  )
}

function FilaDeCuenta({ cuenta }: { cuenta: Cuenta }) {
  return (
    <Link href={`/tesoreria/grupos/${cuenta.grupoId}`} asChild>
      <Pressable className="min-h-[88px] flex-row items-center gap-3 border-b border-line py-3.5 active:bg-surface-3">
        <View className="min-w-0 flex-1 gap-1.5">
          <Text numberOfLines={1} className="text-base font-semibold text-ink">
            Grupo Scout Nº{cuenta.numero} — {cuenta.nombre}
          </Text>
          <View className="flex-row items-center gap-2">
            <Chip tono={cuenta.saldo > 0 ? 'warn' : cuenta.saldo < 0 ? 'ok' : 'neutro'}>
              {cuenta.saldo > 0 ? 'A cobrar' : cuenta.saldo < 0 ? 'A favor' : 'Sin deuda'}
            </Chip>
            {cuenta.cerrado && <Text className="text-label text-ink-faint">Grupo cerrado</Text>}
          </View>
        </View>
        <View className="shrink-0 items-end gap-1">
          <Text
            className={`text-lg font-bold ${cuenta.saldo > 0 ? 'text-danger' : cuenta.saldo < 0 ? 'text-ok' : 'text-ink-faint'}`}
          >
            {cuenta.saldo === 0 ? '—' : enPesos(Math.abs(cuenta.saldo))}
          </Text>
          <Text className="text-label text-ink-faint">
            {cuenta.saldo > 0 ? 'de deuda' : cuenta.saldo < 0 ? 'a favor' : 'al día'}
          </Text>
        </View>
      </Pressable>
    </Link>
  )
}

export default function Pantalla() {
  const consulta = useTesoreria()
  const generar = useGenerarDeudasPendientes()
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [busqueda, setBusqueda] = useState('')

  const todas = consulta.data?.cuentasDeGrupos ?? []
  const buscado = busqueda.trim().toLowerCase()
  const cuentas = todas.filter((cuenta) => {
    if (buscado && !`${cuenta.numero} ${cuenta.nombre}`.toLowerCase().includes(buscado))
      return false
    if (filtro === 'deuda') return cuenta.saldo > 0
    if (filtro === 'favor') return cuenta.saldo < 0
    if (filtro === 'cero') return cuenta.saldo === 0
    return true
  })
  const pendientes = consulta.data?.deudasPendientes
  const configura = consulta.data?.periodosConfigurablesDeAfiliacion != null

  return (
    <ScrollView className="flex-1 bg-surface" contentContainerClassName="px-4 pb-10">
      <Volver href="/">Directorio</Volver>
      <Titulo>Tesorería</Titulo>

      <View className="mt-2 flex-row gap-4">
        <Link href="/tesoreria/reportes" className="text-sm text-ink-muted">
          Reportes →
        </Link>
        {configura && (
          <Link href="/tesoreria/configuracion" className="text-sm text-ink-muted">
            Cuotas →
          </Link>
        )}
      </View>

      {consulta.isPending && <Cargando>Consultando cuentas…</Cargando>}
      {consulta.error && <Falla>{consulta.error.message}</Falla>}

      {todas.length > 0 && (
        <View className="mt-4 flex-row gap-2">
          <Total titulo="Deuda total" importe={total(todas, 1)} tono="danger" />
          <Total titulo="A favor" importe={total(todas, -1)} tono="ok" />
        </View>
      )}

      {pendientes && pendientes.cantidad > 0 && (
        <Aviso
          detalle={
            pendientes.periodosSinCuota.length > 0
              ? `Falta configurar la cuota de: ${pendientes.periodosSinCuota.join(', ')}.`
              : undefined
          }
          accion={
            <Boton disabled={generar.isPending} onPress={() => generar.mutate()}>
              {generar.isPending
                ? 'Generando…'
                : `Generar ${pendientes.cantidad} deudas pendientes`}
            </Boton>
          }
        >
          Hay {pendientes.cantidad}{' '}
          {pendientes.cantidad === 1 ? 'deuda pendiente' : 'deudas pendientes'}.
        </Aviso>
      )}
      {generar.error && <Falla>{generar.error.message}</Falla>}

      <TextInput
        accessibilityLabel="Buscar grupo"
        placeholder="Buscar grupo"
        value={busqueda}
        onChangeText={setBusqueda}
        className={`${CAMPO} mt-5`}
      />
      <View className="mt-3">
        <Filtros opciones={FILTROS} valor={filtro} onElegir={setFiltro} />
      </View>

      <View className="mt-2">
        {cuentas.map((cuenta) => (
          <FilaDeCuenta key={cuenta.grupoId} cuenta={cuenta} />
        ))}
      </View>

      {cuentas.length === 0 && !consulta.isPending && (
        <Vacio>Ningún grupo coincide. Probá con otro filtro o limpiá la búsqueda.</Vacio>
      )}

      {cuentas.length > 0 && (
        <View className="mt-4 flex-row justify-between gap-3 rounded-lg bg-surface-3 p-3">
          <Text className="text-sm text-ink-muted">
            {cuentas.length} {cuentas.length === 1 ? 'grupo' : 'grupos'}
          </Text>
          <Text className="text-sm font-bold text-ink">
            Deuda filtrada {enPesos(total(cuentas, 1))}
          </Text>
        </View>
      )}
    </ScrollView>
  )
}
