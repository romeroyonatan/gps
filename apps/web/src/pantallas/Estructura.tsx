import { useAlcance, useDistritos, useJefesDeGrupos } from '@gps/api'
import { aFechaDeCalendario } from '@gps/core/fechas'
import type { Unidad } from '@gps/estructura/dominio'
import { puedeVerPersonasDelGrupo } from '@gps/personas/dominio'
import { useState } from 'react'
import { Link } from 'wouter'
import {
  BOTON_SECUNDARIO,
  CAMPO,
  Cargando,
  CHEVRON,
  ChipDeRama,
  Falla,
  Icono,
  Titulo,
  Vacio,
} from '../ui'

function Grupo(props: {
  id: string
  numero: number
  nombre: string
  jefes: readonly string[]
  /** Si quien mira alcanza este grupo. El directorio los lista todos, pero el
   *  detalle -su gente, su cuenta, sus salidas- es del ámbito de cada uno: un
   *  grupo que no se va a poder abrir no se ofrece como enlace. */
  seAbre: boolean
  unidades: readonly Pick<Unidad, 'id' | 'rama'>[]
}) {
  const contenido = (
    <>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-3 text-sm font-bold tabular-nums">
        {props.numero}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={`block truncate text-base font-semibold ${props.seAbre ? 'text-ink' : 'text-ink-muted'}`}
        >
          {props.nombre}
        </span>
        <span className="mt-0.5 block truncate text-label text-ink-muted">
          {props.jefes.length > 0 ? props.jefes.join(' · ') : 'Sin jefatura registrada'}
        </span>
        {props.unidades.length === 0 ? (
          <span className="mt-1.5 block text-label text-ink-faint">
            Todavía no abrió ninguna unidad
          </span>
        ) : (
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {props.unidades.map((unidad) => (
              <li key={unidad.id}>
                <ChipDeRama rama={unidad.rama} />
              </li>
            ))}
          </ul>
        )}
      </span>
      {props.seAbre && <Icono trazos={CHEVRON} className="size-5 shrink-0 text-ink-faint" />}
    </>
  )

  const clases = 'flex min-h-[72px] items-center gap-3 border-t border-line px-4 py-2.5'

  return (
    <li>
      {props.seAbre ? (
        <Link href={`/grupos/${props.id}`} className={`${clases} active:bg-surface-3`}>
          {contenido}
        </Link>
      ) : (
        <div className={clases}>{contenido}</div>
      )}
    </li>
  )
}

function coincide(texto: string, busqueda: string) {
  return texto.toLowerCase().includes(busqueda)
}

export function Estructura() {
  const { data, isPending, error } = useDistritos()
  const [busqueda, setBusqueda] = useState('')
  const [cerrados, setCerrados] = useState<Record<string, boolean>>({})

  // El árbol lo da `estructura` y los jefes `personas`: son dos módulos, así
  // que son dos consultas y la pantalla cruza por id. El "hoy" es el de quien
  // mira, no el del servidor.
  const distritos = data?.distritos ?? []
  const jefes = useJefesDeGrupos(
    distritos.flatMap((distrito) => distrito.grupos.map((grupo) => grupo.id)),
    aFechaDeCalendario(new Date()),
  )
  const alcance = useAlcance()
  const porGrupo = new Map<string, string[]>()
  for (const jefe of jefes.data?.jefesDeGrupos ?? []) {
    const suyos = porGrupo.get(jefe.grupoId) ?? []
    suyos.push(`${jefe.nombres} ${jefe.apellidos}`)
    porGrupo.set(jefe.grupoId, suyos)
  }

  // Buscar es un recorte de lo que ya está en pantalla: se filtra acá y no en
  // el servidor, que el directorio entero es una consulta sola.
  const filtro = busqueda.trim().toLowerCase()
  const filtrados = distritos.map((distrito) => ({
    ...distrito,
    // Mientras se busca todo queda abierto: esconder una coincidencia detrás
    // de un distrito cerrado sería no haberla encontrado.
    abierto: filtro !== '' || !cerrados[distrito.id],
    encontrados: distrito.grupos.filter(
      (grupo) =>
        filtro === '' ||
        String(grupo.numero).includes(filtro) ||
        coincide(grupo.nombre, filtro) ||
        coincide(distrito.zona, filtro) ||
        (porGrupo.get(grupo.id) ?? []).some((jefe) => coincide(jefe, filtro)),
    ),
  }))
  const totalGrupos = distritos.reduce((cuantos, distrito) => cuantos + distrito.grupos.length, 0)
  const algunoAbierto = distritos.some((distrito) => !cerrados[distrito.id])
  const sinResultados =
    filtro !== '' && filtrados.every((distrito) => distrito.encontrados.length === 0)

  return (
    <>
      <Titulo>Estructura</Titulo>

      {isPending && <Cargando>Consultando la estructura…</Cargando>}
      {error && <Falla>No se pudo consultar la estructura: {error.message}</Falla>}
      {data?.distritos.length === 0 && <Vacio>No hay distritos cargados todavía.</Vacio>}

      {distritos.length > 0 && (
        <>
          <div className="mt-5 flex items-end gap-7">
            <p className="flex flex-col">
              <span className="text-2xl font-bold tabular-nums leading-none">
                {distritos.length}
              </span>
              <span className="mt-1 text-label text-ink-muted">distritos</span>
            </p>
            <p className="flex flex-col">
              <span className="text-2xl font-bold tabular-nums leading-none">{totalGrupos}</span>
              <span className="mt-1 text-label text-ink-muted">grupos</span>
            </p>
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input
              type="search"
              value={busqueda}
              onChange={(evento) => setBusqueda(evento.target.value)}
              placeholder="Buscar grupo, número, zona o jefatura"
              className={`${CAMPO} min-h-12`}
            />
            <button
              type="button"
              onClick={() =>
                setCerrados(
                  Object.fromEntries(distritos.map((distrito) => [distrito.id, algunoAbierto])),
                )
              }
              className={`${BOTON_SECUNDARIO} min-h-12 shrink-0`}
            >
              {algunoAbierto ? 'Contraer todo' : 'Expandir todo'}
            </button>
          </div>

          {sinResultados && (
            <Vacio>Ningún grupo coincide. Probá con el número de grupo o la zona.</Vacio>
          )}

          <div className="mt-4 overflow-hidden rounded-xl border border-line-strong">
            {filtrados.map((distrito) => (
              <section key={distrito.id} className="border-t border-line first:border-t-0">
                <h3>
                  <button
                    type="button"
                    aria-expanded={distrito.abierto}
                    onClick={() =>
                      // `previos` y no `cerrados`: leer del closure adentro del
                      // updater es exactamente lo que el updater evita.
                      setCerrados((previos) => ({
                        ...previos,
                        [distrito.id]: !previos[distrito.id],
                      }))
                    }
                    className="flex min-h-16 w-full items-center gap-3 bg-surface-3 px-4 py-2.5 text-left"
                  >
                    <Icono
                      trazos={CHEVRON}
                      className={`size-5 shrink-0 text-ink-muted ${distrito.abierto ? 'rotate-90' : ''}`}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-lg font-bold">Distrito {distrito.numero}</span>
                      <span className="block truncate text-sm text-ink-muted">{distrito.zona}</span>
                    </span>
                    <span className="shrink-0 text-sm tabular-nums text-ink-muted">
                      {filtro === ''
                        ? `${distrito.grupos.length} grupos`
                        : `${distrito.encontrados.length} de ${distrito.grupos.length}`}
                    </span>
                  </button>
                </h3>
                {distrito.abierto &&
                  (distrito.encontrados.length === 0 ? (
                    <p className="border-t border-line px-4 py-3.5 text-sm text-ink-muted">
                      Sin coincidencias en este distrito.
                    </p>
                  ) : (
                    <ul>
                      {distrito.encontrados.map((grupo) => (
                        <Grupo
                          key={grupo.id}
                          id={grupo.id}
                          numero={grupo.numero}
                          nombre={grupo.nombre}
                          jefes={porGrupo.get(grupo.id) ?? []}
                          seAbre={alcance !== null && puedeVerPersonasDelGrupo(alcance, grupo.id)}
                          unidades={grupo.unidades}
                        />
                      ))}
                    </ul>
                  ))}
              </section>
            ))}
          </div>
        </>
      )}
    </>
  )
}
