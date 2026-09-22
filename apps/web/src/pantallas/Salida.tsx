import {
  type PermisosQuery,
  type TipoDeCargo,
  useActor,
  useAgregarParticipante,
  useAnularPermiso,
  useElegirResponsable,
  useElegirUnidades,
  useEmitirPermiso,
  useFirmarEnApp,
  useFirmarEnPapel,
  useGrupo,
  usePermisos,
  usePersonasDelGrupo,
  useQuitarAdjunto,
  useQuitarParticipante,
  useReEmitirPermiso,
  useSubirArchivo,
} from '@gps/api'
import { TIPOS_ADMITIDOS, TIPOS_QUE_SE_PUEDEN_ANEXAR } from '@gps/archivos/dominio'
import type { Actor } from '@gps/core'
import { aFechaDeCalendario } from '@gps/core/fechas'
import { nombreCompleto } from '@gps/personas/dominio'
import type { Trazos } from '@gps/salidas/dominio'
import {
  avisoDeAnticipacion,
  candidatos,
  esResponsablePosible,
  marcaSegunCategoria,
  puedeAdministrarPermisosDelGrupo,
  puedeFirmarComo,
  resumenDeParticipantes,
} from '@gps/salidas/dominio'
import { useState } from 'react'
import {
  Aviso,
  Bajar,
  BOTON_AL_MARGEN,
  BOTON_PRINCIPAL,
  BOTON_SECUNDARIO,
  CAMPO,
  Cargando,
  Chip,
  ELEGIBLE,
  ELEGIDO,
  Falla,
  Vacio,
  Volver,
} from '../ui'
import { PadDeFirma } from './PadDeFirma'

type Permiso = PermisosQuery['permisos'][number]
type Firma = Permiso['firmas'][number]
type Persona = NonNullable<ReturnType<typeof usePersonasDelGrupo>['data']>['personas'][number]

/** Cómo está el permiso, contado como lo cuenta quien mira: lo que le importa
 *  al que abre la pantalla no es la palabra del estado sino cuántas firmas
 *  faltan y si alguna es la suya. */
export function estadoDelPermiso(permiso: Permiso, miFirmaPendiente: boolean) {
  if (permiso.estado === 'borrador') return { tono: 'neutro', texto: 'Borrador' } as const
  if (permiso.estado === 'anulado') return { tono: 'neutro', texto: 'Anulada' } as const

  const faltan = permiso.firmas.filter((firma) => !firma.firmada).length
  if (faltan === 0) return { tono: 'ok', texto: 'Firmada por los tres' } as const
  if (miFirmaPendiente) return { tono: 'warn', texto: 'Pendiente de tu firma' } as const
  return {
    tono: 'info',
    texto: faltan === 1 ? 'Falta 1 firma' : `Faltan ${faltan} firmas`,
  } as const
}

/** Elegir unidades y marcar quién va. Sólo mientras es borrador. */
function Armado(props: { permiso: Permiso; grupoId: string }) {
  const { grupo } = useGrupo(props.grupoId)
  const lista = usePersonasDelGrupo(props.grupoId)
  const elegirUnidades = useElegirUnidades()
  const agregar = useAgregarParticipante()
  const quitar = useQuitarParticipante()
  const elegirResponsable = useElegirResponsable()

  const personas = lista.data?.personas ?? []
  const elegidas = props.permiso.unidadIds
  const puestos = new Set(props.permiso.participantes.map((uno) => uno.personaId))

  // La misma funcion pura que corre el servidor: la pantalla no puede ofrecer
  // a alguien que el servidor despues va a rechazar.
  const puedenIr = candidatos(
    personas.map((persona: Persona) => ({
      ...persona,
      pertenencia: {
        unidadId: persona.pertenencia.unidadId ?? null,
        categoria: persona.pertenencia.categoria,
      },
    })),
    elegidas,
  )
  const aCargoPosibles = puedenIr.filter(
    (persona) =>
      puestos.has(persona.id) && marcaSegunCategoria(persona.pertenencia.categoria) === 'dirigente',
  )

  return (
    <div className="mt-4 space-y-4 border-t border-line pt-4">
      <div>
        <p className="font-semibold">¿Qué unidades van?</p>
        <ul className="mt-1.5">
          {(grupo?.unidades ?? []).map((unidad) => (
            <li key={unidad.id}>
              <label className="flex min-h-11 items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={elegidas.includes(unidad.id)}
                  onChange={(evento) =>
                    elegirUnidades.mutate({
                      permisoId: props.permiso.id,
                      unidadIds: evento.target.checked
                        ? [...elegidas, unidad.id]
                        : elegidas.filter((id) => id !== unidad.id),
                    })
                  }
                  className="size-5 shrink-0 accent-black"
                />
                {unidad.nombreParaMostrar}
              </label>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <p className="font-semibold">
          ¿Quiénes van? <span className="font-normal text-ink-muted">{puestos.size} elegidos</span>
        </p>
        {puedenIr.length === 0 ? (
          <p className="mt-1 text-sm text-ink-faint">Elegí primero alguna unidad.</p>
        ) : (
          <ul className="mt-1.5">
            {puedenIr.map((persona) => (
              <li key={persona.id}>
                <label className="flex min-h-11 items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    checked={puestos.has(persona.id)}
                    onChange={(evento) =>
                      (evento.target.checked ? agregar : quitar).mutate({
                        permisoId: props.permiso.id,
                        personaId: persona.id,
                      })
                    }
                    className="size-5 shrink-0 accent-black"
                  />
                  {nombreCompleto(persona)}
                  {marcaSegunCategoria(persona.pertenencia.categoria) === 'dirigente' && (
                    <Chip tono="neutro">dirigente</Chip>
                  )}
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <p className="font-semibold">¿Quién queda a cargo?</p>
        {/* Sale de los dirigentes anotados y no del padrón entero: es la misma
            regla que aplica el servidor al emitir, y ofrecer a alguien que no
            viaja sería ofrecer lo que después se rechaza. */}
        {aCargoPosibles.length === 0 ? (
          <p className="mt-1 text-sm text-ink-faint">Anotá primero a un dirigente.</p>
        ) : (
          <select
            value={
              esResponsablePosible(
                props.permiso.participantes.map((uno) => ({
                  personaId: uno.personaId,
                  marca: uno.marca as 'dirigente' | 'beneficiario',
                })),
                props.permiso.responsableId ?? null,
              )
                ? (props.permiso.responsableId ?? '')
                : ''
            }
            onChange={(evento) =>
              elegirResponsable.mutate({
                permisoId: props.permiso.id,
                personaId: evento.target.value,
              })
            }
            className={`${CAMPO} mt-1.5 h-12`}
          >
            <option value="" disabled>
              Elegí el dirigente a cargo
            </option>
            {aCargoPosibles.map((persona) => (
              <option key={persona.id} value={persona.id}>
                {nombreCompleto(persona)}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  )
}

/** Firmar en la app: el pad y el botón. Es un acto personal, así que esto sólo
 *  se monta para el cargo que quien mira ocupa hoy. */
function FirmarEnPantalla(props: { permiso: Permiso; firma: Firma; onListo: () => void }) {
  const [trazos, setTrazos] = useState<Trazos>({ trazos: [] })
  const firmar = useFirmarEnApp()
  const vacio = trazos.trazos.length === 0

  return (
    <div className="mt-3.5">
      <PadDeFirma onCambiar={setTrazos} />
      <p className="mt-2 text-label text-ink-faint">
        Se registra tu nombre, la fecha y la hora junto al trazo.
      </p>
      {firmar.error && <Falla>{firmar.error.message}</Falla>}
      <button
        type="button"
        disabled={vacio || firmar.isPending}
        onClick={() =>
          firmar.mutate(
            {
              permisoId: props.permiso.id,
              cargo: props.firma.cargo,
              trazos: JSON.stringify(trazos.trazos),
            },
            { onSuccess: props.onListo },
          )
        }
        className={`${BOTON_PRINCIPAL} mt-3`}
      >
        {vacio
          ? 'Firmá arriba para confirmar'
          : `Confirmar firma como ${props.firma.nombreDelCargo}`}
      </button>
    </div>
  )
}

/** Subir el papel firmado. Un mismo escaneo puede traer las tres firmas: se
 *  declara cuáles están y no se valida acá —eso lo hace quien autoriza la
 *  salida, mirando el documento—. Por eso las casillas y no un cargo fijo. */
function SubirEscaneo(props: { permiso: Permiso; pendientes: readonly Firma[] }) {
  const [archivo, setArchivo] = useState<File | null>(null)
  const [cargos, setCargos] = useState<readonly TipoDeCargo[]>([])
  const subir = useSubirArchivo()
  const firmarEnPapel = useFirmarEnPapel()
  const yendo = subir.isPending || firmarEnPapel.isPending

  return (
    <div className="mt-3.5">
      <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-line-strong bg-surface-3 px-4 py-3 text-center text-base font-semibold">
        {archivo ? archivo.name : 'Subir foto o escaneo del papel firmado'}
        <span className="text-label font-normal text-ink-muted">
          {archivo ? 'Queda como respaldo de la firma en papel.' : 'Imagen o PDF'}
        </span>
        <input
          type="file"
          accept={TIPOS_QUE_SE_PUEDEN_ANEXAR.join(',')}
          className="hidden"
          onChange={(evento) => setArchivo(evento.target.files?.[0] ?? null)}
        />
      </label>

      {archivo && (
        <div className="mt-3.5">
          <p className="text-sm font-semibold">¿Quiénes firmaron en este papel?</p>
          <p className="mt-0.5 text-label text-ink-faint">
            Marcá todas las que aparezcan. Quien autoriza la salida las verifica contra el escaneo.
          </p>
          <ul className="mt-1.5">
            {props.pendientes.map((firma) => (
              <li key={firma.cargo}>
                <label className="flex min-h-13 items-center gap-3 border-b border-line last:border-b-0">
                  <input
                    type="checkbox"
                    checked={cargos.includes(firma.cargo)}
                    onChange={(evento) =>
                      setCargos(
                        evento.target.checked
                          ? [...cargos, firma.cargo]
                          : cargos.filter((uno) => uno !== firma.cargo),
                      )
                    }
                    className="size-5.5 shrink-0 accent-black"
                  />
                  <span className="min-w-0 flex-1 text-sm font-semibold">
                    {firma.nombreDelCargo}
                  </span>
                  <span className="shrink-0 text-label text-ink-muted">
                    {firma.quien ?? 'sin ocupante'}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(subir.error ?? firmarEnPapel.error) && (
        <Falla>{(subir.error ?? firmarEnPapel.error)?.message}</Falla>
      )}

      <button
        type="button"
        disabled={!archivo || cargos.length === 0 || yendo}
        onClick={() => {
          if (!archivo) return
          subir.mutate(
            { permisoId: props.permiso.id, archivo, adjuntar: false },
            {
              onSuccess: (escaneoId) =>
                firmarEnPapel.mutate(
                  { permisoId: props.permiso.id, cargos: [...cargos], escaneoId },
                  {
                    onSuccess: () => {
                      setArchivo(null)
                      setCargos([])
                    },
                  },
                ),
            },
          )
        }}
        className={`${BOTON_PRINCIPAL} mt-3`}
      >
        {yendo
          ? 'Subiendo el papel firmado…'
          : !archivo
            ? 'Subí el papel para registrar'
            : cargos.length === 0
              ? 'Marcá quiénes firmaron'
              : cargos.length === 1
                ? 'Registrar 1 firma del papel'
                : `Registrar ${cargos.length} firmas del papel`}
      </button>
    </div>
  )
}

/** Las tres firmas: arriba el estado de cada una, porque es lo único que cambia
 *  con el tiempo; abajo los dos caminos para poner la que falta. */
function Firmas(props: {
  permiso: Permiso
  actor: Actor | null
  distritoId: string | undefined
  grupoId: string
  administra: boolean
}) {
  const [modo, setModo] = useState<'trazo' | 'escaneo'>('trazo')

  // Quién puede firmar qué: la misma política pura que aplica el servidor, así
  // la pantalla no ofrece un botón que después se rechaza.
  const puedoFirmar = (cargo: TipoDeCargo) =>
    puedeFirmarComo(props.actor, cargo, props.grupoId, props.distritoId)

  const hechas = props.permiso.firmas.filter((firma) => firma.firmada)
  const pendientes = props.permiso.firmas.filter((firma) => !firma.firmada)
  const mia = pendientes.find((firma) => puedoFirmar(firma.cargo))

  return (
    <div className="mt-4">
      <div className="rounded-lg bg-surface-3 p-4">
        <div className="flex items-baseline justify-between gap-3">
          <span className="font-semibold">Firmas</span>
          <span className="text-sm tabular-nums text-ink-muted">
            {hechas.length} de {props.permiso.firmas.length}
          </span>
        </div>
        <ul className="mt-2.5">
          {props.permiso.firmas.map((firma) => (
            <li
              key={firma.cargo}
              className="flex min-h-14 items-center gap-3 border-b border-line-strong py-2 last:border-b-0"
            >
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{firma.nombreDelCargo}</p>
                <p className="text-label tabular-nums text-ink-muted">
                  {firma.quien ?? 'sin ocupante'}
                  {firma.firmada
                    ? ` · firmó ${firma.modo === 'app' ? 'en la app' : 'en papel'} el ${firma.fecha}`
                    : puedoFirmar(firma.cargo)
                      ? ' · esperando tu firma'
                      : ' · sin firmar'}
                  {firma.verificada === false && ' · sello no verificado'}
                </p>
              </div>
              <Chip
                tono={
                  firma.verificada === false
                    ? 'neutro'
                    : firma.firmada
                      ? 'ok'
                      : puedoFirmar(firma.cargo)
                        ? 'warn'
                        : 'neutro'
                }
              >
                {firma.verificada === false
                  ? 'Sello no verificado'
                  : firma.firmada
                    ? 'Firmada'
                    : 'Pendiente'}
              </Chip>
            </li>
          ))}
        </ul>
      </div>

      {pendientes.length > 0 && (mia || props.administra) && (
        <div className="mt-4 border-t border-line pt-4">
          <p className="text-lg font-bold">
            {mia ? `Tu firma como ${mia.nombreDelCargo}` : 'Registrar una firma en papel'}
          </p>
          <p className="mt-0.5 text-sm text-ink-muted">
            {mia
              ? 'Firmá en pantalla o subí el papel escaneado.'
              : 'Ninguna de las firmas que faltan es tuya, pero podés asentar el papel que ya firmaron.'}
          </p>

          {/* Los dos caminos, uno al lado del otro: el papel no es una
              excepción del flujo, cierra la firma igual que el trazo. Si la
              firma que falta no es mía, el trazo no es un camino: firmar por
              otro sería falsificar. */}
          {mia && (
            <div className="mt-3.5 flex gap-2">
              {(['trazo', 'escaneo'] as const).map((uno) => (
                <button
                  key={uno}
                  type="button"
                  onClick={() => setModo(uno)}
                  className={`min-h-11 flex-1 rounded-lg border text-sm font-semibold ${
                    modo === uno ? ELEGIDO : `${ELEGIBLE} text-ink`
                  }`}
                >
                  {uno === 'trazo' ? 'Firmar en pantalla' : 'Subir escaneo'}
                </button>
              ))}
            </div>
          )}

          {mia && modo === 'trazo' ? (
            <FirmarEnPantalla
              permiso={props.permiso}
              firma={mia}
              onListo={() => setModo('escaneo')}
            />
          ) : (
            <SubirEscaneo permiso={props.permiso} pendientes={pendientes} />
          )}
        </div>
      )}
    </div>
  )
}

function Detalle(props: {
  permiso: Permiso
  grupoId: string
  distritoId: string | undefined
  actor: Actor | null
  administra: boolean
  fueReEmitido: boolean
}) {
  const { permiso } = props
  const emitir = useEmitirPermiso()
  const anular = useAnularPermiso()
  const reEmitir = useReEmitirPermiso()
  const subir = useSubirArchivo()
  const quitarAdjunto = useQuitarAdjunto()
  const hoy = aFechaDeCalendario(new Date())
  const aviso = avisoDeAnticipacion(hoy, permiso.desde)

  const miFirmaPendiente = permiso.firmas.some(
    (firma) =>
      !firma.firmada && puedeFirmarComo(props.actor, firma.cargo, props.grupoId, props.distritoId),
  )
  const estado = estadoDelPermiso(permiso, miFirmaPendiente)
  // Una sola línea de error para las cinco escrituras de la pantalla: la
  // cadena estaba escrita dos veces y se evaluaba dos veces.
  const problema =
    emitir.error ?? anular.error ?? reEmitir.error ?? subir.error ?? quitarAdjunto.error
  // De la nómina emitida, que es la que tiene los nombres congelados. En
  // borrador todavía no hay foto y el nombre lo muestra el selector de Armado.
  const responsable = permiso.emitidos.find((uno) => uno.personaId === permiso.responsableId)
  const aCargo = responsable && `${responsable.apellidos}, ${responsable.nombres}`

  return (
    <>
      <Volver href={`/grupos/${props.grupoId}/salidas`}>Salidas</Volver>
      <div className="mt-1 flex items-start justify-between gap-3">
        <h2 className="text-2xl font-bold">{permiso.lugar}</h2>
        <Chip tono={estado.tono}>{estado.texto}</Chip>
      </div>
      {/* El borrador todavía no tiene número: se asigna al emitir. */}
      {permiso.expediente && (
        <p className="text-label tabular-nums text-ink-faint">{permiso.expediente}</p>
      )}
      <p className="mt-1 text-sm tabular-nums text-ink-muted">
        {permiso.desde} a {permiso.hasta}
        {permiso.comoSeViaja && <span> · {permiso.comoSeViaja}</span>}
      </p>
      {/* Lo que el permiso imprime para ubicar al grupo: se carga al crear la
          salida, así que también se muestra acá y no sólo en el PDF. */}
      <p className="mt-1 text-sm text-ink-muted">
        {permiso.direccion}, {permiso.localidad}, {permiso.provincia} ·{' '}
        <span className="tabular-nums">{permiso.telefono}</span>
      </p>
      {aCargo && (
        <p className="mt-1 text-sm text-ink-muted">
          A cargo: <span className="font-semibold text-ink">{aCargo}</span>
        </p>
      )}

      {permiso.estado === 'borrador' && props.administra && (
        <Armado permiso={permiso} grupoId={props.grupoId} />
      )}

      {permiso.estado !== 'borrador' && permiso.emitidos.length > 0 && (
        <p className="mt-2 text-sm text-ink-muted">
          {resumenDeParticipantes(
            permiso.emitidos.map((uno) => ({ marca: uno.marca as 'dirigente' | 'beneficiario' })),
          )}
        </p>
      )}

      {(permiso.estado === 'emitido' || permiso.estado === 'firmado') && (
        <Firmas
          permiso={permiso}
          actor={props.actor}
          distritoId={props.distritoId}
          grupoId={props.grupoId}
          administra={props.administra}
        />
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {permiso.estado === 'borrador' && props.administra && (
          <button
            type="button"
            disabled={emitir.isPending}
            onClick={() => emitir.mutate({ permisoId: permiso.id })}
            className={BOTON_PRINCIPAL}
          >
            Emitir permiso
          </button>
        )}
        {permiso.pdfId && (
          <>
            <Bajar href={`/permisos/${permiso.id}/pdf`} nuevaPestaña>
              Ver PDF
            </Bajar>
            {/* Ver y bajar son dos cosas distintas: al permiso firmado hay que
                guardarlo o mandarlo, no solo mirarlo. El PDF se puede bajar en
                cualquier momento: lleva las firmas ya registradas y deja en
                blanco los recuadros que faltan. */}
            <Bajar href={`/permisos/${permiso.id}/pdf?descargar`}>Descargar para imprimir</Bajar>
          </>
        )}
        {permiso.estado === 'anulado' &&
          permiso.pdfId &&
          !props.fueReEmitido &&
          props.administra && (
            <button
              type="button"
              disabled={reEmitir.isPending}
              onClick={() => reEmitir.mutate({ permisoId: permiso.id })}
              className={BOTON_SECUNDARIO}
            >
              Re-emitir
            </button>
          )}
        {props.administra && permiso.estado !== 'anulado' && (
          <label className={`${BOTON_SECUNDARIO} cursor-pointer`}>
            Adjuntar
            {/* Mas ancho que el de la firma en papel: una planificacion puede ser
                el .docx que el jefe de rama ya tenia escrito, y no se anexa al
                PDF, solo cuelga del permiso. */}
            <input
              type="file"
              className="hidden"
              accept={TIPOS_ADMITIDOS.join(',')}
              onChange={(evento) => {
                const archivo = evento.target.files?.[0]
                if (archivo) subir.mutate({ permisoId: permiso.id, archivo, adjuntar: true })
              }}
            />
          </label>
        )}
      </div>

      {permiso.adjuntos.length > 0 && (
        <ul className="mt-3">
          {permiso.adjuntos.map((adjunto) => (
            <li
              key={adjunto.id}
              className="flex min-h-14 items-center gap-3 rounded-lg border border-line px-3"
            >
              {/* Link y no boton: el navegador sabe abrir un PDF o una imagen,
                  y asi se puede guardar o compartir con el menu de siempre. */}
              <a
                href={adjunto.url}
                target="_blank"
                rel="noreferrer"
                className="min-w-0 flex-1 truncate font-semibold hover:underline"
              >
                {adjunto.nombre}
              </a>
              {/* Un .docx el navegador no lo sabe mostrar, asi que bajarlo es
                  la unica forma de abrirlo. */}
              <a href={`${adjunto.url}?descargar`} className="text-label text-ink-muted">
                descargar
              </a>
              {/* Con confirmacion: borra el archivo y no se deshace. */}
              {props.administra && (
                <button
                  type="button"
                  onClick={() => {
                    if (!confirm(`¿Borrar "${adjunto.nombre}"? No se puede deshacer.`)) return
                    quitarAdjunto.mutate({ permisoId: permiso.id, adjuntoId: adjunto.id })
                  }}
                  className={BOTON_AL_MARGEN}
                >
                  quitar
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {emitir.data?.emitirPermiso.avisos.map((mensaje) => (
        <Aviso key={mensaje}>{mensaje}</Aviso>
      ))}
      {permiso.estado === 'emitido' && !permiso.firmas.every((firma) => firma.firmada) && (
        <p className="mt-2 text-label text-ink-faint">
          Si alguien va a firmar en la app, mejor que lo haga antes de imprimir.
        </p>
      )}
      {aviso && permiso.estado === 'borrador' && <Aviso>{aviso.mensaje}</Aviso>}
      {problema && <Falla>{problema.message}</Falla>}

      {/* Lo menos frecuente, al final y chiquito: el mismo criterio que
          "declarar extraordinaria" en afiliacion. Firmar no se deshace desde
          acá: si hay un error, se anula y se re-emite. */}
      {props.administra && permiso.estado !== 'anulado' && (
        <button
          type="button"
          disabled={anular.isPending}
          onClick={() => anular.mutate({ permisoId: permiso.id })}
          className={`${BOTON_AL_MARGEN} mt-3`}
        >
          Anular {permiso.estado === 'borrador' ? 'borrador' : 'permiso'}
        </button>
      )}
    </>
  )
}

/** El detalle de una salida: su propia pantalla, no una tarjeta de la lista.
 *  Todo lo que se toca vive acá —armar el borrador, firmar, adjuntar,
 *  anular—; la lista sólo cuenta en qué anda cada una.
 *
 *  Reusa la consulta de la lista en vez de estrenar `permiso(id)`: TanStack
 *  Query ya la tiene en caché porque venís de ahí. El día que la lista se
 *  pagine, se agrega `permiso(id)` y se arregla en un solo lugar. */
export function Salida(props: { grupoId: string; permisoId: string }) {
  const consulta = usePermisos(props.grupoId)
  const { distrito } = useGrupo(props.grupoId)
  const actor = useActor()

  const permiso = consulta.data?.permisos.find((uno) => uno.id === props.permisoId)

  if (consulta.isPending) return <Cargando>Consultando la salida…</Cargando>
  if (consulta.error) return <Falla>No se pudo consultar la salida: {consulta.error.message}</Falla>
  if (!permiso) {
    return (
      <>
        <Volver href={`/grupos/${props.grupoId}/salidas`}>Salidas</Volver>
        <Vacio>No hay ninguna salida en esta dirección.</Vacio>
      </>
    )
  }

  return (
    <Detalle
      permiso={permiso}
      grupoId={props.grupoId}
      distritoId={distrito?.id}
      actor={actor}
      administra={actor !== null && puedeAdministrarPermisosDelGrupo(actor, props.grupoId)}
      fueReEmitido={consulta.data?.permisos.some((uno) => uno.reemplazaA === permiso.id) ?? false}
    />
  )
}
