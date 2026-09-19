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
    <div className="mt-4 flex flex-wrap items-center gap-2 border-b border-slate-200 pb-4">
      {funciones.map((funcion) => (
        <span
          key={funcion}
          className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700"
        >
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
        className="ml-auto text-xs font-medium text-slate-500 hover:text-slate-900"
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
        <p className="mt-8 text-sm text-slate-500">No hay nada en esta dirección.</p>
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

  return (
    <main className="min-h-dvh bg-slate-50 px-4 py-10 text-slate-900">
      <div className="mx-auto w-full max-w-md sm:max-w-2xl">
        <h1 className="text-2xl font-semibold">GPS</h1>
        <p className="mt-1 text-sm text-slate-500">Gestión para Scouts</p>

        {/* Mientras no se sepa quién es, no se dibuja ni el login ni las
            pantallas: mostrar el login un instante a alguien que ya entró es
            peor que esperar. */}
        {sesion.isPending && <p className="mt-8 text-sm text-slate-500">Un momento…</p>}

        {!sesion.isPending && !quien && <Ingreso entorno={version.data?.version.entorno ?? ''} />}

        {!enlace && quien && (
          <>
            <BarraDeSesion roles={quien.roles} />
            <ModoElevado entorno={version.data?.version.entorno ?? ''} />
            <Rutas />
          </>
        )}

        {version.data && (
          <p className="mt-10 text-xs text-slate-400">
            v{version.data.version.numero} · {version.data.version.entorno} ·{' '}
            {version.data.version.modulos.join(', ')}
          </p>
        )}
      </div>
    </main>
  )
}
