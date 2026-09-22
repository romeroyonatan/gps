import {
  ErrorDeApi,
  useActor,
  useAsignarCargo,
  useCambiarDeUnidad,
  useEditarPersona,
  useGrupo,
  useIntegrarEquipo,
  usePersonasDelGrupo,
  useRevocarCargo,
  useRevocarIntegranteDeEquipo,
} from '@gps/api'
import { aFechaDeCalendario } from '@gps/core/fechas'
import {
  calcularEdad,
  type DatosDeCargo,
  type DatosDePersona,
  estaVigente,
  nombreCompleto,
  nombreDelCargo,
  nombreDelTipo,
  type Problema,
  paraMarcar,
  puedeAdministrarPlantelDeGrupo,
  puedeCambiarDeUnidad,
  TIPOS_DE_EQUIPO,
  validarCambioDeUnidad,
  validarPersona,
} from '@gps/personas/dominio'
import { type FormEvent, type ReactNode, useState } from 'react'
import { useLocation } from 'wouter'
import {
  BOTON_PRINCIPAL,
  BOTON_SECUNDARIO,
  CAMPO,
  Campo,
  Cargando,
  Chip,
  ChipDeRama,
  Etiqueta,
  Falla,
  Nota,
  Seccion,
  Titulo,
  Vacio,
  Volver,
} from '../ui'
import { DatosPersonales } from './DatosPersonales'
import { Cargos, Unidades } from './Vinculos'

type Persona = NonNullable<ReturnType<typeof usePersonasDelGrupo>['data']>['personas'][number]

const SECRETARIA = 'secretaria'

/** El `hasta` generado es opcional; el del dominio es `string | null` a secas.
 *  Se normaliza sólo en esta frontera, como en el resto de las pantallas. */
const vigente = (periodo: { desde: string; hasta?: string | null }, hoy: Date) =>
  estaVigente({ desde: periodo.desde, hasta: periodo.hasta ?? null }, hoy)

/** Lo que la persona es hoy, para las tres pantallas. Buscar en la nómina y no
 *  consultar de a una: la lista ya está en la caché cuando se viene de ahí, y
 *  una consulta por persona no traería ningún dato nuevo. */
function usePersona(grupoId: string, personaId: string) {
  const lista = usePersonasDelGrupo(grupoId)
  return {
    ...lista,
    persona: lista.data?.personas.find((persona) => persona.id === personaId),
  }
}

/** Un dato con su nombre a la izquierda: la fila de 56px de la guía, sin
 *  chevron porque acá no se entra a ningún lado. */
function Dato(props: { nombre: string; children: ReactNode }) {
  return (
    <div className="flex min-h-14 items-center justify-between gap-3 border-b border-line py-2 last:border-b-0">
      <span className="text-sm text-ink-muted">{props.nombre}</span>
      <span className="min-w-0 text-right text-sm font-semibold">{props.children}</span>
    </div>
  )
}

/** La cáscara de las tres: el mismo encabezado, el mismo estado de carga y el
 *  mismo vacío. Sin esto, cada una repite las cuatro ramas. */
function Pantalla(props: {
  grupoId: string
  personaId: string
  volverA: string
  volverTexto: string
  children: (persona: Persona) => ReactNode
}) {
  const { persona, isPending, error } = usePersona(props.grupoId, props.personaId)

  return (
    <>
      <Volver href={props.volverA}>{props.volverTexto}</Volver>
      {isPending && <Cargando>Consultando la nómina…</Cargando>}
      {error && <Falla>No se pudo consultar la nómina: {error.message}</Falla>}
      {!isPending && !error && !persona && (
        <Vacio>No hay ninguna persona de este grupo con esa dirección.</Vacio>
      )}
      {persona && props.children(persona)}
    </>
  )
}

export function Persona(props: { grupoId: string; personaId: string }) {
  const { grupo } = useGrupo(props.grupoId)
  const actor = useActor()
  const asignar = useAsignarCargo()
  const revocarCargo = useRevocarCargo()
  const integrar = useIntegrarEquipo()
  const revocarEquipo = useRevocarIntegranteDeEquipo()
  const [agregando, agregar] = useState(false)
  const [nuevos, setNuevos] = useState<readonly DatosDeCargo[]>([])
  const [conSecretaria, setConSecretaria] = useState(false)

  const ahora = new Date()
  const hoy = aFechaDeCalendario(ahora)
  // La misma función pura que aplica el servidor: la pantalla no ofrece lo que
  // después se va a rechazar.
  const puede = actor !== null && puedeAdministrarPlantelDeGrupo(actor, props.grupoId)

  return (
    <Pantalla
      grupoId={props.grupoId}
      personaId={props.personaId}
      volverA={`/grupos/${props.grupoId}/nomina`}
      volverTexto="Nómina"
    >
      {(persona) => {
        const unidad = grupo?.unidades.find((una) => una.id === persona.pertenencia.unidadId)
        const edad = calcularEdad(persona.fechaDeNacimiento, ahora)
        const cargos = persona.cargos.filter((cargo) => vigente(cargo, ahora))
        const equipos = persona.equipos.filter((equipo) => vigente(equipo, ahora))
        const secretaria = equipos.find((equipo) => equipo.tipo === SECRETARIA)
        const errores = [asignar.error, revocarCargo.error, integrar.error, revocarEquipo.error]

        async function guardarCargos() {
          for (const cargo of nuevos) {
            await asignar.mutateAsync({
              personaId: persona.id,
              cargo: cargo.cargo,
              ambitoId: props.grupoId,
              desde: hoy,
              hasta: cargo.hasta,
            })
          }
          if (conSecretaria) {
            await integrar.mutateAsync({
              personaId: persona.id,
              tipo: SECRETARIA,
              ambitoId: props.grupoId,
              desde: hoy,
            })
          }
          setNuevos([])
          setConSecretaria(false)
          agregar(false)
        }

        return (
          <>
            <Titulo>{nombreCompleto(persona)}</Titulo>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {unidad && <ChipDeRama rama={unidad.rama} />}
              <Chip>
                {persona.pertenencia.categoria === 'activo' ? 'Dirigente' : 'Beneficiario'}
              </Chip>
            </div>

            <Seccion
              titulo="Datos personales"
              enlace={
                puede
                  ? {
                      texto: 'Editar',
                      href: `/grupos/${props.grupoId}/personas/${persona.id}/editar`,
                    }
                  : undefined
              }
            >
              <div className="mt-2">
                <Dato nombre="Documento">
                  <span className="tabular-nums">
                    {nombreDelTipo(persona.tipoDeDocumento)} {persona.numeroDeDocumento}
                  </span>
                </Dato>
                <Dato nombre="Nacimiento">
                  <span className="tabular-nums">
                    {persona.fechaDeNacimiento} · {edad} años
                  </span>
                </Dato>
                <Dato nombre="Domicilio">{persona.domicilio}</Dato>
                <Dato nombre="Teléfono">
                  {/* Enlace y no texto: en el teléfono es el uso que tiene. */}
                  <a
                    href={`tel:${paraMarcar(persona.telefonoDeContacto)}`}
                    className="tabular-nums underline"
                  >
                    {persona.telefonoDeContacto}
                  </a>
                </Dato>
              </div>
            </Seccion>

            <Seccion titulo="Pertenencia">
              <div className="mt-2">
                <Dato nombre="Unidad">{unidad ? unidad.nombre : 'Sin unidad'}</Dato>
                {/* "En la unidad" y no "en el grupo": un cambio de rama cierra
                    la pertenencia y abre otra, así que este desde es el de la
                    unidad actual. */}
                <Dato nombre="En la unidad desde">
                  <span className="tabular-nums">{persona.pertenencia.desde}</span>
                </Dato>
              </div>
              {puede && puedeCambiarDeUnidad(persona.pertenencia) && (
                <a
                  href={`/grupos/${props.grupoId}/personas/${persona.id}/rama`}
                  className={`${BOTON_SECUNDARIO} mt-3`}
                >
                  Cambiar de rama
                </a>
              )}
              {puede && !puedeCambiarDeUnidad(persona.pertenencia) && (
                <Nota>
                  El pase de rama de un beneficiario es una ceremonia, y todavía no tiene pantalla.
                </Nota>
              )}
            </Seccion>

            <Seccion titulo="Cargos y equipos" cuantos={cargos.length + equipos.length}>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {cargos.map((cargo) => (
                  <Etiqueta
                    key={cargo.id}
                    onQuitar={puede ? () => revocarCargo.mutate({ cargoId: cargo.id }) : undefined}
                    quitando={revocarCargo.isPending}
                  >
                    {nombreDelCargo(cargo.cargo)}
                    {cargo.hasta ? ` · hasta ${cargo.hasta}` : ''}
                  </Etiqueta>
                ))}
                {equipos.map((equipo) => (
                  <Etiqueta
                    key={equipo.id}
                    onQuitar={
                      puede && equipo.tipo === SECRETARIA
                        ? () => revocarEquipo.mutate({ integranteId: equipo.id })
                        : undefined
                    }
                    quitando={revocarEquipo.isPending}
                  >
                    {TIPOS_DE_EQUIPO.find((uno) => uno.id === equipo.tipo)?.nombre ?? equipo.tipo}
                  </Etiqueta>
                ))}
                {cargos.length + equipos.length === 0 && (
                  <p className="text-sm text-ink-muted">Sin cargos ni equipos.</p>
                )}
              </div>

              {puede && !agregando && (
                <button
                  type="button"
                  onClick={() => agregar(true)}
                  className="mt-3 min-h-9 text-label font-medium text-ink-muted hover:text-ink"
                >
                  + Agregar cargo
                </button>
              )}

              {puede && agregando && (
                <div className="mt-3 rounded-lg bg-surface-3 p-3.5">
                  <Cargos
                    elegidos={nuevos}
                    onCambiar={setNuevos}
                    ocupados={cargos.map((cargo) => cargo.cargo)}
                  />
                  {!secretaria && (
                    <label className="flex min-h-11 items-center gap-3 text-sm">
                      <input
                        type="checkbox"
                        checked={conSecretaria}
                        onChange={() => setConSecretaria(!conSecretaria)}
                        className="size-5 shrink-0 accent-black"
                      />
                      Secretaría
                      {/* Un equipo no tiene mandato: integrarEquipo no recibe
                          fecha de fin, así que acá tampoco se pide. */}
                    </label>
                  )}
                  <button
                    type="button"
                    onClick={guardarCargos}
                    disabled={asignar.isPending || integrar.isPending}
                    className={`${BOTON_SECUNDARIO} mt-2`}
                  >
                    {asignar.isPending || integrar.isPending ? 'Guardando…' : 'Guardar cargos'}
                  </button>
                </div>
              )}

              {/* Cada cargo se asigna por separado: si uno falla, los anteriores
                  ya quedaron. El mensaje dice cuál. */}
              {errores.map(
                (problema) => problema && <Falla key={problema.message}>{problema.message}</Falla>,
              )}
            </Seccion>
          </>
        )
      }}
    </Pantalla>
  )
}

export function EditarPersona(props: { grupoId: string; personaId: string }) {
  const editar = useEditarPersona()
  const [, navegar] = useLocation()
  const [datos, setDatos] = useState<DatosDePersona | null>(null)
  const [problemas, setProblemas] = useState<readonly Problema[]>([])
  const hoy = new Date()
  const volver = `/grupos/${props.grupoId}/personas/${props.personaId}`

  const problemaDe = (campo: Problema['campo']) =>
    problemas.find((problema) => problema.campo === campo)?.mensaje

  return (
    <Pantalla
      grupoId={props.grupoId}
      personaId={props.personaId}
      volverA={volver}
      volverTexto="Persona"
    >
      {(persona) => {
        // La primera vez el formulario arranca con lo que hay guardado.
        const valor: DatosDePersona = datos ?? {
          tipoDeDocumento: persona.tipoDeDocumento,
          numeroDeDocumento: persona.numeroDeDocumento,
          nombres: persona.nombres,
          apellidos: persona.apellidos,
          fechaDeNacimiento: persona.fechaDeNacimiento,
          domicilio: persona.domicilio,
          telefonoDeContacto: persona.telefonoDeContacto,
        }

        function enviar(evento: FormEvent) {
          evento.preventDefault()
          // La misma función pura que corre el servicio antes de guardar.
          const encontrados = validarPersona(valor, hoy)
          setProblemas(encontrados)
          if (encontrados.length > 0) return
          editar.mutate(
            { personaId: persona.id, datos: valor },
            { onSuccess: () => navegar(volver) },
          )
        }

        return (
          <>
            <Titulo acompaña="Sólo los datos personales. La unidad y los cargos se cambian desde la persona.">
              Corregir datos
            </Titulo>

            <form onSubmit={enviar} className="mt-6 max-w-[560px] space-y-5">
              <DatosPersonales
                datos={valor}
                onCambiar={setDatos}
                problemaDe={problemaDe}
                hoy={hoy}
              />

              {editar.isError && (
                <Falla>
                  {editar.error instanceof ErrorDeApi
                    ? editar.error.errores.join(' ')
                    : editar.error.message}
                </Falla>
              )}

              <button
                type="submit"
                disabled={editar.isPending}
                className={`${BOTON_PRINCIPAL} min-h-13`}
              >
                {editar.isPending ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </form>
          </>
        )
      }}
    </Pantalla>
  )
}

export function CambioDeRama(props: { grupoId: string; personaId: string }) {
  const { grupo } = useGrupo(props.grupoId)
  const cambiar = useCambiarDeUnidad()
  const [, navegar] = useLocation()
  const ahora = new Date()
  const [unidadId, setUnidadId] = useState<string | null>(null)
  const [desde, setDesde] = useState(aFechaDeCalendario(ahora))
  const [problemas, setProblemas] = useState<readonly Problema[]>([])
  const volver = `/grupos/${props.grupoId}/personas/${props.personaId}`

  const problemaDe = (campo: Problema['campo']) =>
    problemas.find((problema) => problema.campo === campo)?.mensaje

  return (
    <Pantalla
      grupoId={props.grupoId}
      personaId={props.personaId}
      volverA={volver}
      volverTexto="Persona"
    >
      {(persona) => {
        const unidades = grupo?.unidades ?? []
        const actual = unidades.find((una) => una.id === persona.pertenencia.unidadId)

        function enviar(evento: FormEvent) {
          evento.preventDefault()
          // Las mismas reglas que corre el servicio: sin unidad elegida no hay
          // nada que validar todavía.
          // El `unidadId` generado es opcional; el del dominio es
          // `string | null` a secas. Se normaliza sólo en esta frontera.
          const pertenencia = {
            ...persona.pertenencia,
            unidadId: persona.pertenencia.unidadId ?? null,
          }
          const encontrados = unidadId
            ? validarCambioDeUnidad(pertenencia, unidadId, desde, unidades, ahora)
            : [{ campo: 'unidad' as const, mensaje: 'Elegí la unidad a la que pasa.' }]
          setProblemas(encontrados)
          if (encontrados.length > 0 || !unidadId) return
          cambiar.mutate(
            { personaId: persona.id, unidadId, desde },
            { onSuccess: () => navegar(volver) },
          )
        }

        return (
          <>
            <Titulo
              acompaña={`Hoy está en ${actual?.nombre ?? 'ninguna unidad'}, desde el ${persona.pertenencia.desde}. El cambio cierra esa pertenencia y abre una nueva: queda el historial.`}
            >
              Cambiar de rama
            </Titulo>

            <form onSubmit={enviar} className="mt-6 max-w-[560px] space-y-5">
              <Unidades
                unidades={unidades}
                elegida={unidadId}
                onElegir={setUnidadId}
                problema={problemaDe('unidad')}
                etiqueta="Unidad nueva"
                sinElegir="Todavía no elegiste a cuál pasa"
              />

              <Campo etiqueta="Desde" problema={problemaDe('desde')}>
                <input
                  type="date"
                  className={`${CAMPO} h-13 tabular-nums`}
                  value={desde}
                  onChange={(evento) => setDesde(evento.target.value)}
                />
              </Campo>

              {cambiar.isError && (
                <Falla>
                  {cambiar.error instanceof ErrorDeApi
                    ? cambiar.error.errores.join(' ')
                    : cambiar.error.message}
                </Falla>
              )}

              <button
                type="submit"
                disabled={cambiar.isPending}
                className={`${BOTON_PRINCIPAL} min-h-13`}
              >
                {cambiar.isPending ? 'Guardando…' : 'Pasar de rama'}
              </button>
            </form>
          </>
        )
      }}
    </Pantalla>
  )
}
