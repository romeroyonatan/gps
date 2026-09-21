import {
  useActor,
  useAsignarCargo,
  useIntegrarEquipo,
  useInvitar,
  usePersonasDelGrupo,
  useRevocarCargo,
  useRevocarIntegranteDeEquipo,
} from '@gps/api'
import { aFechaDeCalendario } from '@gps/core/fechas'
import { estaVigente, nombreCompleto, puedeAdministrarPlantelDeGrupo } from '@gps/personas/dominio'
import { Link, useLocalSearchParams } from 'expo-router'
import { Pressable, SafeAreaView, ScrollView, Share, Text, View } from 'react-native'

/** Los dos vínculos que conceden acceso en un grupo, que son los que hay que
 *  poder cambiar en el día. */
const JEFATURA = 'jefeDeGrupo'
const SECRETARIA = 'secretaria'

/** El cliente generado deja `hasta` como opcional; `estaVigente` quiere el
 *  null explícito. Las dos puntas inclusivas, como siempre. */
const vigente = (periodo: { desde: string; hasta?: string | null }, ahora: Date) =>
  estaVigente({ desde: periodo.desde, hasta: periodo.hasta ?? null }, ahora)

function Accion(props: { onPress: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <Pressable onPress={props.onPress} disabled={props.disabled}>
      <Text className="text-xs font-medium text-slate-500">{props.children}</Text>
    </Pressable>
  )
}

/** El enlace de acceso, para compartir a mano. En el teléfono la Share API es
 *  nativa: abre WhatsApp directo, que es como se comparte de verdad. */
function Enlace(props: { personaId: string; nombre: string }) {
  const invitar = useInvitar()
  const url = invitar.data?.invitar.url ?? null

  if (!url) {
    return (
      <Accion
        onPress={() => invitar.mutate({ personaId: props.personaId, tipo: 'activacion' })}
        disabled={invitar.isPending}
      >
        {invitar.isPending ? 'Generando…' : 'Generar enlace de acceso'}
      </Accion>
    )
  }

  return (
    <View className="mt-1.5 rounded-lg bg-amber-50 p-2">
      <Text className="text-xs text-amber-900">
        Este enlace le da acceso a {props.nombre} y se ve una sola vez. Vence en siete días.
      </Text>
      <Text className="mt-1 text-xs text-amber-800">{url}</Text>
      <Pressable
        className="mt-1.5"
        onPress={() => {
          void Share.share({ message: `Activá tu acceso a GPS: ${url}` })
        }}
      >
        <Text className="text-xs font-medium text-amber-900 underline">Compartir</Text>
      </Pressable>
    </View>
  )
}

export default function Pantalla() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { data, isPending, error } = usePersonasDelGrupo(id)
  const actor = useActor()
  const asignar = useAsignarCargo()
  const revocarCargo = useRevocarCargo()
  const integrar = useIntegrarEquipo()
  const revocarEquipo = useRevocarIntegranteDeEquipo()

  // El hoy de quien mira la pantalla, no el del servidor.
  const ahora = new Date()
  const hoy = aFechaDeCalendario(ahora)
  // La misma función pura que aplica el servidor, con el mismo actor: la
  // pantalla no puede ofrecer algo que el servidor después rechace.
  const puede = actor !== null && puedeAdministrarPlantelDeGrupo(actor, id)

  const adultos = (data?.personas ?? []).filter(
    (persona) => persona.pertenencia.categoria !== 'beneficiario',
  )

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <ScrollView contentContainerClassName="px-4 py-10">
        <Link href={`/grupos/${id}`} className="text-sm text-slate-500">
          ← Volver al grupo
        </Link>
        <Text className="mt-1 text-lg font-semibold text-slate-900">Plantel</Text>
        <Text className="mt-1 text-sm text-slate-500">
          Los cargos y los equipos son lo que da acceso: al sacarlos, se pierde en el pedido
          siguiente.
        </Text>

        {isPending && <Text className="mt-8 text-sm text-slate-500">Consultando el plantel…</Text>}
        {error && (
          <View className="mt-8 rounded-lg bg-red-50 p-4">
            <Text className="text-sm text-red-800">{error.message}</Text>
          </View>
        )}

        {!puede && !isPending && (
          <View className="mt-4 rounded-lg bg-slate-100 p-3">
            <Text className="text-sm text-slate-600">
              Podés ver el plantel, pero no cambiarlo: eso lo hace la jefatura o la Secretaría de
              este grupo.
            </Text>
          </View>
        )}

        <View className="mt-4 overflow-hidden rounded-lg bg-white">
          {adultos.map((persona) => {
            const jefatura = persona.cargos.find(
              (cargo) => cargo.cargo === JEFATURA && vigente(cargo, ahora),
            )
            // Por tipo y no el primero vigente: alguien del grupo puede estar
            // además en un equipo diocesano, y sin el filtro se dibujaba como
            // Secretaría —y quitarla revocaba el equipo equivocado—.
            const secretaria = persona.equipos.find(
              (equipo) => equipo.tipo === SECRETARIA && vigente(equipo, ahora),
            )

            return (
              <View key={persona.id} className="border-b border-slate-200 px-4 py-3">
                <Text className="text-sm font-medium text-slate-900">
                  {nombreCompleto(persona)}
                </Text>

                <View className="mt-1.5 flex-row flex-wrap items-center gap-2">
                  {jefatura && (
                    <View className="rounded-full bg-slate-100 px-2.5 py-1">
                      <Text className="text-xs text-slate-700">Jefatura</Text>
                    </View>
                  )}
                  {secretaria && (
                    <View className="rounded-full bg-slate-100 px-2.5 py-1">
                      <Text className="text-xs text-slate-700">Secretaría</Text>
                    </View>
                  )}

                  {puede && jefatura && (
                    <Accion onPress={() => revocarCargo.mutate({ cargoId: jefatura.id })}>
                      Quitar jefatura
                    </Accion>
                  )}
                  {puede && !jefatura && (
                    <Accion
                      onPress={() =>
                        asignar.mutate({
                          personaId: persona.id,
                          cargo: JEFATURA,
                          ambitoId: id,
                          desde: hoy,
                        })
                      }
                    >
                      + Jefatura
                    </Accion>
                  )}
                  {puede && secretaria && (
                    <Accion onPress={() => revocarEquipo.mutate({ integranteId: secretaria.id })}>
                      Quitar Secretaría
                    </Accion>
                  )}
                  {puede && !secretaria && (
                    <Accion
                      onPress={() =>
                        integrar.mutate({
                          personaId: persona.id,
                          tipo: SECRETARIA,
                          ambitoId: id,
                          desde: hoy,
                        })
                      }
                    >
                      + Secretaría
                    </Accion>
                  )}
                </View>

                {puede && <Enlace personaId={persona.id} nombre={persona.nombres} />}
              </View>
            )
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
