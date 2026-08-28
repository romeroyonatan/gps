// apps/web/src/App.tsx
import { useVersion } from '@gps/api'
import type { ReactNode } from 'react'
import { Link, Route, Switch, useRoute } from 'wouter'
import { Estructura } from './pantallas/Estructura'
import { Personas } from './pantallas/Personas'

function Solapa(props: { href: string; children: ReactNode }) {
  const [activa] = useRoute(props.href)
  return (
    <Link
      href={props.href}
      className={`rounded-full px-3 py-1.5 text-sm ${
        activa ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-200'
      }`}
    >
      {props.children}
    </Link>
  )
}

export function App() {
  const version = useVersion()

  return (
    <main className="min-h-dvh bg-slate-50 px-4 py-10 text-slate-900">
      <div className="mx-auto w-full max-w-md sm:max-w-2xl">
        <h1 className="text-2xl font-semibold">GPS</h1>
        <p className="mt-1 text-sm text-slate-500">Gestión para Scouts</p>

        <nav className="mt-6 flex gap-1">
          <Solapa href="/">Estructura</Solapa>
          <Solapa href="/personas">Personas</Solapa>
        </nav>

        <Switch>
          <Route path="/" component={Estructura} />
          <Route path="/personas" component={Personas} />
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
