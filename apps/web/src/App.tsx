// apps/web/src/App.tsx
import { useVersion } from '@gps/api'

export function App() {
  const { data, isPending, error } = useVersion()

  return (
    <main className="min-h-dvh bg-slate-50 px-4 py-10 text-slate-900">
      <div className="mx-auto w-full max-w-md sm:max-w-lg">
        <h1 className="text-2xl font-semibold">GPS</h1>
        <p className="mt-1 text-sm text-slate-500">Gestión para Scouts</p>

        {isPending && <p className="mt-8 text-sm text-slate-500">Consultando la versión…</p>}

        {error && (
          <p className="mt-8 rounded-lg bg-red-50 p-4 text-sm text-red-800">
            No se pudo consultar la versión: {error.message}
          </p>
        )}

        {data && (
          <dl className="mt-8 divide-y divide-slate-200 rounded-lg bg-white shadow-sm">
            <div className="flex justify-between px-4 py-3">
              <dt className="text-sm text-slate-500">Versión</dt>
              <dd className="text-sm font-medium">{data.version.numero}</dd>
            </div>
            <div className="flex justify-between px-4 py-3">
              <dt className="text-sm text-slate-500">Entorno</dt>
              <dd className="text-sm font-medium">{data.version.entorno}</dd>
            </div>
            <div className="flex justify-between px-4 py-3">
              <dt className="text-sm text-slate-500">Módulos</dt>
              <dd className="text-sm font-medium">{data.version.modulos.join(', ')}</dd>
            </div>
          </dl>
        )}
      </div>
    </main>
  )
}
