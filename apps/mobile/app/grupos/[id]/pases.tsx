import { useActor, useGrupo, usePersonasDelGrupo, useRegistrarPases } from '@gps/api'
import { aFechaDeCalendario } from '@gps/core/fechas'
import { nombreDeLaUnidad } from '@gps/estructura/dominio'
import {
  type CandidatosDeLaUnidad,
  candidatosAlPase,
  type DestinoDelPase,
  destinoPropuesto,
  destinosDelPase,
  nombreCompleto,
  type Pase,
  puedeAdministrarPlantelDeGrupo,
  type UnidadDelPase,
} from '@gps/personas/dominio'
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { ScrollView, Text, TextInput, View } from 'react-native'
import {
  Boton,
  CAMPO,
  Campo,
  Cargando,
  Casilla,
  Falla,
  Filtros,
  Nota,
  Titulo,
  Vacio,
  Volver,
} from '../../../src/ui'

type PersonaDeLaApi = NonNullable<
  ReturnType<typeof usePersonasDelGrupo>['data']
>['personas'][number]

/** La misma persona con la pertenencia normalizada: lo que el dominio pide. */
type Persona = PersonaDeLaApi & {
  readonly pertenencia: PersonaDeLaApi['pertenencia'] & { readonly unidadId: string | null }
}

type Elegido = { readonly unidadDestinoId: string; readonly categoria: Pase['categoria'] }

const claveDelDestino = (destino: DestinoDelPase) => `${destino.unidad.id}:${destino.categoria}`

/** La ceremonia de pases: los chicos que cambian de rama, todos el mismo día.
 *  La gemela de `apps/web/src/pantallas/Pases.tsx`: mismo orden de bloques y
 *  las mismas reglas, que vienen del `/dominio` de personas. */
export default function Pantalla() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { grupo, isPending: cargandoGrupo } = useGrupo(id)
  const { data, isPending, error } = usePersonasDelGrupo(id)
  const registrar = useRegistrarPases()
  const actor = useActor()

  const hoy = aFechaDeCalendario(new Date())
  const [fecha, setFecha] = useState(hoy)
  const [unidadesElegidas, setUnidadesElegidas] = useState<readonly string[]>([])
  // Lo que se cambió sobre la propuesta, no la selección entera: `null` es
  // "destildado a mano". Igual que en la web.
  const [decisiones, setDecisiones] = useState<Readonly<Record<string, Elegido | null>>>({})

  const volver = `/grupos/${id}/nomina`
  const unidades: readonly UnidadDelPase[] = grupo?.unidades ?? []
  const conDestino = unidades.filter((unidad) => destinosDelPase(unidad, unidades).length > 0)
  // El `unidadId` generado es opcional; el del dominio es `string | null` a
  // secas. Se normaliza en esta frontera, como en el resto de las pantallas.
  const personas = (data?.personas ?? []).map((persona) => ({
    ...persona,
    pertenencia: { ...persona.pertenencia, unidadId: persona.pertenencia.unidadId ?? null },
  }))
  const bloques = candidatosAlPase(
    personas,
    conDestino.filter((unidad) => unidadesElegidas.includes(unidad.id)),
    fecha,
  )

  function propuestaDe(unidad: UnidadDelPase): Elegido {
    const propuesto = destinoPropuesto(unidad, destinosDelPase(unidad, unidades))
    return {
      unidadDestinoId: propuesto?.unidad.id ?? '',
      categoria: propuesto?.categoria ?? 'beneficiario',
    }
  }

  function destinoDe(personaId: string, unidad: UnidadDelPase, cumple: boolean): Elegido | null {
    const decidido = decisiones[personaId]
    if (decidido !== undefined) return decidido
    return cumple ? propuestaDe(unidad) : null
  }

  const pases: readonly Pase[] = bloques.flatMap((bloque) =>
    [
      ...bloque.cumplen.map((candidato) => ({ candidato, cumple: true })),
      ...bloque.cerca.map((candidato) => ({ candidato, cumple: false })),
    ].flatMap(({ candidato, cumple }) => {
      const destino = destinoDe(candidato.persona.id, bloque.unidad, cumple)
      return destino
        ? [
            {
              personaId: candidato.persona.id,
              unidadDeOrigenId: bloque.unidad.id,
              unidadDestinoId: destino.unidadDestinoId,
              categoria: destino.categoria,
            },
          ]
        : []
    }),
  )
  const faltaDestino = pases.some((pase) => pase.unidadDestinoId === '')

  // La misma política pura que aplica el servidor: quien llega de memoria a
  // esta dirección sin poder administrar se encuentra con el motivo.
  if (actor !== null && !puedeAdministrarPlantelDeGrupo(actor, id)) {
    return (
      <ScrollView className="flex-1 bg-surface" contentContainerClassName="px-4 pb-10">
        <Volver href={volver}>Nómina</Volver>
        <Nota>Los pases los registra la jefatura del grupo o su Secretaría.</Nota>
      </ScrollView>
    )
  }

  return (
    <ScrollView className="flex-1 bg-surface" contentContainerClassName="px-4 pb-10">
      <Volver href={volver}>Nómina</Volver>
      <Titulo acompaña="La lista sale de la edad: destildá a los que no pasaron y sumá a los que sí.">
        Ceremonia de pases
      </Titulo>

      {(isPending || cargandoGrupo) && <Cargando>Consultando la nómina…</Cargando>}
      {error && <Falla>No se pudo consultar la nómina: {error.message}</Falla>}

      {!isPending && !cargandoGrupo && (
        <View className="mt-4 gap-5">
          {/* No hay <input type="date"> en React Native. El texto crudo alcanza
              porque el servidor valida la fecha igual. */}
          <Campo etiqueta="Fecha de la ceremonia">
            <TextInput
              className={CAMPO}
              placeholder="aaaa-mm-dd"
              keyboardType="numbers-and-punctuation"
              value={fecha}
              onChangeText={setFecha}
            />
          </Campo>

          <View>
            <Text className="text-label font-semibold text-ink">¿Qué unidades pasan?</Text>
            {conDestino.length === 0 ? (
              <Vacio>El grupo no tiene ninguna unidad con una rama siguiente abierta.</Vacio>
            ) : (
              conDestino.map((unidad) => (
                <Casilla
                  key={unidad.id}
                  marcada={unidadesElegidas.includes(unidad.id)}
                  onCambiar={() =>
                    setUnidadesElegidas((previas) =>
                      previas.includes(unidad.id)
                        ? previas.filter((otra) => otra !== unidad.id)
                        : [...previas, unidad.id],
                    )
                  }
                >
                  <Text className="text-sm text-ink">{nombreDeLaUnidad(unidad)}</Text>
                </Casilla>
              ))
            )}
          </View>

          {bloques.map((bloque) => (
            <BloqueDeUnidad
              key={bloque.unidad.id}
              bloque={bloque}
              unidades={unidades}
              destinoDe={destinoDe}
              onAlternar={(personaId, unidad, pasa) =>
                setDecisiones((previas) => ({
                  ...previas,
                  [personaId]: pasa ? propuestaDe(unidad) : null,
                }))
              }
              onElegirDestino={(personaId, destino) =>
                setDecisiones((previas) => ({
                  ...previas,
                  [personaId]: {
                    unidadDestinoId: destino.unidad.id,
                    categoria: destino.categoria,
                  },
                }))
              }
            />
          ))}

          {registrar.error && <Falla>{registrar.error.message}</Falla>}
          {faltaDestino && <Nota>Elegí a dónde pasa cada uno de los tildados.</Nota>}

          <Boton
            disabled={pases.length === 0 || faltaDestino || registrar.isPending}
            onPress={() =>
              registrar.mutate(
                { grupoId: id, fecha, pases: [...pases] },
                { onSuccess: () => router.replace(volver) },
              )
            }
          >
            {pases.length === 1 ? 'Confirmar 1 pase' : `Confirmar ${pases.length} pases`}
          </Boton>
        </View>
      )}
    </ScrollView>
  )
}

/** Una unidad y su gente, en dos listas: los que ya tienen la edad —tildados—
 *  y los que la cumplen dentro del año —sin tildar—. */
function BloqueDeUnidad(props: {
  bloque: CandidatosDeLaUnidad<Persona>
  unidades: readonly UnidadDelPase[]
  destinoDe: (personaId: string, unidad: UnidadDelPase, cumple: boolean) => Elegido | null
  onAlternar: (personaId: string, unidad: UnidadDelPase, pasa: boolean) => void
  onElegirDestino: (personaId: string, destino: DestinoDelPase) => void
}) {
  const { bloque, unidades } = props
  const destinos = destinosDelPase(bloque.unidad, unidades)

  return (
    <View>
      <Text className="text-lg font-bold text-ink">{nombreDeLaUnidad(bloque.unidad)}</Text>
      {bloque.cumplen.length === 0 && bloque.cerca.length === 0 && (
        <Text className="mt-1 text-label text-ink-faint">
          Nadie de esta unidad está en edad de pasar.
        </Text>
      )}
      {[
        { titulo: 'Cumplen la edad', candidatos: bloque.cumplen, cumple: true },
        { titulo: 'Cerca de cumplirla', candidatos: bloque.cerca, cumple: false },
      ]
        .filter((seccion) => seccion.candidatos.length > 0)
        .map((seccion) => (
          <View key={seccion.titulo} className="mt-2">
            <Text className="text-label text-ink-muted">
              {seccion.titulo} {seccion.candidatos.length}
            </Text>
            {seccion.candidatos.map((candidato) => {
              const elegido = props.destinoDe(candidato.persona.id, bloque.unidad, seccion.cumple)
              return (
                <View key={candidato.persona.id} className="border-b border-line py-1">
                  <Casilla
                    marcada={elegido !== null}
                    onCambiar={() =>
                      props.onAlternar(candidato.persona.id, bloque.unidad, elegido === null)
                    }
                  >
                    <View className="flex-row items-center gap-3">
                      <Text className="min-w-0 flex-1 text-sm text-ink" numberOfLines={1}>
                        {nombreCompleto(candidato.persona)}
                      </Text>
                      <Text className="text-sm text-ink-muted">{candidato.edad} años</Text>
                    </View>
                  </Casilla>
                  {/* El destino sólo cuando pasa y hay más de uno posible: con
                      uno solo, elegir entre uno no es elegir. */}
                  {elegido !== null && destinos.length > 1 && (
                    <View className="mb-1.5 pl-8">
                      <Filtros
                        opciones={destinos.map((destino) => ({
                          id: claveDelDestino(destino),
                          etiqueta:
                            destino.categoria === 'activo'
                              ? `Dirigente en ${destino.unidad.nombre}`
                              : destino.unidad.nombre,
                        }))}
                        valor={`${elegido.unidadDestinoId}:${elegido.categoria}`}
                        onElegir={(clave) => {
                          const destino = destinos.find((uno) => claveDelDestino(uno) === clave)
                          if (destino) props.onElegirDestino(candidato.persona.id, destino)
                        }}
                      />
                    </View>
                  )}
                </View>
              )
            })}
          </View>
        ))}
    </View>
  )
}
