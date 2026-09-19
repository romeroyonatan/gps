import {
  type PermisosQuery,
  type TipoDeCargo,
  useAgregarParticipante,
  useAnularPermiso,
  useCrearPermiso,
  useDistritos,
  useElegirUnidades,
  useEmitirPermiso,
  useFirmarEnApp,
  useFirmarEnPapel,
  usePermisos,
  usePersonasDelGrupo,
  useQuitarAdjunto,
  useQuitarParticipante,
  useReEmitirPermiso,
  useSubirArchivo,
} from '@gps/api'
import { TIPOS_ADMITIDOS, TIPOS_QUE_SE_PUEDEN_ANEXAR } from '@gps/archivos/dominio'
import { aFechaDeCalendario } from '@gps/core/fechas'
import { nombreCompleto } from '@gps/personas/dominio'
import type { Trazos } from '@gps/salidas/dominio'
import {
  avisoDeAnticipacion,
  candidatos,
  marcaSegunCategoria,
  resumenDeParticipantes,
} from '@gps/salidas/dominio'
import { type FormEvent, useState } from 'react'
import { Link } from 'wouter'
import { PadDeFirma } from './PadDeFirma'

type Permiso = PermisosQuery['permisos'][number]
type Persona = NonNullable<ReturnType<typeof usePersonasDelGrupo>['data']>['personas'][number]

const ESTILO_DE_ESTADO: Record<string, string> = {
  borrador: 'bg-slate-100 text-slate-700',
  emitido: 'bg-amber-100 text-amber-800',
  firmado: 'bg-emerald-100 text-emerald-800',
  anulado: 'bg-slate-100 text-slate-400 line-through',
}

function Etiqueta(props: { estado: string }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${ESTILO_DE_ESTADO[props.estado] ?? ''}`}
    >
      {props.estado}
    </span>
  )
}

/** El formulario de alta. Los avisos se muestran mientras se escribe y no
 *  recien al emitir: enterarse tarde de que faltan días no le sirve a nadie. */
function NuevoPermiso(props: { grupoId: string }) {
  const hoy = aFechaDeCalendario(new Date())
  const [datos, setDatos] = useState({ lugar: '', desde: hoy, hasta: hoy, comoSeViaja: '' })
  const crear = useCrearPermiso()
  const aviso = avisoDeAnticipacion(hoy, datos.desde)

  function enviar(evento: FormEvent) {
    evento.preventDefault()
    crear.mutate(
      { grupoId: props.grupoId, ...datos, comoSeViaja: datos.comoSeViaja || null },
      { onSuccess: () => setDatos({ lugar: '', desde: hoy, hasta: hoy, comoSeViaja: '' }) },
    )
  }

  return (
    <form onSubmit={enviar} className="mt-8 space-y-3 rounded-lg bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900">Nueva salida</h3>
      <input
        value={datos.lugar}
        onChange={(evento) => setDatos({ ...datos, lugar: evento.target.value })}
        placeholder="¿A dónde van?"
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />
      <div className="flex gap-2">
        <label className="flex-1 text-xs text-slate-500">
          Salen
          <input
            type="date"
            value={datos.desde}
            onChange={(evento) => setDatos({ ...datos, desde: evento.target.value })}
            className="mt-0.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
          />
        </label>
        <label className="flex-1 text-xs text-slate-500">
          Vuelven
          <input
            type="date"
            value={datos.hasta}
            onChange={(evento) => setDatos({ ...datos, hasta: evento.target.value })}
            className="mt-0.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
          />
        </label>
      </div>
      <input
        value={datos.comoSeViaja}
        onChange={(evento) => setDatos({ ...datos, comoSeViaja: evento.target.value })}
        placeholder="Cómo viajan (opcional)"
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />
      {aviso && (
        <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">{aviso.mensaje}</p>
      )}
      {crear.error && (
        <p className="rounded-lg bg-red-50 p-3 text-xs break-words text-red-800">
          {crear.error.message}
        </p>
      )}
      <button
        type="submit"
        disabled={crear.isPending}
        className="w-full rounded-lg bg-slate-900 px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
      >
        Crear borrador
      </button>
    </form>
  )
}

/** Elegir unidades y marcar quién va. Sólo mientras es borrador. */
function Armado(props: { permiso: Permiso; grupoId: string }) {
  const arbol = useDistritos()
  const lista = usePersonasDelGrupo(props.grupoId)
  const elegirUnidades = useElegirUnidades()
  const agregar = useAgregarParticipante()
  const quitar = useQuitarParticipante()

  const grupo = arbol.data?.distritos
    .flatMap((distrito) => distrito.grupos)
    .find((uno) => uno.id === props.grupoId)
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

  return (
    <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
      <div>
        <p className="text-xs font-semibold text-slate-700">¿Qué unidades van?</p>
        <ul className="mt-1.5 space-y-1">
          {(grupo?.unidades ?? []).map((unidad) => (
            <li key={unidad.id}>
              <label className="flex items-center gap-2 text-sm text-slate-700">
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
                />
                {unidad.nombreParaMostrar}
              </label>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <p className="text-xs font-semibold text-slate-700">
          ¿Quiénes van? <span className="font-normal text-slate-400">{puestos.size} elegidos</span>
        </p>
        {puedenIr.length === 0 ? (
          <p className="mt-1 text-xs text-slate-400">Elegí primero alguna unidad.</p>
        ) : (
          <ul className="mt-1.5 space-y-1">
            {puedenIr.map((persona) => (
              <li key={persona.id}>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={puestos.has(persona.id)}
                    onChange={(evento) =>
                      (evento.target.checked ? agregar : quitar).mutate({
                        permisoId: props.permiso.id,
                        personaId: persona.id,
                      })
                    }
                  />
                  {nombreCompleto(persona)}
                  {marcaSegunCategoria(persona.pertenencia.categoria) === 'dirigente' && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                      dirigente
                    </span>
                  )}
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

/** Las tres firmas, cada una con sus dos caminos. */
function Firmas(props: { permiso: Permiso }) {
  const [firmando, setFirmando] = useState<TipoDeCargo | null>(null)
  const [trazos, setTrazos] = useState<Trazos>({ trazos: [] })
  const [papel, setPapel] = useState<TipoDeCargo | null>(null)
  const firmarEnApp = useFirmarEnApp()
  const firmarEnPapel = useFirmarEnPapel()
  const subir = useSubirArchivo()

  return (
    <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
      <p className="text-xs font-semibold text-slate-700">Firmas</p>
      {props.permiso.firmas.map((firma) => (
        <div key={firma.cargo} className="rounded-lg bg-slate-50 p-2.5">
          <p className="text-sm text-slate-900">
            <span aria-hidden="true">{firma.firmada ? '✓' : '○'}</span> {firma.nombreDelCargo}
            <span className="text-slate-400"> · {firma.quien ?? 'sin ocupante'}</span>
          </p>
          {firma.firmada ? (
            <p className="mt-0.5 text-xs text-slate-500">
              Firmó {firma.modo === 'app' ? 'en la app' : 'en papel'} el {firma.fecha}
              {firma.verificada === false && (
                <span className="ml-1 font-medium text-red-700">· sello no verificado</span>
              )}
            </p>
          ) : (
            <div className="mt-1.5 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={firma.quien === null}
                onClick={() => {
                  setFirmando(firma.cargo)
                  setTrazos({ trazos: [] })
                }}
                className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs text-white disabled:opacity-40"
              >
                Firmar acá
              </button>
              <label className="cursor-pointer rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-700">
                Subir papel firmado
                <input
                  type="file"
                  accept={TIPOS_QUE_SE_PUEDEN_ANEXAR.join(',')}
                  className="hidden"
                  onChange={(evento) => {
                    const archivo = evento.target.files?.[0]
                    if (!archivo) return
                    setPapel(firma.cargo)
                    subir.mutate(
                      { permisoId: props.permiso.id, archivo, adjuntar: false },
                      {
                        onSuccess: (escaneoId) =>
                          firmarEnPapel.mutate({
                            permisoId: props.permiso.id,
                            cargos: [firma.cargo],
                            escaneoId,
                          }),
                      },
                    )
                  }}
                />
              </label>
            </div>
          )}

          {firmando === firma.cargo && (
            <div className="mt-2">
              <p className="text-xs text-slate-500">
                Vas a firmar como {firma.nombreDelCargo}: {firma.quien}
              </p>
              <div className="mt-1">
                <PadDeFirma onCambiar={setTrazos} />
              </div>
              <div className="mt-1.5 flex gap-2">
                <button
                  type="button"
                  disabled={firmarEnApp.isPending}
                  onClick={() =>
                    firmarEnApp.mutate(
                      {
                        permisoId: props.permiso.id,
                        cargo: firma.cargo,
                        trazos: JSON.stringify(trazos.trazos),
                      },
                      { onSuccess: () => setFirmando(null) },
                    )
                  }
                  className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs text-white disabled:opacity-50"
                >
                  Firmar
                </button>
                <button
                  type="button"
                  onClick={() => setFirmando(null)}
                  className="text-xs text-slate-500"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
      {(firmarEnApp.error ?? firmarEnPapel.error ?? subir.error) && (
        <p className="rounded-lg bg-red-50 p-3 text-xs break-words text-red-800">
          {(firmarEnApp.error ?? firmarEnPapel.error ?? subir.error)?.message}
        </p>
      )}
      {papel !== null && subir.isPending && (
        <p className="text-xs text-slate-500">Subiendo el papel firmado…</p>
      )}
    </div>
  )
}

function Tarjeta(props: { permiso: Permiso; grupoId: string }) {
  const { permiso } = props
  const emitir = useEmitirPermiso()
  const anular = useAnularPermiso()
  const reEmitir = useReEmitirPermiso()
  const subir = useSubirArchivo()
  const quitarAdjunto = useQuitarAdjunto()
  const hoy = aFechaDeCalendario(new Date())
  const aviso = avisoDeAnticipacion(hoy, permiso.desde)

  return (
    <section className="rounded-lg bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900">{permiso.lugar}</h3>
        <Etiqueta estado={permiso.estado} />
      </div>
      <p className="mt-0.5 text-xs text-slate-500">
        {permiso.desde} a {permiso.hasta}
        {permiso.comoSeViaja && <span> · {permiso.comoSeViaja}</span>}
      </p>

      {permiso.estado === 'borrador' && <Armado permiso={permiso} grupoId={props.grupoId} />}

      {permiso.estado !== 'borrador' && permiso.emitidos.length > 0 && (
        <p className="mt-2 text-xs text-slate-500">
          {resumenDeParticipantes(
            permiso.emitidos.map((uno) => ({ marca: uno.marca as 'dirigente' | 'beneficiario' })),
          )}
        </p>
      )}

      {(permiso.estado === 'emitido' || permiso.estado === 'firmado') && (
        <Firmas permiso={permiso} />
      )}

      <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
        {permiso.estado === 'borrador' && (
          <button
            type="button"
            disabled={emitir.isPending}
            onClick={() => emitir.mutate({ permisoId: permiso.id })}
            className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
          >
            Emitir permiso
          </button>
        )}
        {permiso.estado !== 'borrador' && (
          <>
            <a
              href={`/permisos/${permiso.id}/pdf`}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-700"
            >
              Ver PDF
            </a>
            {/* Ver y bajar son dos cosas distintas: al permiso firmado hay que
                guardarlo o mandarlo, no solo mirarlo. */}
            <a
              href={`/permisos/${permiso.id}/pdf?descargar`}
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-700"
            >
              Descargar PDF
            </a>
          </>
        )}
        {permiso.estado === 'anulado' && (
          <button
            type="button"
            onClick={() => reEmitir.mutate({ permisoId: permiso.id })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-700"
          >
            Re-emitir
          </button>
        )}
        <label className="cursor-pointer rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-700">
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
      </div>

      {permiso.adjuntos.length > 0 && (
        <ul className="mt-2 space-y-0.5">
          {permiso.adjuntos.map((adjunto) => (
            <li key={adjunto.id} className="flex items-center gap-2">
              {/* Link y no boton: el navegador sabe abrir un PDF o una imagen,
                  y asi se puede guardar o compartir con el menu de siempre. */}
              <a
                href={adjunto.url}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-slate-600 underline underline-offset-2 hover:text-slate-900"
              >
                {adjunto.nombre}
              </a>
              {/* Un .docx el navegador no lo sabe mostrar, asi que bajarlo es
                  la unica forma de abrirlo. */}
              <a href={`${adjunto.url}?descargar`} className="text-xs text-slate-400">
                descargar
              </a>
              {/* Con confirmacion: borra el archivo y no se deshace. */}
              <button
                type="button"
                onClick={() => {
                  if (!confirm(`¿Borrar "${adjunto.nombre}"? No se puede deshacer.`)) return
                  quitarAdjunto.mutate({ permisoId: permiso.id, adjuntoId: adjunto.id })
                }}
                className="text-xs text-slate-400 hover:text-red-700"
              >
                quitar
              </button>
            </li>
          ))}
        </ul>
      )}

      {emitir.data?.emitirPermiso.avisos.map((mensaje) => (
        <p key={mensaje} className="mt-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
          {mensaje}
        </p>
      ))}
      {permiso.estado === 'emitido' && !permiso.firmas.every((firma) => firma.firmada) && (
        <p className="mt-2 text-xs text-slate-400">
          Si alguien va a firmar en la app, mejor que lo haga antes de imprimir.
        </p>
      )}
      {aviso && permiso.estado === 'borrador' && (
        <p className="mt-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">{aviso.mensaje}</p>
      )}
      {(emitir.error ?? anular.error ?? reEmitir.error ?? subir.error ?? quitarAdjunto.error) && (
        <p className="mt-2 rounded-lg bg-red-50 p-3 text-xs break-words text-red-800">
          {
            (emitir.error ?? anular.error ?? reEmitir.error ?? subir.error ?? quitarAdjunto.error)
              ?.message
          }
        </p>
      )}

      {/* Lo menos frecuente, al final y chiquito: el mismo criterio que
          "declarar extraordinaria" en afiliacion. */}
      {(permiso.estado === 'emitido' || permiso.estado === 'firmado') && (
        <button
          type="button"
          onClick={() => anular.mutate({ permisoId: permiso.id })}
          className="mt-3 text-xs text-slate-400 hover:text-red-700"
        >
          Anular permiso
        </button>
      )}
    </section>
  )
}

export function Salidas(props: { grupoId: string }) {
  const consulta = usePermisos(props.grupoId)

  return (
    <>
      <Link
        href={`/grupos/${props.grupoId}`}
        className="mt-6 inline-block text-sm text-slate-500 hover:text-slate-900"
      >
        ← Grupo
      </Link>
      <h2 className="mt-1 text-lg font-semibold text-slate-900">Permisos de salida</h2>

      {consulta.isPending && <p className="mt-8 text-sm text-slate-500">Consultando…</p>}
      {consulta.error && (
        <p className="mt-8 rounded-lg bg-red-50 p-4 text-sm break-words text-red-800">
          No se pudieron consultar los permisos: {consulta.error.message}
        </p>
      )}

      <div className="mt-6 space-y-4">
        {(consulta.data?.permisos ?? []).map((permiso) => (
          <Tarjeta key={permiso.id} permiso={permiso} grupoId={props.grupoId} />
        ))}
        {consulta.data?.permisos.length === 0 && (
          <p className="rounded-lg bg-white p-4 text-sm text-slate-500 shadow-sm">
            El grupo todavía no cargó ninguna salida.
          </p>
        )}
      </div>

      <NuevoPermiso grupoId={props.grupoId} />
    </>
  )
}
