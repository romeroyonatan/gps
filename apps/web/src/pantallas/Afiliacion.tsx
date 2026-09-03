import { useDeclaraciones, useDeclararAfiliacion } from '@gps/api'
import { nombreDelTipo } from '@gps/personas/dominio'
import { Link } from 'wouter'

type Declaracion = NonNullable<ReturnType<typeof useDeclaraciones>['data']>['declaraciones'][number]

function Nomina(props: { declaracion: Declaracion }) {
  const aCobrar = new Set(props.declaracion.aCobrar.map((uno) => uno.personaId))
  return (
    <ul className="mt-2 divide-y divide-slate-200 rounded-lg bg-white shadow-sm">
      {props.declaracion.afiliados.map((afiliado) => (
        <li key={afiliado.personaId} className="px-4 py-3">
          <p className="text-sm font-medium text-slate-900">
            {afiliado.apellidos}, {afiliado.nombres}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {nombreDelTipo(afiliado.tipoDeDocumento)} {afiliado.numeroDeDocumento}
            {aCobrar.has(afiliado.personaId) ? (
              <span className="ml-1.5 rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">
                a cobrar
              </span>
            ) : (
              <span className="ml-1.5 text-slate-400">· ya afiliada</span>
            )}
          </p>
        </li>
      ))}
    </ul>
  )
}

export function Afiliacion(props: { grupoId: string }) {
  const consulta = useDeclaraciones(props.grupoId)
  const declarar = useDeclararAfiliacion()

  return (
    <>
      <Link
        href={`/grupos/${props.grupoId}`}
        className="mt-6 inline-block text-sm text-slate-500 hover:text-slate-900"
      >
        ← Grupo
      </Link>
      <h2 className="mt-1 text-lg font-semibold text-slate-900">Afiliación</h2>

      {consulta.isPending && <p className="mt-8 text-sm text-slate-500">Consultando…</p>}

      {consulta.error && (
        <p className="mt-8 rounded-lg bg-red-50 p-4 text-sm break-words text-red-800">
          No se pudieron consultar las declaraciones: {consulta.error.message}
        </p>
      )}

      <div className="mt-6 space-y-6">
        {(consulta.data?.declaraciones ?? []).map((declaracion) => (
          <section key={declaracion.id}>
            <h3 className="text-sm font-semibold text-slate-900">
              {declaracion.fecha}
              <span className="ml-1 font-normal text-slate-400">
                período {declaracion.periodo} · {declaracion.afiliados.length} en la nómina ·{' '}
                {declaracion.aCobrar.length} a cobrar
              </span>
            </h3>
            <Nomina declaracion={declaracion} />
          </section>
        ))}

        {consulta.data?.declaraciones.length === 0 && (
          <p className="rounded-lg bg-white p-4 text-sm text-slate-500 shadow-sm">
            El grupo todavía no tiene ninguna declaración.
          </p>
        )}
      </div>

      {/* Lo menos frecuente, asi que va al final y no compite por lugar. */}
      <button
        type="button"
        disabled={declarar.isPending}
        onClick={() => declarar.mutate({ grupoId: props.grupoId })}
        className="mt-8 w-full rounded-lg bg-slate-900 px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
      >
        {declarar.isPending ? 'Declarando…' : 'Declarar afiliación extraordinaria'}
      </button>

      {declarar.error && (
        <p className="mt-2 rounded-lg bg-red-50 p-4 text-sm break-words text-red-800">
          {declarar.error.message}
        </p>
      )}
    </>
  )
}
