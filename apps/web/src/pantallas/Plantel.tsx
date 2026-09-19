import {
  useAsignarCargo,
  useIntegrarEquipo,
  useInvitar,
  usePersonaActual,
  usePersonasDelGrupo,
  useRevocarCargo,
  useRevocarIntegranteDeEquipo,
} from '@gps/api'
import { aFechaDeCalendario } from '@gps/core/fechas'
import { estaVigente, nombreCompleto, puedeAdministrarPlantelDeGrupo } from '@gps/personas/dominio'
import { useState } from 'react'

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
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700">
      {props.children}
      {props.onQuitar && (
        <button
          type="button"
          onClick={props.onQuitar}
          disabled={props.quitando}
          className="text-slate-400 hover:text-red-700"
          aria-label="Quitar"
        >
          ×
        </button>
      )}
    </span>
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
        className="text-xs font-medium text-slate-500 hover:text-slate-900"
      >
        {invitar.isPending ? 'Generando…' : 'Generar enlace de acceso'}
      </button>
    )
  }

  return (
    <div className="mt-1.5 rounded-lg bg-amber-50 p-2">
      <p className="text-xs text-amber-900">
        Este enlace le da acceso a {props.nombre} y se ve una sola vez. Vence en siete días.
      </p>
      <p className="mt-1 text-xs break-all text-amber-800">{url}</p>
      <button
        type="button"
        onClick={compartir}
        className="mt-1.5 text-xs font-medium text-amber-900 underline"
      >
        {copiado ? 'Copiado' : 'Compartir'}
      </button>
    </div>
  )
}

export function Plantel(props: { grupoId: string }) {
  const { data, isPending, error } = usePersonasDelGrupo(props.grupoId)
  const sesion = usePersonaActual()
  const asignar = useAsignarCargo()
  const revocarCargo = useRevocarCargo()
  const integrar = useIntegrarEquipo()
  const revocarEquipo = useRevocarIntegranteDeEquipo()

  // El hoy de quien mira la pantalla, no el del servidor: la misma razón por la
  // que el servidor manda las fechas y no un booleano `vigente`.
  const ahora = new Date()
  const hoy = aFechaDeCalendario(ahora)
  const quien = sesion.data?.personaActual
  // La misma función pura que aplica el servidor: la pantalla no inventa una
  // regla propia, y por eso no puede ofrecer algo que el servidor rechace.
  const puede =
    quien !== null &&
    quien !== undefined &&
    puedeAdministrarPlantelDeGrupo(
      {
        personaId: quien.personaId,
        roles: quien.roles.map((funcion) => ({
          rol: funcion.rol,
          ambito: { tipo: funcion.ambitoTipo, id: funcion.ambitoId ?? null },
        })),
        esAdministradorDesignado: quien.esAdministradorDesignado,
        estaElevado: quien.estaElevado,
      },
      props.grupoId,
    )

  if (isPending) return <p className="mt-8 text-sm text-slate-500">Consultando el plantel…</p>
  if (error) {
    return (
      <p className="mt-8 rounded-lg bg-red-50 p-4 text-sm break-words text-red-800">
        No se pudo consultar el plantel: {error.message}
      </p>
    )
  }

  const adultos = data.personas.filter(
    (persona) => persona.pertenencia.categoria !== 'beneficiario',
  )

  return (
    <section className="mt-8">
      <h2 className="text-lg font-medium text-slate-900">Plantel</h2>
      <p className="mt-1 text-sm text-slate-500">
        Quién administra este grupo. Los cargos y los equipos son lo que da acceso: al sacarlos, se
        pierde en el pedido siguiente.
      </p>

      {!puede && (
        <p className="mt-4 rounded-lg bg-slate-100 p-3 text-sm text-slate-600">
          Podés ver el plantel, pero no cambiarlo: eso lo hace la jefatura o la Secretaría de este
          grupo.
        </p>
      )}

      <ul className="mt-4 divide-y divide-slate-200 overflow-hidden rounded-lg bg-white">
        {adultos.map((persona) => {
          const jefatura = persona.cargos.find(
            (cargo) => cargo.cargo === JEFATURA && vigente(cargo, ahora),
          )
          const secretaria = persona.equipos.find((equipo) => vigente(equipo, ahora))

          return (
            <li key={persona.id} className="px-4 py-3">
              <p className="text-sm font-medium text-slate-900">{nombreCompleto(persona)}</p>

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
                    className="text-xs font-medium text-slate-500 hover:text-slate-900"
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
                    className="text-xs font-medium text-slate-500 hover:text-slate-900"
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
          <p
            key={problema.message}
            className="mt-4 rounded-lg bg-red-50 p-3 text-sm break-words text-red-800"
          >
            {problema.message}
          </p>
        ))}
    </section>
  )
}
