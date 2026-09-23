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
import { useState } from 'react'
import { Aviso, Cargando, Chip, Falla, Nota, Titulo, Volver } from '../ui'

/** Lo que esta pantalla administra: la jefatura del grupo y su Secretaría.
 *  Los demás cargos se cargan al dar de alta a la persona; acá están los dos
 *  que conceden acceso, que son los que hay que poder cambiar en el día. */
const JEFATURA = 'jefeDeGrupo'
const SECRETARIA = 'secretaria'

/** El cliente generado deja `hasta` como opcional; `estaVigente` quiere el
 *  null explícito. Es la misma regla de siempre: las dos puntas inclusivas. */
const vigente = (periodo: { desde: string; hasta?: string | null }, hoy: Date) =>
  estaVigente({ desde: periodo.desde, hasta: periodo.hasta ?? null }, hoy)

function Etiqueta(props: { children: React.ReactNode; onQuitar?: () => void; quitando?: boolean }) {
  return (
    <Chip>
      {props.children}
      {props.onQuitar && (
        <button
          type="button"
          onClick={props.onQuitar}
          disabled={props.quitando}
          className="text-ink-faint hover:text-danger disabled:opacity-40"
          aria-label="Quitar"
        >
          ×
        </button>
      )}
    </Chip>
  )
}

/** El enlace de activación o recuperación, para compartir a mano.
 *
 *  Se muestra una sola vez: del secreto el servidor sólo guarda el hash, así
 *  que si se pierde hay que emitir otro. Share API donde existe -es lo que
 *  abre WhatsApp directo- y copiar donde no. */
function Enlace(props: { personaId: string; nombre: string }) {
  const invitar = useInvitar()
  // El servidor devuelve una ruta relativa cuando no tiene configurado su
  // origen público -el demo, por ejemplo-. Un enlace relativo no sirve para
  // mandar por WhatsApp, y el origen lo sabe el cliente.
  const devuelta = invitar.data?.invitar.url ?? null
  const url = devuelta?.startsWith('/') ? `${window.location.origin}${devuelta}` : devuelta
  const [copiado, setCopiado] = useState(false)

  const compartir = async () => {
    if (!url) return
    const texto = `Activá tu acceso a GPS: ${url}`
    if (navigator.share) {
      await navigator.share({ text: texto }).catch(() => {})
      return
    }
    await navigator.clipboard.writeText(url)
    setCopiado(true)
  }

  if (!url) {
    return (
      <button
        type="button"
        onClick={() => invitar.mutate({ personaId: props.personaId, tipo: 'activacion' })}
        disabled={invitar.isPending}
        className="min-h-9 text-label font-medium text-ink-muted hover:text-ink disabled:opacity-40"
      >
        {invitar.isPending ? 'Generando…' : 'Generar enlace de acceso'}
      </button>
    )
  }

  return (
    <Aviso>
      Este enlace le da acceso a {props.nombre} y se ve una sola vez. Vence en siete días.
      <span className="mt-1.5 block break-all">{url}</span>
      <button
        type="button"
        onClick={compartir}
        className="mt-2 block min-h-9 font-semibold underline"
      >
        {copiado ? 'Copiado' : 'Compartir'}
      </button>
    </Aviso>
  )
}

export function Plantel(props: { grupoId: string }) {
  const { data, isPending, error } = usePersonasDelGrupo(props.grupoId)
  const actor = useActor()
  const asignar = useAsignarCargo()
  const revocarCargo = useRevocarCargo()
  const integrar = useIntegrarEquipo()
  const revocarEquipo = useRevocarIntegranteDeEquipo()

  // El hoy de quien mira la pantalla, no el del servidor: la misma razón por la
  // que el servidor manda las fechas y no un booleano `vigente`.
  const ahora = new Date()
  const hoy = aFechaDeCalendario(ahora)
  // La misma función pura que aplica el servidor, con el mismo actor: la
  // pantalla no inventa una regla propia, y por eso no puede ofrecer algo que
  // el servidor rechace.
  const puede = actor !== null && puedeAdministrarPlantelDeGrupo(actor, props.grupoId)

  if (isPending) return <Cargando>Consultando el plantel…</Cargando>
  if (error) {
    return <Falla>No se pudo consultar el plantel: {error.message}</Falla>
  }

  const adultos = data.personas.filter(
    (persona) => persona.pertenencia.categoria !== 'beneficiario',
  )

  return (
    <section>
      <div className="md:hidden">
        <Volver href={`/grupos/${props.grupoId}/mas`}>Más</Volver>
      </div>
      <Titulo acompaña="Quién administra este grupo. Los cargos y los equipos son lo que da acceso: al sacarlos, se pierde en el pedido siguiente.">
        Plantel
      </Titulo>

      {!puede && (
        <Nota>
          Podés ver el plantel, pero no cambiarlo: eso lo hace la jefatura o la Secretaría de este
          grupo.
        </Nota>
      )}

      <ul className="mt-4">
        {adultos.map((persona) => {
          const jefatura = persona.cargos.find(
            (cargo) => cargo.cargo === JEFATURA && vigente(cargo, ahora),
          )
          // Por tipo y no el primero vigente: alguien del grupo puede estar
          // además en un equipo diocesano, y sin el filtro se dibujaba como
          // Secretaría —y la × revocaba el equipo equivocado—.
          const secretaria = persona.equipos.find(
            (equipo) => equipo.tipo === SECRETARIA && vigente(equipo, ahora),
          )

          return (
            <li key={persona.id} className="border-b border-line py-3 last:border-b-0">
              <p className="text-sm font-semibold">{nombreCompleto(persona)}</p>

              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
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
                  <button
                    type="button"
                    onClick={() =>
                      asignar.mutate({
                        personaId: persona.id,
                        cargo: JEFATURA,
                        ambitoId: props.grupoId,
                        desde: hoy,
                      })
                    }
                    disabled={asignar.isPending}
                    className="min-h-9 text-label font-medium text-ink-muted hover:text-ink"
                  >
                    + Jefatura
                  </button>
                )}
                {puede && !secretaria && (
                  <button
                    type="button"
                    onClick={() =>
                      integrar.mutate({
                        personaId: persona.id,
                        tipo: SECRETARIA,
                        ambitoId: props.grupoId,
                        desde: hoy,
                      })
                    }
                    disabled={integrar.isPending}
                    className="min-h-9 text-label font-medium text-ink-muted hover:text-ink"
                  >
                    + Secretaría
                  </button>
                )}
              </div>

              {puede && <Enlace personaId={persona.id} nombre={persona.nombres} />}
            </li>
          )
        })}
      </ul>

      {[asignar.error, revocarCargo.error, integrar.error, revocarEquipo.error]
        .filter((problema) => problema !== null)
        .map((problema) => (
          <Falla key={problema.message}>{problema.message}</Falla>
        ))}
    </section>
  )
}
