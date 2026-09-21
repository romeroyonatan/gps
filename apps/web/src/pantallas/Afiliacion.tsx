import { useDeclaraciones, useDeclararAfiliacion } from '@gps/api'
import { nombreDelTipo } from '@gps/personas/dominio'
import { BOTON_SECUNDARIO, Cargando, Chip, Falla, FILA, Titulo, Vacio, Volver } from '../ui'

type Declaracion = NonNullable<ReturnType<typeof useDeclaraciones>['data']>['declaraciones'][number]

function Nomina(props: { declaracion: Declaracion }) {
  const aCobrar = new Set(props.declaracion.aCobrar.map((uno) => uno.personaId))
  return (
    <ul className="mt-2">
      {props.declaracion.afiliados.map((afiliado) => (
        <li key={afiliado.personaId} className={FILA}>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">
              {afiliado.apellidos}, {afiliado.nombres}
            </p>
            <p className="mt-0.5 text-xs tabular-nums text-ink-muted">
              {nombreDelTipo(afiliado.tipoDeDocumento)} {afiliado.numeroDeDocumento}
            </p>
          </div>
          <Chip tono={aCobrar.has(afiliado.personaId) ? 'warn' : 'neutro'}>
            {aCobrar.has(afiliado.personaId) ? 'A cobrar' : 'Ya afiliada'}
          </Chip>
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
      {/* Vuelve a la nómina y no al grupo: las declaraciones son el otro lado
          de esa misma lista, y es de ahí de donde se llega. */}
      <Volver href={`/grupos/${props.grupoId}/nomina`}>Nómina</Volver>
      <Titulo>Declaraciones de afiliación</Titulo>

      {consulta.isPending && <Cargando>Consultando…</Cargando>}
      {consulta.error && (
        <Falla>No se pudieron consultar las declaraciones: {consulta.error.message}</Falla>
      )}

      <div className="mt-6 space-y-6">
        {(consulta.data?.declaraciones ?? []).map((declaracion) => (
          <section key={declaracion.id}>
            <h3 className="text-lg font-bold tabular-nums">{declaracion.fecha}</h3>
            <p className="mt-0.5 text-label tabular-nums text-ink-muted">
              Período {declaracion.periodo} · {declaracion.afiliados.length} en la nómina ·{' '}
              {declaracion.aCobrar.length} a cobrar
            </p>
            <Nomina declaracion={declaracion} />
          </section>
        ))}
      </div>

      {consulta.data?.declaraciones.length === 0 && (
        <Vacio>El grupo todavía no tiene ninguna declaración.</Vacio>
      )}

      {/* Lo menos frecuente, asi que va al final y no compite por lugar. */}
      <button
        type="button"
        disabled={declarar.isPending}
        onClick={() => declarar.mutate({ grupoId: props.grupoId })}
        className={`${BOTON_SECUNDARIO} mt-8 w-full`}
      >
        {declarar.isPending ? 'Declarando…' : 'Declarar afiliación extraordinaria'}
      </button>

      {declarar.error && <Falla>{declarar.error.message}</Falla>}
    </>
  )
}
