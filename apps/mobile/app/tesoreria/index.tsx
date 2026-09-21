import { useGenerarDeudasPendientes, useTesoreria } from '@gps/api'
import { Link } from 'expo-router'
import { useState } from 'react'
import { Pressable, Text, TextInput, View } from 'react-native'
import {
  BotonPrincipal,
  CAMPO,
  Cargando,
  Chip,
  Falla,
  Filtros,
  Pantalla,
  pesos,
  Titulo,
  Vacio,
  Volver,
} from '../../componentes/ui'

type Filtro = 'todos' | 'deuda' | 'favor' | 'cero'

const FILTROS = [
  { id: 'todos', etiqueta: 'Todos' },
  { id: 'deuda', etiqueta: 'A cobrar' },
  { id: 'favor', etiqueta: 'A favor' },
  { id: 'cero', etiqueta: 'Sin deuda' },
] as const satisfies readonly { id: Filtro; etiqueta: string }[]

type Cuenta = NonNullable<ReturnType<typeof useTesoreria>['data']>['cuentasDeGrupos'][number]

/** La tabla de siete columnas del escritorio no cabe en 393px: cada grupo es
 *  una fila de 88px con el importe como dato principal a la derecha. */
function FilaDeCuenta(props: { cuenta: Cuenta }) {
  const { cuenta } = props
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
        {/* El signo y la palabra dicen de qué lado va el saldo; el color es
            refuerzo, nunca el dato. */}
        <View className="shrink-0 items-end gap-1">
          <Text
            className={`text-lg font-bold ${cuenta.saldo > 0 ? 'text-danger' : cuenta.saldo < 0 ? 'text-ok' : 'text-ink-faint'}`}
          >
            {cuenta.saldo === 0 ? '—' : pesos.format(Math.abs(cuenta.saldo))}
          </Text>
          <Text className="text-label text-ink-faint">
            {cuenta.saldo > 0 ? 'de deuda' : cuenta.saldo < 0 ? 'a favor' : 'al día'}
          </Text>
        </View>
      </Pressable>
    </Link>
  )
}

/** El total de un lado de la cuenta, escrito grande. Dos y no cuatro: en el
 *  teléfono sólo entran los dos que se miran. */
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
        {pesos.format(props.importe)}
      </Text>
    </View>
  )
}

export default function Pantalla_() {
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
    <Pantalla>
      <Volver href="/">Directorio</Volver>
      <Titulo>Tesorería</Titulo>

      {/* Las otras pantallas de Tesorería. En web esto es la barra de tareas
          del rol; mobile todavía no tiene esa barra y quedan como enlaces
          -ver la deuda de paridad en AGENT.md-. */}
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
          <Total titulo="Deuda total" importe={sumar(todas, 1)} tono="danger" />
          <Total titulo="A favor" importe={sumar(todas, -1)} tono="ok" />
        </View>
      )}

      {/* Lo que exige acción va arriba de todo, y sólo aparece si hay algo que
          hacer: un bloque destacado que dice "0" no destaca nada. */}
      {pendientes && pendientes.cantidad > 0 && (
        <View className="mt-4 gap-2 rounded-lg bg-warn-soft p-4">
          <Text className="font-semibold text-warn">
            Hay {pendientes.cantidad}{' '}
            {pendientes.cantidad === 1 ? 'deuda pendiente' : 'deudas pendientes'}.
          </Text>
          {pendientes.periodosSinCuota.length > 0 && (
            <Text className="text-label text-warn">
              Falta configurar la cuota de: {pendientes.periodosSinCuota.join(', ')}.
            </Text>
          )}
          <View className="mt-1">
            <BotonPrincipal disabled={generar.isPending} onPress={() => generar.mutate()}>
              {generar.isPending
                ? 'Generando…'
                : `Generar ${pendientes.cantidad} deudas pendientes`}
            </BotonPrincipal>
          </View>
        </View>
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

      {/* El pie del escritorio, que dice cuánto suma lo que se está mirando:
          el filtro cambia la pregunta y el total tiene que cambiar con ella. */}
      {cuentas.length > 0 && (
        <View className="mt-4 flex-row justify-between gap-3 rounded-lg bg-surface-3 p-3">
          <Text className="text-sm text-ink-muted">
            {cuentas.length} {cuentas.length === 1 ? 'grupo' : 'grupos'}
          </Text>
          <Text className="text-sm font-bold text-ink">
            Deuda filtrada {pesos.format(sumar(cuentas, 1))}
          </Text>
        </View>
      )}
    </Pantalla>
  )
}
