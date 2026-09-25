import { rutaDeExportacionDeAuditoria, useActor, useAuditoria, useDistritos } from '@gps/api'
import {
  etiquetaDeAccion,
  etiquetaDeModulo,
  gruposAuditables,
  limiteDelDia,
  MODULOS_AUDITADOS,
  opcionesDelFiltro,
  quienActuo,
} from '@gps/auditoria/dominio'
import { useState } from 'react'
import { Link } from 'wouter'
import {
  Bajar,
  BOTON_SECUNDARIO,
  CAMPO,
  Campo,
  Cargando,
  CHEVRON,
  Chip,
  Falla,
  Icono,
  Nota,
  Titulo,
  Vacio,
  Volver,
} from '../ui'

type Evento = NonNullable<
  ReturnType<typeof useAuditoria>['data']
>['pages'][number]['auditoria']['eventos'][number]

const hora = new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short' })

/** Un evento: qué pasó y quién, en dos líneas; lo que cambió, al abrirlo. Es
 *  `<details>` y no un estado propio: abrir uno no le importa a nadie más. */
function Fila(props: { evento: Evento; conGrupo: boolean }) {
  const { evento } = props
  const quien = quienActuo(evento)
  const permisoId =
    evento.entidadTipo === 'permiso'
      ? evento.entidadId
      : evento.modulo === 'salidas'
        ? evento.resumen.find((dato) => dato.clave === 'permisoId')?.valor
        : null
  const permiso = permisoId && evento.grupoId
  const equipo = evento.accion.startsWith('equipo.') && evento.objetivoPersonaId
  const invitacion = evento.accion.startsWith('invitacion.')
  const hayDetalle = Boolean(
    permiso || evento.objetivoPersonaId || evento.resumen.length || evento.cambios.length,
  )

  return (
    <li className="border-b border-line last:border-b-0">
      <details className="group">
        <summary className="flex min-h-[72px] cursor-pointer list-none items-center gap-3 py-3 [&::-webkit-details-marker]:hidden">
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="flex items-start justify-between gap-3">
              <span className="min-w-0 font-semibold">{etiquetaDeAccion(evento.accion)}</span>
              {evento.resultado === 'rechazado' ? (
                <Chip tono="warn">Rechazado</Chip>
              ) : (
                evento.elevado && <Chip tono="info">Elevado</Chip>
              )}
            </span>
            <span className="text-label text-ink-muted">
              <span className="tabular-nums">{hora.format(new Date(evento.ocurridoEn))}</span> ·{' '}
              {quien} · {etiquetaDeModulo(evento.modulo)}
              {props.conGrupo && evento.grupoNombre && ` · ${evento.grupoNombre}`}
            </span>
          </span>
          {hayDetalle && (
            <Icono
              trazos={CHEVRON}
              className="size-5 shrink-0 text-ink-faint group-open:rotate-90"
            />
          )}
        </summary>
        {hayDetalle && (
          <dl className="mb-3 space-y-1.5 rounded-lg bg-surface-3 p-3 text-sm">
            {evento.objetivoPersonaId && (
              <div className="flex gap-2">
                <dt className="font-semibold">{invitacion ? 'Destinatario' : 'Persona'}</dt>
                <dd className="text-ink-muted">
                  {evento.objetivoNombre ?? evento.objetivoPersonaId}
                </dd>
              </div>
            )}
            {permiso && (
              <div>
                <Link
                  href={`/grupos/${evento.grupoId}/salidas/${permisoId}`}
                  className="font-semibold underline"
                >
                  Ver permiso →
                </Link>
              </div>
            )}
            {evento.cambios.map((cambio) => (
              <div key={`c-${cambio.campo}`}>
                <dt className="font-semibold">{cambio.campo}</dt>
                <dd className="break-words text-ink-muted">
                  <span className="line-through">{cambio.anterior}</span> → {cambio.nuevo}
                </dd>
              </div>
            ))}
            {evento.resumen
              .filter(
                (dato) =>
                  !(
                    (equipo && dato.clave === 'personaId') ||
                    (permiso && dato.clave === 'permisoId')
                  ),
              )
              .map((dato) => (
                <div key={`r-${dato.clave}`} className="flex gap-2">
                  <dt className="shrink-0 font-semibold">{dato.clave}</dt>
                  <dd className="min-w-0 break-words text-ink-muted">{dato.valor}</dd>
                </div>
              ))}
          </dl>
        )}
      </details>
    </li>
  )
}

/** La auditoría de un grupo, o de la diócesis con elevación. El servidor ya
 *  cruza los filtros con el alcance; acá sólo se evita ofrecer grupos que
 *  después se van a rechazar. */
export function Auditoria(props: { grupoId?: string }) {
  const actor = useActor()
  const distritos = useDistritos()
  const [grupoId, setGrupoId] = useState(props.grupoId ?? '')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [actorPersonaId, setActorPersonaId] = useState('')
  const [modulo, setModulo] = useState('')
  const [accion, setAccion] = useState('')

  const permitidos = actor ? gruposAuditables(actor) : []
  const filtros = {
    desde: limiteDelDia(desde, false),
    hasta: limiteDelDia(hasta, true),
    grupoId: grupoId || undefined,
    actorPersonaId: actorPersonaId || undefined,
    modulo: modulo || undefined,
    accion: accion || undefined,
  }
  const consulta = useAuditoria(filtros)

  // En escritorio se llega directo desde la columna: volver a Más sería volver
  // a una pantalla que ahí no existe.
  const volver = props.grupoId ? (
    <div className="md:hidden">
      <Volver href={`/grupos/${props.grupoId}/mas`}>Más</Volver>
    </div>
  ) : (
    <Volver href="/">Directorio</Volver>
  )

  if (
    permitidos !== null &&
    (permitidos.length === 0 || (props.grupoId && !permitidos.includes(props.grupoId)))
  ) {
    return (
      <>
        {volver}
        <Titulo>Auditoría</Titulo>
        <Nota>
          La auditoría de un grupo la ven su Jefatura y su Secretaría, y la diócesis entera sólo con
          elevación.
        </Nota>
      </>
    )
  }

  const grupos = (distritos.data?.distritos ?? []).flatMap((distrito) => distrito.grupos)
  const nombreDeGrupo = (id: string) => {
    const grupo = grupos.find((uno) => uno.id === id)
    return grupo ? `Grupo Nº${grupo.numero} · ${grupo.nombre}` : id
  }
  // Con un solo grupo posible el selector no elige nada, así que no se dibuja.
  const opcionesDeGrupo =
    permitidos === null ? grupos.map((grupo) => grupo.id) : permitidos.length > 1 ? permitidos : []

  const eventos = consulta.data?.pages.flatMap((pagina) => pagina.auditoria.eventos) ?? []
  const actores = opcionesDelFiltro(
    eventos,
    (evento) =>
      evento.actorPersonaId && evento.actorNombre
        ? [evento.actorPersonaId, evento.actorNombre]
        : null,
    actorPersonaId,
  )
  const acciones = opcionesDelFiltro(
    eventos,
    (evento) => [evento.accion, etiquetaDeAccion(evento.accion)],
    accion,
  )

  return (
    <>
      {volver}
      <Titulo acompaña="Quién cambió qué y cuándo, del más reciente al más antiguo.">
        Auditoría
      </Titulo>
      <div className="mt-4">
        <Bajar href={rutaDeExportacionDeAuditoria(filtros)}>Exportar Excel</Bajar>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3">
        {opcionesDeGrupo.length > 0 && (
          <div className="col-span-2 md:col-span-1">
            <Campo etiqueta="Grupo">
              <select
                value={grupoId}
                onChange={(e) => setGrupoId(e.target.value)}
                className={`${CAMPO} h-12`}
              >
                <option value="">
                  {permitidos === null ? 'Toda la diócesis' : 'Todos mis grupos'}
                </option>
                {opcionesDeGrupo.map((id) => (
                  <option key={id} value={id}>
                    {nombreDeGrupo(id)}
                  </option>
                ))}
              </select>
            </Campo>
          </div>
        )}
        <Campo etiqueta="Desde">
          <input
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            className={`${CAMPO} h-12 tabular-nums`}
          />
        </Campo>
        <Campo etiqueta="Hasta">
          <input
            type="date"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
            className={`${CAMPO} h-12 tabular-nums`}
          />
        </Campo>
        <Campo etiqueta="Módulo">
          <select
            value={modulo}
            onChange={(e) => setModulo(e.target.value)}
            className={`${CAMPO} h-12`}
          >
            <option value="">Todos</option>
            {MODULOS_AUDITADOS.map((uno) => (
              <option key={uno.id} value={uno.id}>
                {uno.etiqueta}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Acción">
          <select
            value={accion}
            onChange={(e) => setAccion(e.target.value)}
            className={`${CAMPO} h-12`}
          >
            <option value="">Todas</option>
            {acciones.map(({ id, etiqueta }) => (
              <option key={id} value={id}>
                {etiqueta}
              </option>
            ))}
          </select>
        </Campo>
        <div className="col-span-2 md:col-span-1">
          <Campo etiqueta="Quién">
            <select
              value={actorPersonaId}
              onChange={(e) => setActorPersonaId(e.target.value)}
              className={`${CAMPO} h-12`}
            >
              <option value="">Cualquiera</option>
              {actores.map(({ id, etiqueta }) => (
                <option key={id} value={id}>
                  {etiqueta}
                </option>
              ))}
            </select>
          </Campo>
        </div>
      </div>

      {consulta.isPending && <Cargando>Consultando…</Cargando>}
      {consulta.error && <Falla>No se pudo consultar la auditoría: {consulta.error.message}</Falla>}

      <ul className="mt-5">
        {eventos.map((evento) => (
          <Fila
            key={evento.id}
            evento={evento}
            conGrupo={!props.grupoId || grupoId !== props.grupoId}
          />
        ))}
      </ul>

      {!consulta.isPending && !consulta.error && eventos.length === 0 && (
        <Vacio>No hay eventos con estos filtros.</Vacio>
      )}

      {consulta.hasNextPage && (
        <button
          type="button"
          onClick={() => consulta.fetchNextPage()}
          disabled={consulta.isFetchingNextPage}
          className={`${BOTON_SECUNDARIO} mt-4 w-full md:w-auto`}
        >
          {consulta.isFetchingNextPage ? 'Cargando…' : 'Cargar anteriores'}
        </button>
      )}
    </>
  )
}
