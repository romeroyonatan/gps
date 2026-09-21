import { periodoDe } from '@gps/afiliacion/dominio'
import type { TipoDeCargo } from '@gps/api'
import {
  useActor,
  useAfiliadosEn,
  useDistritos,
  usePermisos,
  usePersonasDelGrupo,
  useTesoreria,
} from '@gps/api'
import { aFechaDeCalendario } from '@gps/core/fechas'
import { type Rama, ramaDelCatalogo } from '@gps/estructura/dominio'
import { firmantesRequeridos, puedeFirmarEnLaApp, repartirSalidas } from '@gps/salidas/dominio'
import { Link, useLocalSearchParams } from 'expo-router'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { BarraDeSesion } from '../../../src/BarraDeSesion'

type Persona = NonNullable<ReturnType<typeof usePersonasDelGrupo>['data']>['personas'][number]
type Permiso = NonNullable<ReturnType<typeof usePermisos>['data']>['permisos'][number]

const pesos = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
})

/** El color de rama escrito entero, no armado con plantilla: Tailwind lee las
 *  clases del fuente y una interpolada nunca se genera. */
const COLOR_DE_RAMA: Record<Rama, string> = {
  castores: 'bg-rama-castores',
  lobatos: 'bg-rama-lobatos',
  scouts: 'bg-rama-scouts',
  raiders: 'bg-rama-raiders',
  rovers: 'bg-rama-rovers',
  adultos: 'bg-rama-adultos',
}

/** La distribución por rama: barra de proporciones más una etiqueta por rama
 *  con su nombre escrito. El color nunca viaja solo. */
function PorRama(props: { ramas: readonly { rama: Rama; cuantos: number }[] }) {
  if (props.ramas.length === 0) return null
  return (
    <>
      <View className="mt-3.5 h-2.5 flex-row overflow-hidden rounded-full">
        {props.ramas.map((una) => (
          <View key={una.rama} style={{ flex: una.cuantos }} className={COLOR_DE_RAMA[una.rama]} />
        ))}
      </View>
      <View className="mt-3 flex-row flex-wrap gap-2">
        {props.ramas.map((una) => (
          <View
            key={una.rama}
            className="h-8 flex-row items-center gap-2 rounded-full bg-surface-3 px-3"
          >
            <View className={`h-2 w-2 rounded-full ${COLOR_DE_RAMA[una.rama]}`} />
            <Text className="text-sm font-medium text-ink">
              {ramaDelCatalogo(una.rama)?.nombre ?? una.rama}{' '}
              <Text className="font-bold">{una.cuantos}</Text>
            </Text>
          </View>
        ))}
      </View>
    </>
  )
}

/** Una de las tres filas del panel de salidas. La vacía no se dibuja: una fila
 *  que dice "0" ocupa lugar sin decir nada. */
function FilaDeSalidas(props: { titulo: string; salidas: readonly Permiso[]; grupoId: string }) {
  if (props.salidas.length === 0) return null
  return (
    <Link href={`/grupos/${props.grupoId}/salidas`} asChild>
      <Pressable className="min-h-12 border-b border-line py-3">
        <View className="flex-row items-center justify-between gap-3">
          <Text className="text-sm font-semibold text-ink">{props.titulo}</Text>
          <Text className="text-sm font-bold text-ink">{props.salidas.length}</Text>
        </View>
        {props.salidas.map((salida) => (
          <Text key={salida.id} className="mt-0.5 text-xs text-ink-muted">
            {salida.lugar} · {salida.desde}
          </Text>
        ))}
      </Pressable>
    </Link>
  )
}

/** Por rama, contando por la unidad a la que pertenece cada quien: la rama es
 *  de la unidad, no de la persona. Se listan sólo las ramas con gente. */
function porRama(
  unidades: readonly { id: string; rama: Rama }[],
  personas: readonly Persona[],
): readonly { rama: Rama; cuantos: number }[] {
  const ramaDeUnidad = new Map(unidades.map((unidad) => [unidad.id, unidad.rama]))
  const cuenta = new Map<Rama, number>()
  for (const persona of personas) {
    const rama = persona.pertenencia.unidadId
      ? ramaDeUnidad.get(persona.pertenencia.unidadId)
      : undefined
    if (rama) cuenta.set(rama, (cuenta.get(rama) ?? 0) + 1)
  }
  return [...cuenta].map(([rama, cuantos]) => ({ rama, cuantos }))
}

/** Con qué abre el grupo: lo que hay que hacer hoy. El padrón es la pestaña de
 *  al lado. */
export default function Pantalla() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const arbol = useDistritos()
  const lista = usePersonasDelGrupo(id)
  const permisos = usePermisos(id)
  const tesoreria = useTesoreria()
  const actor = useActor()
  const hoy = new Date()

  const personas = lista.data?.personas ?? []
  // El periodo lo calcula el cliente, de su propio almanaque: es el mismo
  // criterio que estaVigente y que calcularEdad, que tampoco los resuelve el
  // servidor.
  const periodo = periodoDe(aFechaDeCalendario(hoy))
  const consulta = useAfiliadosEn(
    periodo,
    personas.map((persona) => persona.id),
  )
  const afiliados = new Set(consulta.data?.afiliadosEn ?? [])

  // Reusa la query del arbol en vez de estrenar grupo(id): ya esta en cache
  // porque venis de ahi, y de paso trae el distrito para el encabezado.
  const distrito = arbol.data?.distritos.find((candidato) =>
    candidato.grupos.some((grupo) => grupo.id === id),
  )
  const grupo = distrito?.grupos.find((candidato) => candidato.id === id)

  // El reparto es la misma función pura que usa la web, así que "espera tu
  // firma" quiere decir lo mismo en los dos lados. Quién firma qué lo decide
  // `puedeFirmarEnLaApp` contra los tres firmantes del permiso: sin distrito
  // todavía no se sabe quién es el comisionado, y entonces nadie firma nada.
  const firmantes = distrito ? firmantesRequeridos(id, distrito.id) : []
  const puedoFirmar = (cargo: TipoDeCargo) => {
    const firmante = firmantes.find((uno) => uno.cargo === cargo)
    return actor !== null && firmante !== undefined && puedeFirmarEnLaApp(actor, firmante)
  }
  const reparto = repartirSalidas(
    permisos.data?.permisos ?? [],
    aFechaDeCalendario(hoy),
    puedoFirmar,
  )

  const cuenta = tesoreria.data?.cuentasDeGrupos.find((una) => una.grupoId === id)

  return (
    <ScrollView contentContainerClassName="px-4 pb-6">
      <BarraDeSesion />
      <Link href="/" className="mt-4 text-label text-ink-muted">
        ← Distrito {distrito?.numero}
      </Link>

      {(arbol.isPending || lista.isPending) && (
        <Text className="mt-8 text-sm text-ink-muted">Consultando el grupo…</Text>
      )}

      {(arbol.error ?? lista.error) && (
        <View className="mt-8 rounded-lg bg-danger-soft p-4">
          <Text className="text-sm text-danger">
            No se pudo consultar el grupo: {(arbol.error ?? lista.error)?.message}
          </Text>
        </View>
      )}

      {/* La paridad que faltaba con la web: una dirección vieja o un grupo
          cerrado tienen que decirlo, no quedarse en blanco. */}
      {!grupo && !arbol.isPending && !lista.isPending && !(arbol.error ?? lista.error) && (
        <View className="mt-8 rounded-lg border border-line-strong p-4">
          <Text className="text-sm text-ink-muted">
            No hay ningún grupo abierto con esa dirección.
          </Text>
        </View>
      )}

      {grupo && (
        <>
          <Text className="mt-1 text-2xl font-bold text-ink">
            Grupo {grupo.numero} — {grupo.nombre}
          </Text>

          {/* Lo que exige acción va arriba de todo, y sólo aparece si hay algo
              que hacer: un bloque destacado que dice "0" no destaca nada. Dice
              "tu firma" porque el dominio ya lo decidió. */}
          {reparto.esperanMiFirma.length > 0 && (
            <View className="mt-5 rounded-lg bg-warn-soft p-4">
              <Text className="font-semibold text-warn">
                {reparto.esperanMiFirma.length === 1
                  ? '1 salida espera tu firma'
                  : `${reparto.esperanMiFirma.length} salidas esperan tu firma`}
              </Text>
              <Link href={`/grupos/${id}/salidas`} asChild>
                <Pressable className="mt-3 h-12 w-full items-center justify-center rounded-lg bg-accent px-6">
                  <Text className="font-semibold text-accent-ink">Ver salidas</Text>
                </Pressable>
              </Link>
            </View>
          )}

          <View className="mt-5">
            <View className="flex-row items-baseline justify-between">
              <Text className="font-semibold text-ink">Gente</Text>
              <Link href={`/grupos/${id}/afiliacion`} className="text-sm text-ink-muted">
                ver afiliación
              </Link>
            </View>
            <Text className="mt-1.5">
              <Text className="text-3xl font-bold text-ink">{personas.length}</Text>{' '}
              <Text className="text-sm text-ink-muted">
                pertenecen · {personas.filter((persona) => !afiliados.has(persona.id)).length} sin
                afiliar en {periodo}
              </Text>
            </Text>
            <PorRama ramas={porRama(grupo.unidades, personas)} />
          </View>

          {cuenta && (
            <View className="mt-5 border-t border-line pt-4">
              <Text className="font-semibold text-ink">Cuenta corriente</Text>
              {/* El saldo positivo es deuda: así lo guarda tesorería. El signo
                  se escribe, no se deduce del color. */}
              <Text
                className={`mt-1.5 text-2xl font-bold ${cuenta.saldo > 0 ? 'text-danger' : 'text-ink'}`}
              >
                {cuenta.saldo > 0 ? '−' : ''}
                {pesos.format(Math.abs(cuenta.saldo))}
              </Text>
              <Text className="mt-0.5 text-sm text-ink-muted">
                {cuenta.saldo > 0
                  ? 'De deuda'
                  : cuenta.saldo < 0
                    ? 'A favor del grupo'
                    : 'Sin deuda'}
                .{' '}
                <Link href={`/tesoreria/grupos/${id}`} className="underline">
                  Ver movimientos
                </Link>
              </Text>
            </View>
          )}

          <View className="mt-5 border-t border-line pt-4">
            <View className="flex-row items-baseline justify-between">
              <Text className="font-semibold text-ink">Salidas</Text>
              <Link href={`/grupos/${id}/salidas`} className="text-sm text-ink-muted">
                ver todas
              </Link>
            </View>
            {permisos.isPending ? (
              <Text className="mt-1.5 text-sm text-ink-muted">Consultando las salidas…</Text>
            ) : (
              <View className="mt-1.5">
                <FilaDeSalidas
                  titulo="Esperan tu firma"
                  salidas={reparto.esperanMiFirma}
                  grupoId={id}
                />
                <FilaDeSalidas
                  titulo="Firmadas, falta el resto"
                  salidas={reparto.esperanOtraFirma}
                  grupoId={id}
                />
                <FilaDeSalidas titulo="Próximas" salidas={reparto.proximas} grupoId={id} />
                {reparto.esperanMiFirma.length === 0 &&
                  reparto.esperanOtraFirma.length === 0 &&
                  reparto.proximas.length === 0 && (
                    <Text className="text-sm text-ink-muted">No hay ninguna salida anotada.</Text>
                  )}
              </View>
            )}
            <Link href={`/grupos/${id}/plantel`} className="mt-3 text-sm text-ink-muted">
              Plantel →
            </Link>
          </View>
        </>
      )}
    </ScrollView>
  )
}
