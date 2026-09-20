import { periodoDe } from '@gps/afiliacion/dominio'
import {
  useActor,
  useAfiliadosEn,
  useDistritos,
  usePermisos,
  usePersonasDelGrupo,
  useTesoreria,
} from '@gps/api'
import { aFechaDeCalendario } from '@gps/core/fechas'
import { etiquetaDeEdades, type Rama, ramaDelCatalogo } from '@gps/estructura/dominio'
import {
  calcularEdad,
  estaVigente,
  nombreCompleto,
  nombreDelCargo,
  nombreDelTipo,
  type TipoDeCargo,
} from '@gps/personas/dominio'
import { firmantesRequeridos, puedeFirmarEnLaApp, repartirSalidas } from '@gps/salidas/dominio'
import { Link } from 'wouter'

type Persona = NonNullable<ReturnType<typeof usePersonasDelGrupo>['data']>['personas'][number]

const pesos = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
})

/** El color de rama escrito entero, no armado con plantilla: Tailwind lee las
 *  clases del fuente y una interpolada nunca se genera. Es la única forma de
 *  que `bg-rama-lobatos` exista en la hoja. */
const COLOR_DE_RAMA: Record<Rama, string> = {
  castores: 'bg-rama-castores',
  lobatos: 'bg-rama-lobatos',
  scouts: 'bg-rama-scouts',
  raiders: 'bg-rama-raiders',
  rovers: 'bg-rama-rovers',
  adultos: 'bg-rama-adultos',
}

/** El estado se lee, no se adivina: la píldora siempre lleva su texto y el
 *  color es refuerzo. */
function Chip(props: { tono: 'ok' | 'warn' | 'neutro'; children: React.ReactNode }) {
  const tonos = {
    ok: 'bg-ok-soft text-ok',
    warn: 'bg-warn-soft text-warn',
    neutro: 'bg-surface-3 text-ink-muted',
  }
  return (
    <span
      className={`inline-flex min-h-[26px] items-center rounded-full px-2.5 py-0.5 text-label font-semibold whitespace-nowrap ${tonos[props.tono]}`}
    >
      {props.children}
    </span>
  )
}

function FilaDePersona(props: { persona: Persona; hoy: Date; afiliada: boolean; periodo: number }) {
  // El "hasta" generado es opcional (string | null | undefined); el del
  // dominio es string | null a secas. Se normaliza solo en esta frontera.
  const vigentes = props.persona.cargos.filter((cargo) =>
    estaVigente({ desde: cargo.desde, hasta: cargo.hasta ?? null }, props.hoy),
  )
  return (
    <li className="flex min-h-[72px] items-center gap-3 border-b border-line py-3 last:border-b-0">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{nombreCompleto(props.persona)}</p>
        <p className="mt-0.5 text-xs tabular-nums text-ink-muted">
          {nombreDelTipo(props.persona.tipoDeDocumento)} {props.persona.numeroDeDocumento} ·{' '}
          {calcularEdad(props.persona.fechaDeNacimiento, props.hoy)} años
        </p>
        {vigentes.length > 0 && (
          <p className="mt-1.5 text-xs text-ink-faint">
            {vigentes.map((cargo) => nombreDelCargo(cargo.cargo)).join(' · ')}
          </p>
        )}
      </div>
      {/* El período va escrito: pertenecer no es estar afiliado, y "afiliado"
          a secas no dice de cuándo. El sustantivo y no el adjetivo porque el
          padrón no guarda el género de la persona: "Afiliada" en la fila de
          Ignacio es un dato inventado. */}
      <Chip tono={props.afiliada ? 'ok' : 'warn'}>
        {props.afiliada ? `Afiliación ${props.periodo}` : 'Sin afiliar'}
      </Chip>
    </li>
  )
}

function Seccion(props: {
  titulo: string
  detalle?: string
  personas: readonly Persona[]
  hoy: Date
  afiliados: ReadonlySet<string>
  periodo: number
}) {
  return (
    <section>
      <h3 className="text-lg font-bold">
        {props.titulo}
        {props.detalle && (
          <span className="ml-2 text-label font-medium text-ink-muted">{props.detalle}</span>
        )}
      </h3>
      {props.personas.length === 0 ? (
        <p className="mt-1 text-label text-ink-faint">Todavía no hay nadie</p>
      ) : (
        <ul className="mt-2">
          {props.personas.map((persona) => (
            <FilaDePersona
              key={persona.id}
              persona={persona}
              hoy={props.hoy}
              afiliada={props.afiliados.has(persona.id)}
              periodo={props.periodo}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

/** La distribución por rama: barra de proporciones más una etiqueta por rama
 *  con su nombre escrito. El color nunca viaja solo. */
function PorRama(props: { total: number; ramas: readonly { rama: Rama; cuantos: number }[] }) {
  if (props.total === 0) return null
  return (
    <>
      <div className="mt-3.5 flex h-2.5 overflow-hidden rounded-full">
        {props.ramas.map((una) => (
          <span
            key={una.rama}
            className={COLOR_DE_RAMA[una.rama]}
            style={{ width: `${(una.cuantos / props.total) * 100}%` }}
          />
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-2">
        {props.ramas.map((una) => (
          <li
            key={una.rama}
            className="inline-flex h-8 items-center gap-2 rounded-full bg-surface-3 px-3 text-sm font-medium"
          >
            <span className={`size-2 rounded-full ${COLOR_DE_RAMA[una.rama]}`} aria-hidden="true" />
            {ramaDelCatalogo(una.rama)?.nombre ?? una.rama}
            <strong className="tabular-nums">{una.cuantos}</strong>
          </li>
        ))}
      </ul>
    </>
  )
}

export function Grupo(props: { id: string }) {
  const arbol = useDistritos()
  const lista = usePersonasDelGrupo(props.id)
  const permisos = usePermisos(props.id)
  const tesoreria = useTesoreria()
  const actor = useActor()
  const hoy = new Date()

  const personas = lista.data?.personas ?? []
  // El periodo lo calcula el cliente, de su propio almanaque: es el mismo
  // criterio que estaVigente y que calcularEdad, que tampoco los resuelve el
  // servidor.
  const periodo = periodoDe(aFechaDeCalendario(hoy))
  const consulta = useAfiliadosEn(
    periodo,
    personas.map((persona) => persona.id),
  )
  const afiliados = new Set(consulta.data?.afiliadosEn ?? [])

  // Reusa la query del arbol en vez de estrenar grupo(id): TanStack Query ya la
  // tiene en cache porque venis de ahi, y de paso trae el distrito para el
  // encabezado. Son quince grupos; el dia que deje de entrar en una query se
  // agrega grupo(id) y se arregla en un solo lugar.
  const distrito = arbol.data?.distritos.find((candidato) =>
    candidato.grupos.some((grupo) => grupo.id === props.id),
  )
  const grupo = distrito?.grupos.find((candidato) => candidato.id === props.id)

  if (arbol.isPending || lista.isPending) {
    return <p className="text-sm text-ink-muted">Consultando el grupo…</p>
  }

  const error = arbol.error ?? lista.error
  if (error) {
    return (
      <p className="rounded-lg bg-danger-soft p-4 text-sm break-words text-danger">
        No se pudo consultar el grupo: {error.message}
      </p>
    )
  }

  if (!grupo) {
    return (
      <p className="rounded-lg border border-line-strong p-4 text-sm text-ink-muted">
        No hay ningún grupo abierto con esa dirección.
      </p>
    )
  }

  const adherentes = personas.filter((persona) => persona.pertenencia.categoria === 'adherente')
  const sinAfiliar = personas.filter((persona) => !afiliados.has(persona.id)).length

  // Por rama, contando por la unidad a la que pertenece cada quien: la rama es
  // de la unidad, no de la persona. Se listan sólo las ramas con gente.
  const ramaDeUnidad = new Map(grupo.unidades.map((unidad) => [unidad.id, unidad.rama]))
  const porRama = new Map<Rama, number>()
  for (const persona of personas) {
    const rama = persona.pertenencia.unidadId
      ? ramaDeUnidad.get(persona.pertenencia.unidadId)
      : undefined
    if (rama) porRama.set(rama, (porRama.get(rama) ?? 0) + 1)
  }
  const ramas = [...porRama].map(([rama, cuantos]) => ({ rama, cuantos }))
  const enRamas = ramas.reduce((suma, una) => suma + una.cuantos, 0)

  // El reparto es la misma función pura que usa la pantalla de salidas, así
  // que "espera tu firma" quiere decir lo mismo en los dos lados. Quién firma
  // qué lo decide `puedeFirmarEnLaApp` contra los tres firmantes del permiso:
  // sin distrito todavía no se sabe quién es el comisionado, y entonces nadie
  // firma nada.
  const firmantes = distrito ? firmantesRequeridos(props.id, distrito.id) : []
  const puedoFirmar = (cargo: TipoDeCargo) => {
    const firmante = firmantes.find((uno) => uno.cargo === cargo)
    return actor !== null && firmante !== undefined && puedeFirmarEnLaApp(actor, firmante)
  }
  const reparto = repartirSalidas(
    permisos.data?.permisos ?? [],
    aFechaDeCalendario(hoy),
    puedoFirmar,
  )
  const esperanFirma = reparto.esperanMiFirma.length

  // Sólo las pilas con algo: una fila que dice "0" no informa nada y empuja
  // hacia abajo a las que sí.
  const filasDeSalidas = [
    {
      titulo: 'Esperan tu firma',
      detalle: `La más próxima, ${[...reparto.esperanMiFirma].sort((a, b) => a.desde.localeCompare(b.desde))[0]?.desde}`,
      cuantas: reparto.esperanMiFirma.length,
    },
    {
      titulo: 'Firmadas, falta el resto',
      detalle: 'Sin acción de tu parte',
      cuantas: reparto.esperanOtraFirma.length,
    },
    {
      titulo: 'Próximas',
      detalle: [...reparto.proximas]
        .sort((a, b) => a.desde.localeCompare(b.desde))
        .map((una) => `${una.lugar} · ${una.desde}`)[0],
      cuantas: reparto.proximas.length,
    },
  ].filter((fila) => fila.cuantas > 0)

  const cuenta = tesoreria.data?.cuentasDeGrupos.find((una) => una.grupoId === props.id)

  return (
    <>
      <Link href="/" className="text-label text-ink-muted hover:text-ink">
        ← Distrito {distrito?.numero}
      </Link>
      <h2 className="mt-1 text-2xl font-bold">
        Grupo {grupo.numero} — {grupo.nombre}
      </h2>

      {/* Lo que exige acción va arriba de todo, y sólo aparece si hay algo que
          hacer: un bloque destacado que dice "0" no destaca nada. */}
      {esperanFirma > 0 && (
        <div className="mt-5 rounded-lg bg-warn-soft p-4">
          <p className="font-semibold text-warn">
            {esperanFirma === 1
              ? '1 salida espera tu firma'
              : `${esperanFirma} salidas esperan tu firma`}
          </p>
          <Link
            href={`/grupos/${props.id}/salidas`}
            className="mt-3 flex h-12 w-full items-center justify-center rounded-lg bg-accent px-6 font-semibold text-accent-ink hover:bg-accent-strong sm:w-fit"
          >
            Ver salidas
          </Link>
        </div>
      )}

      <section className="mt-5">
        <div className="flex items-baseline justify-between">
          <h3 className="font-semibold">Integrantes</h3>
          <Link
            href={`/grupos/${props.id}/afiliacion`}
            className="text-sm text-ink-muted hover:text-ink"
          >
            ver afiliación
          </Link>
        </div>
        <p className="mt-1.5 flex items-baseline gap-2.5">
          <span className="text-3xl font-bold tabular-nums">{personas.length}</span>
          <span className="text-sm text-ink-muted">
            pertenecen · {sinAfiliar} sin afiliar en {periodo}
          </span>
        </p>
        <PorRama total={enRamas} ramas={ramas} />
      </section>

      {cuenta && (
        <section className="mt-5 border-t border-line pt-4">
          <h3 className="font-semibold">Cuenta corriente</h3>
          {/* El saldo positivo es deuda: así lo guarda tesorería. El signo se
              escribe, no se deduce del color. */}
          <p
            className={`mt-1.5 text-2xl font-bold tabular-nums ${cuenta.saldo > 0 ? 'text-danger' : 'text-ink'}`}
          >
            {cuenta.saldo > 0 ? '−' : ''}
            {pesos.format(Math.abs(cuenta.saldo))}
          </p>
          <p className="mt-0.5 text-sm text-ink-muted">
            {cuenta.saldo > 0 ? 'De deuda' : cuenta.saldo < 0 ? 'A favor del grupo' : 'Sin deuda'}.{' '}
            <Link href={`/tesoreria/grupos/${props.id}`} className="underline">
              Ver movimientos
            </Link>
          </p>
        </section>
      )}

      <section className="mt-5 border-t border-line pt-4">
        <div className="flex items-baseline justify-between">
          <h3 className="font-semibold">Salidas</h3>
          <Link
            href={`/grupos/${props.id}/salidas`}
            className="text-sm text-ink-muted hover:text-ink"
          >
            ver todas
          </Link>
        </div>
        {!permisos.data ? (
          <p className="mt-1.5 text-sm text-ink-muted">Consultando las salidas…</p>
        ) : filasDeSalidas.length === 0 ? (
          <p className="mt-1.5 text-sm text-ink-muted">
            {permisos.data.permisos.length === 0
              ? 'El grupo todavía no cargó ninguna salida.'
              : 'Ninguna salida espera nada por ahora.'}
          </p>
        ) : (
          <ul className="mt-2">
            {filasDeSalidas.map((fila) => (
              <li
                key={fila.titulo}
                className="flex min-h-[52px] items-center justify-between gap-3 border-b border-line last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="font-semibold">{fila.titulo}</p>
                  <p className="text-label tabular-nums text-ink-muted">{fila.detalle}</p>
                </div>
                <span className="shrink-0 text-xl font-bold tabular-nums">{fila.cuantas}</span>
              </li>
            ))}
          </ul>
        )}
        <Link
          href={`/grupos/${props.id}/plantel`}
          className="mt-3 inline-block text-sm text-ink-muted hover:text-ink"
        >
          Plantel →
        </Link>
      </section>

      <div className="mt-7 space-y-6 border-t border-line pt-5">
        {/* Ya vienen ordenadas por el servidor: por catalogo y, dentro de una
            rama, por nombre. Una unidad abierta sin nadie se muestra vacia y no
            se esconde, porque es informacion. */}
        {grupo.unidades.map((unidad) => {
          const suyas = personas.filter((persona) => persona.pertenencia.unidadId === unidad.id)
          // Primero los dirigentes: son los que uno busca cuando abre la unidad.
          const activos = suyas.filter((p) => p.pertenencia.categoria === 'activo')
          const beneficiarios = suyas.filter((p) => p.pertenencia.categoria === 'beneficiario')
          const rama = ramaDelCatalogo(unidad.rama)
          return (
            <Seccion
              key={unidad.id}
              titulo={unidad.nombre}
              detalle={
                rama ? `${rama.nombre} · ${etiquetaDeEdades(rama)} · ${unidad.sexo}` : undefined
              }
              personas={[...activos, ...beneficiarios]}
              hoy={hoy}
              afiliados={afiliados}
              periodo={periodo}
            />
          )
        })}

        {grupo.unidades.length === 0 && (
          <p className="rounded-lg border border-dashed border-line-strong p-4 text-sm text-ink-muted">
            El grupo todavía no abrió ninguna unidad.
          </p>
        )}

        <Seccion
          titulo="Adherentes"
          personas={adherentes}
          hoy={hoy}
          afiliados={afiliados}
          periodo={periodo}
        />
      </div>

      {/* Cargar una persona es una tarea propia, no un apéndice del padrón:
          se va a su pantalla y se vuelve con la lista ya actualizada. */}
      <Link
        href={`/grupos/${props.id}/alta`}
        className="mt-7 flex min-h-12 w-full items-center justify-center rounded-lg bg-accent px-6 font-semibold text-accent-ink hover:bg-accent-strong sm:w-fit"
      >
        Agregar una persona
      </Link>
    </>
  )
}
