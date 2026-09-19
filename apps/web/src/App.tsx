// apps/web/src/App.tsx
import { useVersion } from '@gps/api'
import { Route, Switch } from 'wouter'
import { Afiliacion } from './pantallas/Afiliacion'
import { ConfiguracionDeCuotas } from './pantallas/ConfiguracionDeCuotas'
import { CuentaDeGrupo } from './pantallas/CuentaDeGrupo'
import { Estructura } from './pantallas/Estructura'
import { Grupo } from './pantallas/Grupo'
import { Tesoreria } from './pantallas/Tesoreria'

export function App() {
  const version = useVersion()

  return (
    <main className="min-h-dvh bg-slate-50 px-4 py-10 text-slate-900">
      <div className="mx-auto w-full max-w-md sm:max-w-2xl">
        <h1 className="text-2xl font-semibold">GPS</h1>
        <p className="mt-1 text-sm text-slate-500">Gestión para Scouts</p>

        <Switch>
          <Route path="/" component={Estructura} />
          <Route path="/tesoreria/grupos/:id">
            {(params) => <CuentaDeGrupo grupoId={params.id} />}
          </Route>
          <Route path="/tesoreria/configuracion" component={ConfiguracionDeCuotas} />
          <Route path="/tesoreria" component={Tesoreria} />
          <Route path="/grupos/:id/afiliacion">
            {(params) => <Afiliacion grupoId={params.id} />}
          </Route>
          <Route path="/grupos/:id">{(params) => <Grupo id={params.id} />}</Route>
          <Route>
            <p className="mt-8 text-sm text-slate-500">No hay nada en esta dirección.</p>
          </Route>
        </Switch>

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
