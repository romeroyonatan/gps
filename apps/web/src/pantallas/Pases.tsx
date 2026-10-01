import { ErrorDeApi, useActor, useGrupo, usePersonasDelGrupo, useRegistrarPases } from '@gps/api'
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
import { type FormEvent, useState } from 'react'
import { useLocation } from 'wouter'
import {
  BOTON_PRINCIPAL,
  CAMPO,
  Campo,
  Cargando,
  ELEGIBLE,
  ELEGIDO,
  Falla,
  Nota,
  Titulo,
  Vacio,
  Volver,
} from '../ui'

type PersonaDeLaApi = NonNullable<
  ReturnType<typeof usePersonasDelGrupo>['data']
>['personas'][number]

/** La misma persona con la pertenencia normalizada: lo que el dominio pide. */
type Persona = PersonaDeLaApi & {
  readonly pertenencia: PersonaDeLaApi['pertenencia'] & { readonly unidadId: string | null }
}

/** Lo elegido para una persona: si pasa y a dónde. Una sola estructura en vez
 *  de dos estados paralelos —quiénes pasan y qué destino tiene cada uno—, que
 *  se desincronizan apenas alguien se destilda. */
type Elegido = { readonly unidadDestinoId: string; readonly categoria: Pase['categoria'] }

const claveDelDestino = (destino: DestinoDelPase) => `${destino.unidad.id}:${destino.categoria}`

/** La ceremonia de pases: los chicos que cambian de rama, todos el mismo día.
 *
 *  La lista no se arma a mano: la edad ya dice a quién le toca, y el dirigente
 *  destilda al que no fue y suma al que pasó antes de tiempo. Es la misma forma
 *  que la elección de participantes de una salida —unidades primero, gente
 *  después—, con el `candidatosAlPase` del dominio en el lugar de `candidatos`.
 *
 *  No se guarda ninguna "ceremonia": lo que queda son las pertenencias nuevas,
 *  todas con el mismo `desde`. */
export function Pases(props: { grupoId: string }) {
  const { grupo, isPending: cargandoGrupo } = useGrupo(props.grupoId)
  const { data, isPending, error } = usePersonasDelGrupo(props.grupoId)
  const registrar = useRegistrarPases()
  const actor = useActor()
  const [, navegar] = useLocation()

  const hoy = aFechaDeCalendario(new Date())
  const [fecha, setFecha] = useState(hoy)
  const [unidadesElegidas, setUnidadesElegidas] = useState<readonly string[]>([])
  // Lo que el dirigente cambió sobre la propuesta, no la selección entera:
  // `null` es "destildado a mano". Guardar la selección completa obligaría a
  // recalcularla con cada cambio de fecha o de unidad, y a acordarse de
  // limpiarla; así la propuesta siempre sale del dominio y esto es la
  // excepción.
  const [decisiones, setDecisiones] = useState<Readonly<Record<string, Elegido | null>>>({})

  const volver = `/grupos/${props.grupoId}/nomina`
  const unidades: readonly UnidadDelPase[] = grupo?.unidades ?? []

  // Sólo las unidades con algún destino: de la Tropa de adultos no se pasa a
  // ningún lado, y ofrecerla sería ofrecer lo que después se rechaza.
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

  function alternarUnidad(unidadId: string, entra: boolean) {
    setUnidadesElegidas((previas) =>
      entra ? [...previas, unidadId] : previas.filter((id) => id !== unidadId),
    )
  }

  /** El destino que viene elegido para esa unidad. Sin propuesta —dos tropas y
   *  un origen mixto— queda vacío y la fila espera a que alguien elija. */
  function propuestaDe(unidad: UnidadDelPase): Elegido {
    const propuesto = destinoPropuesto(unidad, destinosDelPase(unidad, unidades))
    return {
      unidadDestinoId: propuesto?.unidad.id ?? '',
      categoria: propuesto?.categoria ?? 'beneficiario',
    }
  }

  /** A dónde va quien pasa: lo decidido a mano, o la propuesta para los que
   *  cumplen la edad. `null` en los que no pasan. */
  function destinoDe(personaId: string, unidad: UnidadDelPase, cumple: boolean): Elegido | null {
    const decidido = decisiones[personaId]
    if (decidido !== undefined) return decidido
    return cumple ? propuestaDe(unidad) : null
  }

  // Los pases salen de lo que está en pantalla y no de un acumulador: una
  // unidad que se destilda deja de aportar gente sin que haya que limpiar nada.
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

  function enviar(evento: FormEvent) {
    evento.preventDefault()
    registrar.mutate(
      { grupoId: props.grupoId, fecha, pases: [...pases] },
      { onSuccess: () => navegar(volver) },
    )
  }

  // La misma política pura que aplica el servidor: quien llega de memoria a
  // esta dirección sin poder administrar se encuentra con el motivo.
  if (actor !== null && !puedeAdministrarPlantelDeGrupo(actor, props.grupoId)) {
    return (
      <>
        <Volver href={volver}>Nómina</Volver>
        <Nota>Los pases los registra la jefatura del grupo o su Secretaría.</Nota>
      </>
    )
  }

  return (
    <>
      <Volver href={volver}>Nómina</Volver>
      <Titulo acompaña="La lista sale de la edad: destildá a los que no pasaron y sumá a los que sí.">
        Ceremonia de pases
      </Titulo>

      {(isPending || cargandoGrupo) && <Cargando>Consultando la nómina…</Cargando>}
      {error && <Falla>No se pudo consultar la nómina: {error.message}</Falla>}

      {!isPending && !cargandoGrupo && (
        <form onSubmit={enviar} className="mt-4 space-y-5">
          <Campo etiqueta="Fecha de la ceremonia">
            <input
              type="date"
              value={fecha}
              max={hoy}
              onChange={(evento) => setFecha(evento.target.value)}
              className={`${CAMPO} h-12`}
            />
          </Campo>

          <div>
            <p className="font-semibold">¿Qué unidades pasan?</p>
            {conDestino.length === 0 ? (
              <Vacio>El grupo no tiene ninguna unidad con una rama siguiente abierta.</Vacio>
            ) : (
              <ul className="mt-1.5">
                {conDestino.map((unidad) => (
                  <li key={unidad.id}>
                    <label className="flex min-h-11 items-center gap-3 text-sm">
                      <input
                        type="checkbox"
                        checked={unidadesElegidas.includes(unidad.id)}
                        onChange={(evento) => alternarUnidad(unidad.id, evento.target.checked)}
                        className="size-5 shrink-0 accent-black"
                      />
                      {nombreDeLaUnidad(unidad)}
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>

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

          {registrar.error && (
            <Falla>
              {registrar.error instanceof ErrorDeApi
                ? registrar.error.message
                : 'No se pudieron registrar los pases.'}
            </Falla>
          )}
          {faltaDestino && <Nota>Elegí a dónde pasa cada uno de los tildados.</Nota>}

          <button
            type="submit"
            disabled={pases.length === 0 || faltaDestino || registrar.isPending}
            className={BOTON_PRINCIPAL}
          >
            {pases.length === 1 ? 'Confirmar 1 pase' : `Confirmar ${pases.length} pases`}
          </button>
        </form>
      )}
    </>
  )
}

/** Una unidad y su gente, en dos listas: los que ya tienen la edad —tildados—
 *  y los que la cumplen dentro del año —sin tildar—. Son dos secciones y no una
 *  con marca porque arrancan en estados distintos. */
function BloqueDeUnidad(props: {
  bloque: CandidatosDeLaUnidad<Persona>
  unidades: readonly UnidadDelPase[]
  destinoDe: (personaId: string, unidad: UnidadDelPase, cumple: boolean) => Elegido | null
  onAlternar: (personaId: string, unidad: UnidadDelPase, pasa: boolean) => void
  onElegirDestino: (personaId: string, destino: DestinoDelPase) => void
}) {
  const { bloque, unidades } = props
  const destinos = destinosDelPase(bloque.unidad, unidades)

  if (bloque.cumplen.length === 0 && bloque.cerca.length === 0) {
    return (
      <div>
        <p className="font-semibold">{nombreDeLaUnidad(bloque.unidad)}</p>
        <p className="mt-1 text-sm text-ink-faint">Nadie de esta unidad está en edad de pasar.</p>
      </div>
    )
  }

  return (
    <div>
      <p className="font-semibold">{nombreDeLaUnidad(bloque.unidad)}</p>
      {[
        { titulo: 'Cumplen la edad', candidatos: bloque.cumplen, cumple: true },
        { titulo: 'Cerca de cumplirla', candidatos: bloque.cerca, cumple: false },
      ]
        .filter((seccion) => seccion.candidatos.length > 0)
        .map((seccion) => (
          <div key={seccion.titulo} className="mt-2">
            <p className="text-label text-ink-muted">
              {seccion.titulo}
              <span className="ml-2 tabular-nums">{seccion.candidatos.length}</span>
            </p>
            <ul>
              {seccion.candidatos.map((candidato) => {
                const elegido = props.destinoDe(candidato.persona.id, bloque.unidad, seccion.cumple)
                return (
                  <li
                    key={candidato.persona.id}
                    className="border-b border-line py-2 last:border-b-0"
                  >
                    <label className="flex min-h-11 items-center gap-3 text-sm">
                      <input
                        type="checkbox"
                        checked={elegido !== null}
                        onChange={(evento) =>
                          props.onAlternar(
                            candidato.persona.id,
                            bloque.unidad,
                            evento.target.checked,
                          )
                        }
                        className="size-5 shrink-0 accent-black"
                      />
                      <span className="min-w-0 flex-1 truncate">
                        {nombreCompleto(candidato.persona)}
                      </span>
                      <span className="shrink-0 text-ink-muted tabular-nums">
                        {candidato.edad} años
                      </span>
                    </label>
                    {/* El destino sólo cuando pasa y hay más de uno posible:
                        con uno solo, elegir entre uno no es elegir. */}
                    {elegido !== null && destinos.length > 1 && (
                      <div className="mt-1 flex flex-wrap gap-2 pl-8">
                        {destinos.map((destino) => {
                          const elegida =
                            destino.unidad.id === elegido.unidadDestinoId &&
                            destino.categoria === elegido.categoria
                          return (
                            <button
                              key={claveDelDestino(destino)}
                              type="button"
                              onClick={() => props.onElegirDestino(candidato.persona.id, destino)}
                              className={`inline-flex min-h-9 items-center rounded-full border px-3 text-sm font-semibold ${
                                elegida ? ELEGIDO : ELEGIBLE
                              }`}
                            >
                              {destino.categoria === 'activo'
                                ? `Dirigente en ${destino.unidad.nombre}`
                                : destino.unidad.nombre}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
    </div>
  )
}
