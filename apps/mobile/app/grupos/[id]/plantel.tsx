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
import { useLocalSearchParams } from 'expo-router'
import { Pressable, ScrollView, Share, Text, View } from 'react-native'
import { AccionAlMargen, Cargando, Etiqueta, Falla, Nota, Titulo, Volver } from '../../../src/ui'

/** Lo que esta pantalla administra: la jefatura del grupo y su Secretaría.
 *  Son los dos vínculos que conceden acceso, que son los que hay que poder
 *  cambiar en el día. */
const JEFATURA = 'jefeDeGrupo'
const SECRETARIA = 'secretaria'

/** El cliente generado deja `hasta` como opcional; `estaVigente` quiere el
 *  null explícito. Las dos puntas inclusivas, como siempre. */
const vigente = (periodo: { desde: string; hasta?: string | null }, ahora: Date) =>
  estaVigente({ desde: periodo.desde, hasta: periodo.hasta ?? null }, ahora)

/** El enlace de acceso, para compartir a mano. Se muestra una sola vez: del
 *  secreto el servidor sólo guarda el hash. En el teléfono la Share API es
 *  nativa: abre WhatsApp directo, que es como se comparte de verdad. */
function Enlace(props: { personaId: string; nombre: string }) {
  const invitar = useInvitar()
  const url = invitar.data?.invitar.url ?? null

  if (!url) {
    return (
      <AccionAlMargen
        onPress={() => invitar.mutate({ personaId: props.personaId, tipo: 'activacion' })}
        disabled={invitar.isPending}
      >
        {invitar.isPending ? 'Generando…' : 'Generar enlace de acceso'}
      </AccionAlMargen>
    )
  }

  return (
    <View className="mt-3 rounded-lg bg-warn-soft p-3">
      <Text className="text-sm text-warn">
        Este enlace le da acceso a {props.nombre} y se ve una sola vez. Vence en siete días.
      </Text>
      <Text className="mt-1.5 text-sm text-warn">{url}</Text>
      <Pressable
        accessibilityRole="button"
        className="mt-2 min-h-9 justify-center"
        onPress={() => {
          void Share.share({ message: `Activá tu acceso a GPS: ${url}` })
        }}
      >
        <Text className="text-sm font-semibold text-warn underline">Compartir</Text>
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
    <ScrollView className="flex-1 bg-surface" contentContainerClassName="px-4 pb-10">
      <Volver href={`/grupos/${id}/mas`}>Más</Volver>
      <Titulo acompaña="Quién administra este grupo. Los cargos y los equipos son lo que da acceso: al sacarlos, se pierde en el pedido siguiente.">
        Plantel
      </Titulo>

      {isPending && <Cargando>Consultando el plantel…</Cargando>}
      {error && <Falla>No se pudo consultar el plantel: {error.message}</Falla>}

      {!puede && !isPending && (
        <Nota>
          Podés ver el plantel, pero no cambiarlo: eso lo hace la jefatura o la Secretaría de este
          grupo.
        </Nota>
      )}

      <View className="mt-4">
        {adultos.map((persona) => {
          const jefatura = persona.cargos.find(
            (cargo) => cargo.cargo === JEFATURA && vigente(cargo, ahora),
          )
          // Puede integrar además un equipo diocesano: sólo Secretaría de
          // grupo concede el vínculo que esta pantalla administra.
          const secretaria = persona.equipos.find(
            (equipo) => equipo.tipo === SECRETARIA && vigente(equipo, ahora),
          )

          return (
            <View key={persona.id} className="border-b border-line py-3">
              <Text className="text-sm font-semibold text-ink">{nombreCompleto(persona)}</Text>

              <View className="mt-1.5 flex-row flex-wrap items-center gap-2">
                {jefatura && (
                  <Etiqueta
                    onQuitar={
                      puede ? () => revocarCargo.mutate({ cargoId: jefatura.id }) : undefined
                    }
                    quitando={revocarCargo.isPending}
                  >
                    Jefatura
                  </Etiqueta>
                )}
                {secretaria && (
                  <Etiqueta
                    onQuitar={
                      puede
                        ? () => revocarEquipo.mutate({ integranteId: secretaria.id })
                        : undefined
                    }
                    quitando={revocarEquipo.isPending}
                  >
                    Secretaría
                  </Etiqueta>
                )}

                {puede && !jefatura && (
                  <AccionAlMargen
                    disabled={asignar.isPending}
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
                  </AccionAlMargen>
                )}
                {puede && !secretaria && (
                  <AccionAlMargen
                    disabled={integrar.isPending}
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
                  </AccionAlMargen>
                )}
              </View>

              {puede && <Enlace personaId={persona.id} nombre={persona.nombres} />}
            </View>
          )
        })}
      </View>

      {[asignar.error, revocarCargo.error, integrar.error, revocarEquipo.error]
        .filter((problema) => problema !== null)
        .map((problema) => (
          <Falla key={problema.message}>{problema.message}</Falla>
        ))}
    </ScrollView>
  )
}
