import { periodoDe } from '@gps/afiliacion/dominio'
import {
  useActor,
  useAfiliadosEn,
  useDistritos,
  usePermisos,
  usePersonasDelGrupo,
  useTesoreria,
} from '@gps/api'
import { aFechaDeCalendario } from '@gps/core/fechas'
import { etiquetaDeEdades, type Rama, ramaDelCatalogo } from '@gps/estructura/dominio'
import {
  calcularEdad,
  estaVigente,
  nombreCompleto,
  nombreDelCargo,
  nombreDelTipo,
} from '@gps/personas/dominio'
import { firmantesRequeridos, repartirSalidas } from '@gps/salidas/dominio'
import { Link, useLocalSearchParams } from 'expo-router'
import { Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native'
import { AltaDePersona } from '../../../componentes/AltaDePersona'
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

/** El estado se lee, no se adivina: la píldora siempre lleva su texto y el
 *  color es refuerzo. */
function Chip(props: { tono: 'ok' | 'warn' | 'neutro'; children: string }) {
  const tonos = {
    ok: { caja: 'bg-ok-soft', letra: 'text-ok' },
    warn: { caja: 'bg-warn-soft', letra: 'text-warn' },
    neutro: { caja: 'bg-surface-3', letra: 'text-ink-muted' },
  }
  return (
    <View
      className={`min-h-[26px] justify-center rounded-full px-2.5 py-0.5 ${tonos[props.tono].caja}`}
    >
      <Text className={`text-label font-semibold ${tonos[props.tono].letra}`}>
        {props.children}
      </Text>
    </View>
  )
}

function FilaDePersona(props: { persona: Persona; hoy: Date; afiliada: boolean; periodo: number }) {
  // El "hasta" generado es opcional (string | null | undefined); el del
  // dominio es string | null a secas. Se normaliza solo en esta frontera.
  const vigentes = props.persona.cargos.filter((cargo) =>
    estaVigente({ desde: cargo.desde, hasta: cargo.hasta ?? null }, props.hoy),
  )
  return (
    <View className="min-h-[72px] flex-row items-center gap-3 border-b border-line py-3">
      <View className="min-w-0 flex-1">
        <Text className="text-sm font-semibold text-ink">{nombreCompleto(props.persona)}</Text>
        <Text className="mt-0.5 text-xs text-ink-muted">
          {nombreDelTipo(props.persona.tipoDeDocumento)} {props.persona.numeroDeDocumento} ·{' '}
          {calcularEdad(props.persona.fechaDeNacimiento, props.hoy)} años
        </Text>
        {vigentes.length > 0 && (
          <Text className="mt-1.5 text-xs text-ink-faint">
            {vigentes.map((cargo) => nombreDelCargo(cargo.cargo)).join(' · ')}
          </Text>
        )}
      </View>
      {/* El período va escrito: pertenecer no es estar afiliado, y "afiliado"
          a secas no dice de cuándo. El sustantivo y no el adjetivo porque el
          padrón no guarda el género de la persona. */}
      <Chip tono={props.afiliada ? 'ok' : 'warn'}>
        {props.afiliada ? `Afiliación ${props.periodo}` : 'Sin afiliar'}
      </Chip>
    </View>
  )
}

export function Seccion(props: {
  titulo: string
  detalle?: string
  personas: readonly Persona[]
  hoy: Date
  afiliados: ReadonlySet<string>
  periodo: number
}) {
  return (
    <View className="mt-6">
      <Text className="text-lg font-bold text-ink">
        {props.titulo}
        {props.detalle && (
          <Text className="text-label font-medium text-ink-muted"> {props.detalle}</Text>
        )}
      </Text>
      {props.personas.length === 0 ? (
        <Text className="mt-1 text-label text-ink-faint">Todavía no hay nadie</Text>
      ) : (
        <View className="mt-2">
          {props.personas.map((persona) => (
            <FilaDePersona
              key={persona.id}
              persona={persona}
              hoy={props.hoy}
              afiliada={props.afiliados.has(persona.id)}
              periodo={props.periodo}
            />
          ))}
        </View>
      )}
    </View>
  )
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

  // Las tres filas las reparte el dominio, con la misma política de firma que
  // aplica el servidor: firmar es personal.
  const panel =
    actor && distrito
      ? repartirSalidas(
          permisos.data?.permisos ?? [],
          actor,
          firmantesRequeridos(id, distrito.id),
          aFechaDeCalendario(hoy),
        )
      : { esperanTuFirma: [], esperanLaDeOtro: [], proximas: [] }

  const cuenta = tesoreria.data?.cuentasDeGrupos.find((una) => una.grupoId === id)

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <ScrollView contentContainerClassName="px-4 py-6">
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

            {/* Lo que exige acción va arriba de todo, y sólo aparece si hay
                algo que hacer: un bloque destacado que dice "0" no destaca
                nada. Dice "tu firma" porque el dominio ya lo decidió. */}
            {panel.esperanTuFirma.length > 0 && (
              <View className="mt-5 rounded-lg bg-warn-soft p-4">
                <Text className="font-semibold text-warn">
                  {panel.esperanTuFirma.length === 1
                    ? '1 salida espera tu firma'
                    : `${panel.esperanTuFirma.length} salidas esperan tu firma`}
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
                {/* El saldo positivo es deuda: así lo guarda tesorería. El
                    signo se escribe, no se deduce del color. */}
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
                    salidas={panel.esperanTuFirma}
                    grupoId={id}
                  />
                  <FilaDeSalidas
                    titulo="Esperan la de otro"
                    salidas={panel.esperanLaDeOtro}
                    grupoId={id}
                  />
                  <FilaDeSalidas titulo="Próximas" salidas={panel.proximas} grupoId={id} />
                  {panel.esperanTuFirma.length === 0 &&
                    panel.esperanLaDeOtro.length === 0 &&
                    panel.proximas.length === 0 && (
                      <Text className="text-sm text-ink-muted">No hay ninguna salida anotada.</Text>
                    )}
                </View>
              )}
              <Link href={`/grupos/${id}/plantel`} className="mt-3 text-sm text-ink-muted">
                Plantel →
              </Link>
            </View>

            <View className="mt-7 border-t border-line pt-5">
              {/* Ya vienen ordenadas por el servidor: por catalogo y, dentro de
                  una rama, por nombre. Los dirigentes antes que los
                  beneficiarios, que son los que uno busca cuando abre la
                  unidad. Una unidad abierta sin nadie se muestra vacia, porque
                  es informacion. */}
              {grupo.unidades.map((unidad) => {
                const suyas = personas.filter(
                  (persona) => persona.pertenencia.unidadId === unidad.id,
                )
                const rama = ramaDelCatalogo(unidad.rama)
                return (
                  <Seccion
                    key={unidad.id}
                    titulo={unidad.nombre}
                    detalle={
                      rama
                        ? `${rama.nombre} · ${etiquetaDeEdades(rama)} · ${unidad.sexo}`
                        : undefined
                    }
                    personas={[
                      ...suyas.filter((p) => p.pertenencia.categoria === 'activo'),
                      ...suyas.filter((p) => p.pertenencia.categoria === 'beneficiario'),
                    ]}
                    hoy={hoy}
                    afiliados={afiliados}
                    periodo={periodo}
                  />
                )
              })}

              {grupo.unidades.length === 0 && (
                <View className="mt-6 rounded-lg border border-dashed border-line-strong p-4">
                  <Text className="text-sm text-ink-muted">
                    El grupo todavía no abrió ninguna unidad.
                  </Text>
                </View>
              )}

              <Seccion
                titulo="Adherentes"
                personas={personas.filter((p) => p.pertenencia.categoria === 'adherente')}
                hoy={hoy}
                afiliados={afiliados}
                periodo={periodo}
              />
            </View>

            <AltaDePersona grupoId={id} unidadesAbiertas={grupo.unidades} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
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
