// apps/web/src/App.tsx
import {
  type ParticionDelCache,
  useCerrarSesion,
  useParticionDelCache,
  usePersonaActual,
  useVersion,
} from '@gps/api'
import { Route, Switch, useRoute } from 'wouter'
import { Afiliacion } from './pantallas/Afiliacion'
import { ConfiguracionDeCuotas } from './pantallas/ConfiguracionDeCuotas'
import { CuentaDeGrupo } from './pantallas/CuentaDeGrupo'
import { Enlace } from './pantallas/Enlace'
import { Estructura } from './pantallas/Estructura'
import { Grupo } from './pantallas/Grupo'
import { Ingreso } from './pantallas/Ingreso'
import { ModoElevado } from './pantallas/ModoElevado'
import { Plantel } from './pantallas/Plantel'
import { Salidas } from './pantallas/Salidas'
import { Tesoreria } from './pantallas/Tesoreria'

/** Las funciones vigentes de quien está adentro, y la salida. No muestra el
 *  nombre porque la sesión no lo trae: lo que importa para entender qué se
 *  puede hacer es la función, no quién. */
function BarraDeSesion(props: { roles: readonly { rol: string }[] }) {
  const cerrar = useCerrarSesion()
  const funciones = [...new Set(props.roles.map((funcion) => funcion.rol))]

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 border-b border-line pb-4">
      {funciones.map((funcion) => (
        <span key={funcion} className="rounded-full bg-surface-3 px-2.5 py-1 text-xs text-ink">
          {funcion}
        </span>
      ))}
      <button
        type="button"
        onClick={() => {
          // Recarga después de cerrar: la cookie ya no está y todo lo que se
          // estaba mostrando era de la sesión anterior.
          cerrar.mutate(undefined, { onSuccess: () => window.location.assign('/') })
        }}
        disabled={cerrar.isPending}
        className="ml-auto text-xs font-medium text-ink-muted hover:text-ink"
      >
        Cerrar sesión
      </button>
    </div>
  )
}

function Rutas() {
  return (
    <Switch>
      <Route path="/" component={Estructura} />
      <Route path="/tesoreria/grupos/:id">
        {(params) => <CuentaDeGrupo grupoId={params.id} />}
      </Route>
      <Route path="/tesoreria/configuracion" component={ConfiguracionDeCuotas} />
      <Route path="/tesoreria" component={Tesoreria} />
      <Route path="/grupos/:id/afiliacion">{(params) => <Afiliacion grupoId={params.id} />}</Route>
      <Route path="/grupos/:id/salidas">{(params) => <Salidas grupoId={params.id} />}</Route>
      <Route path="/grupos/:id/plantel">{(params) => <Plantel grupoId={params.id} />}</Route>
      <Route path="/grupos/:id">{(params) => <Grupo id={params.id} />}</Route>
      <Route>
        <p className="mt-8 text-sm text-ink-muted">No hay nada en esta dirección.</p>
      </Route>
    </Switch>
  )
}

export function App(props: { particion: ParticionDelCache }) {
  const version = useVersion()
  const sesion = usePersonaActual()
  useParticionDelCache(props.particion)
  const quien = sesion.data?.personaActual ?? null

  // Los enlaces de invitación van antes de la puerta: son justamente para
  // quien todavía no tiene sesión, y esperar a saber quién es sólo agrega una
  // pantalla en blanco.
  const [esActivacion, activacion] = useRoute('/activacion/:secreto')
  const [esRecuperacion, recuperacion] = useRoute('/recuperacion/:secreto')
  const enlace = esActivacion
    ? ({ tipo: 'activacion', secreto: activacion.secreto } as const)
    : esRecuperacion
      ? ({ tipo: 'recuperacion', secreto: recuperacion.secreto } as const)
      : null

  // La puerta no lleva el shell: es una pantalla partida a sangre, sin barra
  // ni contenedor, así que sale antes en vez de pelearse con el max-width.
  if (!enlace && !sesion.isPending && !quien) {
    return <Ingreso entorno={version.data?.version.entorno ?? ''} />
  }

  return (
    <div className="min-h-dvh bg-surface font-sans text-base text-ink">
      {/* Barra de 44px con la palabra-marca. El conmutador de rol que pide la
          guía va acá, pero hoy la sesión trae todas las funciones a la vez:
          llega cuando haya una de verdad para elegir. */}
      <header className="flex h-11 items-center gap-2 border-b border-line px-5">
        <span className="text-base font-extrabold tracking-[-0.02em]">GPS</span>
        <span className="text-xs text-ink-muted">Gestión para Scouts</span>
      </header>

      <main className="mx-auto w-full max-w-[1180px] px-5 py-7">
        {/* El enlace de invitación va antes de la puerta: es justamente para
            quien todavía no tiene sesión. */}
        {enlace && <Enlace tipo={enlace.tipo} secreto={enlace.secreto} />}

        {/* Mientras no se sepa quién es, no se dibuja ni el login ni las
            pantallas: mostrar el login un instante a alguien que ya entró es
            peor que esperar. */}
        {!enlace && sesion.isPending && <p className="text-sm text-ink-muted">Un momento…</p>}

        {!enlace && quien && (
          <>
            <BarraDeSesion roles={quien.roles} />
            <ModoElevado entorno={version.data?.version.entorno ?? ''} />
            <Rutas />
          </>
        )}

        {version.data && (
          <p className="mt-10 text-xs tabular-nums text-ink-faint">
            v{version.data.version.numero} · {version.data.version.entorno} ·{' '}
            {version.data.version.modulos.join(', ')}
          </p>
        )}
      </main>
    </div>
  )
}
