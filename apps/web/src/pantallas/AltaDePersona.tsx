import { ErrorDeApi, useCrearPersona, useDistritos } from '@gps/api'
import { aFechaDeCalendario } from '@gps/core/fechas'
import {
  etiquetaDeEdades,
  type Rama,
  ramaDelCatalogo,
  ramaParaEdad,
  type Unidad,
} from '@gps/estructura/dominio'
import {
  CATEGORIAS,
  type Categoria,
  calcularEdad,
  type DatosDeIngreso,
  type DatosDePersona,
  nombreCompleto,
  type Problema,
  TIPOS_DE_CARGO,
  TIPOS_DE_DOCUMENTO,
  type TipoDeCargo,
  type TipoDeDocumento,
  validarIngreso,
  validarPersona,
} from '@gps/personas/dominio'
import { type FormEvent, type ReactNode, useState } from 'react'
import { Link, useLocation } from 'wouter'

type UnidadAbierta = Pick<Unidad, 'id' | 'rama' | 'nombre' | 'sexo'>

const VACIO: DatosDePersona = {
  tipoDeDocumento: 'dni',
  numeroDeDocumento: '',
  nombres: '',
  apellidos: '',
  fechaDeNacimiento: '',
}

/** El color de rama escrito entero, no armado con plantilla: Tailwind lee las
 *  clases del fuente y una interpolada nunca se genera. */
const COLOR_DE_RAMA: Record<Rama, string> = {
  castores: 'bg-rama-castores',
  lobatos: 'bg-rama-lobatos',
  scouts: 'bg-rama-scouts',
  raiders: 'bg-rama-raiders',
  rovers: 'bg-rama-rovers',
  adultos: 'bg-rama-adultos',
}

const CAMPO =
  'w-full rounded-lg border border-line-strong bg-surface-2 px-3.5 text-base text-ink ' +
  'placeholder:text-ink-faint focus:border-ink focus:outline-none ' +
  'disabled:bg-surface-3 disabled:text-ink-faint'

/** Los meses con nombre, no con número: evita el error de 03/04 contra 04/03.
 *  Del `Intl` del navegador y no de una lista escrita a mano —es exactamente
 *  para esto—; el día 1 de cada mes del 2000 es sólo el vehículo. */
const MESES = Array.from({ length: 12 }, (_, indice) => ({
  numero: String(indice + 1),
  nombre: new Intl.DateTimeFormat('es-AR', { month: 'long' }).format(new Date(2000, indice, 1)),
}))

const DIAS = Array.from({ length: 31 }, (_, indice) => String(indice + 1))

function Campo(props: { etiqueta: string; problema?: string; children: ReactNode }) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: children es generico, biome no ve el control adentro
    <label className="block">
      <span className="text-sm font-semibold">{props.etiqueta}</span>
      <div className="mt-1.5">{props.children}</div>
      {props.problema && <p className="mt-1.5 text-sm text-danger">{props.problema}</p>}
    </label>
  )
}

/** La fecha de nacimiento, con tres selects nativos y no con un calendario.
 *
 *  Un nacimiento es un dato que la persona sabe de memoria: se elige, no se
 *  busca. Un calendario obliga a navegar meses hacia atrás para alguien
 *  nacido en 2013; esto son tres toques. Los años bajan desde el actual, así
 *  que un chico de 9 está a un par de líneas. La fecha de ingreso sí usa
 *  calendario: es una fecha cercana y ahí el calendario ayuda. */
function FechaDeNacimiento(props: {
  valor: { dia: string; mes: string; anio: string }
  onCambiar: (valor: { dia: string; mes: string; anio: string }) => void
}) {
  const anioActual = new Date().getFullYear()
  const anios = Array.from({ length: 101 }, (_, indice) => String(anioActual - indice))

  return (
    <div className="grid grid-cols-[76px_minmax(0,1fr)_96px] gap-2">
      <select
        aria-label="Día"
        className={`${CAMPO} h-13 tabular-nums`}
        value={props.valor.dia}
        onChange={(evento) => props.onCambiar({ ...props.valor, dia: evento.target.value })}
      >
        <option value="">Día</option>
        {DIAS.map((dia) => (
          <option key={dia} value={dia}>
            {dia}
          </option>
        ))}
      </select>
      <select
        aria-label="Mes"
        className={`${CAMPO} h-13`}
        value={props.valor.mes}
        onChange={(evento) => props.onCambiar({ ...props.valor, mes: evento.target.value })}
      >
        <option value="">Mes</option>
        {MESES.map((mes) => (
          <option key={mes.numero} value={mes.numero}>
            {mes.nombre}
          </option>
        ))}
      </select>
      <select
        aria-label="Año"
        className={`${CAMPO} h-13 tabular-nums`}
        value={props.valor.anio}
        onChange={(evento) => props.onCambiar({ ...props.valor, anio: evento.target.value })}
      >
        <option value="">Año</option>
        {anios.map((anio) => (
          <option key={anio} value={anio}>
            {anio}
          </option>
        ))}
      </select>
    </div>
  )
}

/** A qué unidad entra. No es un campo vacío que haya que completar: la edad ya
 *  dice a dónde va, así que se propone y elegir a mano es corregir. La rama la
 *  decide `ramaParaEdad`; la unidad concreta es la que el grupo tenga abierta
 *  para esa rama, porque un grupo puede tener dos tropas o ninguna. */
function Unidades(props: {
  unidades: readonly UnidadAbierta[]
  sugerida: UnidadAbierta | undefined
  elegida: string | null
  onElegir: (unidadId: string) => void
  problema?: string
}) {
  const [abierto, abrir] = useState(false)
  const actual = props.unidades.find(
    (unidad) => unidad.id === (props.elegida ?? props.sugerida?.id),
  )

  if (props.unidades.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-line-strong p-4 text-sm text-ink-muted">
        El grupo todavía no abrió ninguna unidad. Sólo podés cargar adherentes.
      </p>
    )
  }

  return (
    <div className="rounded-lg bg-surface-3 p-3.5 md:bg-transparent md:p-0">
      <p className="text-label text-ink-muted">
        {props.elegida ? 'Unidad, elegida a mano' : 'Unidad sugerida por la edad'}
      </p>
      <div className="mt-2 flex items-center justify-between gap-3">
        {actual ? (
          <span className="inline-flex min-h-9 items-center gap-2 rounded-full bg-surface-2 px-3 font-semibold">
            <span
              className={`size-2 rounded-full ${COLOR_DE_RAMA[actual.rama]}`}
              aria-hidden="true"
            />
            {actual.nombre}
          </span>
        ) : (
          <span className="text-sm text-ink-muted">
            {/* Ni la edad ni una elección a mano dan una unidad: el grupo no
                tiene abierta la rama que le toca. Hay que elegir a dedo. */}
            Ninguna unidad abierta le corresponde por edad
          </span>
        )}
        <button
          type="button"
          onClick={() => abrir(!abierto)}
          aria-expanded={abierto}
          className="min-h-9 shrink-0 rounded-lg border border-line-strong bg-surface-2 px-3 text-sm font-semibold hover:bg-surface-4"
        >
          Cambiar
        </button>
      </div>

      {abierto && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {props.unidades.map((unidad) => {
            const catalogo = ramaDelCatalogo(unidad.rama)
            const esActual = unidad.id === actual?.id
            return (
              <li key={unidad.id}>
                <button
                  type="button"
                  onClick={() => {
                    props.onElegir(unidad.id)
                    abrir(false)
                  }}
                  className={`inline-flex min-h-9 items-center gap-2 rounded-full border px-3 text-sm font-semibold ${
                    esActual
                      ? 'border-accent bg-accent text-accent-ink'
                      : 'border-line-strong bg-surface-2 hover:bg-surface-4'
                  }`}
                >
                  {!esActual && (
                    <span
                      className={`size-2 rounded-full ${COLOR_DE_RAMA[unidad.rama]}`}
                      aria-hidden="true"
                    />
                  )}
                  {unidad.nombre}
                  {catalogo && (
                    <span className="font-normal opacity-70">{etiquetaDeEdades(catalogo)}</span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {props.problema && <p className="mt-2 text-sm text-danger">{props.problema}</p>}
    </div>
  )
}

export function AltaDePersona(props: { grupoId: string }) {
  const arbol = useDistritos()
  const alta = useCrearPersona()
  const [, navegar] = useLocation()
  const hoy = new Date()

  const [datos, setDatos] = useState<DatosDePersona>(VACIO)
  const [nacimiento, setNacimiento] = useState({ dia: '', mes: '', anio: '' })
  const [categoria, setCategoria] = useState<Categoria>('beneficiario')
  // Null quiere decir "la que sugiere la edad". Un id quiere decir que alguien
  // la corrigió a mano, y entonces cambiar la fecha ya no la mueve.
  const [unidadElegida, setUnidadElegida] = useState<string | null>(null)
  const [desde, setDesde] = useState(aFechaDeCalendario(hoy))
  const [cargos, setCargos] = useState<DatosDeIngreso['cargos']>([])
  const [problemas, setProblemas] = useState<readonly Problema[]>([])

  const grupo = arbol.data?.distritos
    .flatMap((distrito) => distrito.grupos)
    .find((uno) => uno.id === props.grupoId)
  const unidades: readonly UnidadAbierta[] = grupo?.unidades ?? []

  const problemaDe = (campo: Problema['campo']) =>
    problemas.find((problema) => problema.campo === campo)?.mensaje

  const esAdherente = categoria === 'adherente'
  const edad = datos.fechaDeNacimiento ? calcularEdad(datos.fechaDeNacimiento, hoy) : null
  const rama = edad !== null && edad >= 0 ? ramaParaEdad(edad) : undefined
  const sugerida = rama ? unidades.find((unidad) => unidad.rama === rama.id) : undefined
  // Un adherente es, por definición, el que no está en ninguna unidad.
  const unidadId = esAdherente ? null : (unidadElegida ?? sugerida?.id ?? null)
  const unidadDelResumen = unidades.find((unidad) => unidad.id === unidadId)

  function cambiarNacimiento(valor: { dia: string; mes: string; anio: string }) {
    setNacimiento(valor)
    const completa = valor.dia && valor.mes && valor.anio
    setDatos({
      ...datos,
      fechaDeNacimiento: completa
        ? `${valor.anio}-${valor.mes.padStart(2, '0')}-${valor.dia.padStart(2, '0')}`
        : '',
    })
    // La sugerencia vuelve a mandar cuando cambia la edad: corregir la fecha
    // después de haber elegido a mano suele ser arreglar un tipeo, y dejar la
    // unidad vieja ahí es dejar el error puesto.
    setUnidadElegida(null)
  }

  const cargoElegido = (cargo: TipoDeCargo) => cargos.find((elegido) => elegido.cargo === cargo)

  function enviar(evento: FormEvent) {
    evento.preventDefault()
    const ingreso: DatosDeIngreso = {
      grupoId: props.grupoId,
      categoria,
      unidadId,
      desde,
      cargos,
    }
    // Las mismas funciones puras que corre el servicio. Validar acá es la
    // experiencia de uso; que el servidor las corra igual es la garantía.
    const encontrados = [...validarPersona(datos, hoy), ...validarIngreso(ingreso, unidades, hoy)]
    setProblemas(encontrados)
    if (encontrados.length > 0) return
    alta.mutate(
      // El tipo generado del input quiere cargos mutable; el del dominio es
      // readonly a propósito, así que se copia sólo en esta frontera.
      { datos, ingreso: { ...ingreso, cargos: [...ingreso.cargos] } },
      // Vuelve al grupo: cargar una persona es una tarea que termina, y la
      // lista recién cargada es la confirmación de que salió bien.
      { onSuccess: () => navegar(`/grupos/${props.grupoId}`) },
    )
  }

  return (
    <>
      <Link href={`/grupos/${props.grupoId}`} className="text-label text-ink-muted hover:text-ink">
        ← Grupo
      </Link>
      <h2 className="mt-1 text-2xl font-bold">Nueva persona</h2>

      {/* Dos columnas en escritorio, una en el teléfono: mismo orden y mismos
          controles. El resumen de la derecha ocupa el lugar que en el teléfono
          tiene el bloque gris de la unidad. */}
      <form onSubmit={enviar} className="mt-6 flex flex-col gap-6 md:flex-row md:items-start">
        <div className="flex-1 space-y-5 md:max-w-[560px]">
          <Campo etiqueta="Apellidos" problema={problemaDe('apellidos')}>
            <input
              className={`${CAMPO} h-13`}
              value={datos.apellidos}
              onChange={(evento) => setDatos({ ...datos, apellidos: evento.target.value })}
            />
          </Campo>

          <Campo etiqueta="Nombres" problema={problemaDe('nombres')}>
            <input
              className={`${CAMPO} h-13`}
              value={datos.nombres}
              onChange={(evento) => setDatos({ ...datos, nombres: evento.target.value })}
            />
          </Campo>

          <div>
            <span className="text-sm font-semibold">Fecha de nacimiento</span>
            <div className="mt-2">
              <FechaDeNacimiento valor={nacimiento} onCambiar={cambiarNacimiento} />
            </div>
            <p className="mt-2 text-sm tabular-nums text-ink-muted">
              {edad === null
                ? 'Elegí día, mes y año.'
                : edad < 0
                  ? 'Revisá la fecha: todavía no nació.'
                  : `${edad} años cumplidos al ${aFechaDeCalendario(hoy)}`}
            </p>
            {problemaDe('fechaDeNacimiento') && (
              <p className="mt-1.5 text-sm text-danger">{problemaDe('fechaDeNacimiento')}</p>
            )}
          </div>

          {!esAdherente && (
            <Unidades
              unidades={unidades}
              sugerida={sugerida}
              elegida={unidadElegida}
              onElegir={setUnidadElegida}
              problema={problemaDe('unidad')}
            />
          )}

          <div>
            <span className="text-sm font-semibold">Documento</span>
            <div className="mt-2 grid grid-cols-[110px_minmax(0,1fr)] gap-2">
              <select
                aria-label="Tipo de documento"
                className={`${CAMPO} h-13`}
                value={datos.tipoDeDocumento}
                onChange={(evento) =>
                  setDatos({ ...datos, tipoDeDocumento: evento.target.value as TipoDeDocumento })
                }
              >
                {TIPOS_DE_DOCUMENTO.map((tipo) => (
                  <option key={tipo.id} value={tipo.id}>
                    {tipo.nombre}
                  </option>
                ))}
              </select>
              <input
                aria-label="Número de documento"
                className={`${CAMPO} h-13 tabular-nums`}
                value={datos.numeroDeDocumento}
                onChange={(evento) =>
                  setDatos({ ...datos, numeroDeDocumento: evento.target.value })
                }
                inputMode="numeric"
                placeholder="44.512.663"
              />
            </div>
            {problemaDe('numeroDeDocumento') && (
              <p className="mt-1.5 text-sm text-danger">{problemaDe('numeroDeDocumento')}</p>
            )}
          </div>

          <div>
            <span className="text-sm font-semibold">Categoría</span>
            <div className="mt-2 flex gap-2">
              {CATEGORIAS.map((una) => (
                <button
                  key={una.id}
                  type="button"
                  onClick={() => setCategoria(una.id)}
                  className={`min-h-12 flex-1 rounded-lg border text-base font-semibold ${
                    categoria === una.id
                      ? 'border-accent bg-accent text-accent-ink'
                      : 'border-line-strong text-ink hover:bg-surface-3'
                  }`}
                >
                  {una.nombre}
                </button>
              ))}
            </div>
          </div>

          <Campo etiqueta="Pertenece al grupo desde" problema={problemaDe('desde')}>
            {/* Acá sí el calendario nativo: casi siempre es una fecha cercana. Se
              propone en hoy y se puede corregir: a alguien lo cargás en agosto
              y es jefa de rama desde marzo. */}
            <input
              type="date"
              className={`${CAMPO} h-13 tabular-nums`}
              value={desde}
              onChange={(evento) => setDesde(evento.target.value)}
            />
          </Campo>

          {/* Lo menos frecuente, al final: la mayoría de las altas no traen
            ningún cargo, y la jefatura y la Secretaría se administran desde
            el plantel. */}
          <fieldset className="border-t border-line pt-4">
            <legend className="text-sm font-semibold">Cargos</legend>
            <p className="mt-0.5 text-label text-ink-faint">
              Opcional. Se pueden cargar después desde el plantel.
            </p>
            <div className="mt-2">
              {TIPOS_DE_CARGO.map((tipo) => {
                const elegido = cargoElegido(tipo.id)
                return (
                  <div key={tipo.id} className="flex min-h-11 flex-wrap items-center gap-3">
                    <label className="flex items-center gap-3 text-sm">
                      <input
                        type="checkbox"
                        checked={Boolean(elegido)}
                        onChange={() =>
                          setCargos(
                            elegido
                              ? cargos.filter((uno) => uno.cargo !== tipo.id)
                              : [...cargos, { cargo: tipo.id, hasta: null }],
                          )
                        }
                        className="size-5 shrink-0 accent-black"
                      />
                      {tipo.nombre}
                    </label>
                    {elegido && (
                      <label className="flex items-center gap-2 text-label text-ink-muted">
                        hasta
                        <input
                          type="date"
                          className="rounded-lg border border-line-strong bg-surface-2 px-2 py-1.5 text-label tabular-nums"
                          value={elegido.hasta ?? ''}
                          onChange={(evento) =>
                            setCargos(
                              cargos.map((uno) =>
                                uno.cargo === tipo.id
                                  ? { ...uno, hasta: evento.target.value || null }
                                  : uno,
                              ),
                            )
                          }
                        />
                      </label>
                    )}
                  </div>
                )
              })}
            </div>
            {problemaDe('cargos') && (
              <p className="mt-1.5 text-sm text-danger">{problemaDe('cargos')}</p>
            )}
          </fieldset>
        </div>

        {/* En el teléfono esto no es una tarjeta: es la nota y el botón al pie,
            y el resumen no aparece porque lo cargado se ve arriba sin scrollear.
            En escritorio se queda a la vista mientras se completa la izquierda. */}
        <aside className="space-y-4 md:sticky md:top-6 md:w-80 md:shrink-0 md:rounded-lg md:bg-surface-3 md:p-4">
          <div className="hidden md:block">
            <p className="text-label text-ink-muted">Resumen</p>
            <p className="mt-2 text-xl font-bold">
              {datos.apellidos.trim() || datos.nombres.trim() ? (
                nombreCompleto({
                  nombres: datos.nombres.trim(),
                  apellidos: datos.apellidos.trim(),
                })
              ) : (
                <span className="font-medium text-ink-faint">Todavía sin nombre</span>
              )}
            </p>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              {unidadDelResumen ? (
                <span className="inline-flex min-h-8 items-center gap-2 rounded-full bg-surface-2 px-3 text-sm font-semibold">
                  <span
                    className={`size-2 rounded-full ${COLOR_DE_RAMA[unidadDelResumen.rama]}`}
                    aria-hidden="true"
                  />
                  {unidadDelResumen.nombre}
                </span>
              ) : (
                <span className="inline-flex min-h-8 items-center rounded-full bg-surface-2 px-3 text-sm font-semibold text-ink-muted">
                  {esAdherente ? 'Sin unidad' : 'Falta la unidad'}
                </span>
              )}
              {/* Nace sin afiliar y el resumen lo dice: es lo que más se
                  malentiende de esta pantalla. */}
              <span className="inline-flex min-h-[26px] items-center rounded-full bg-warn-soft px-2.5 text-label font-semibold text-warn">
                Sin afiliar
              </span>
            </div>
            <p className="mt-2.5 text-sm tabular-nums text-ink-muted">
              {edad !== null && edad >= 0 && `${edad} años · `}
              pertenece desde {desde}
            </p>
          </div>

          {/* Pertenecer no es estar afiliado: el que carga tiene que saber que
              esto no cobra nada todavía. */}
          <p className="border-t border-line pt-4 text-sm text-ink-muted">
            Se registra la pertenencia. No afilia: la afiliación se cobra en la próxima declaración
            de nómina.
          </p>

          {alta.isError && (
            <p className="rounded-lg bg-danger-soft p-3 text-sm break-words text-danger">
              {alta.error instanceof ErrorDeApi ? alta.error.errores.join(' ') : alta.error.message}
            </p>
          )}

          <button
            type="submit"
            disabled={alta.isPending}
            className="flex min-h-13 w-full items-center justify-center rounded-lg bg-accent px-4 text-base font-semibold text-accent-ink hover:bg-accent-strong disabled:opacity-40"
          >
            {alta.isPending ? 'Guardando…' : 'Guardar persona'}
          </button>
        </aside>
      </form>
    </>
  )
}
