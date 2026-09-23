import { ErrorDeApi, useCrearPersona, useGrupo } from '@gps/api'
import { aFechaDeCalendario } from '@gps/core/fechas'
import { ramaParaEdad } from '@gps/estructura/dominio'
import {
  CATEGORIAS,
  type Categoria,
  calcularEdad,
  type DatosDeIngreso,
  type DatosDePersona,
  nombreCompleto,
  type Problema,
  validarIngreso,
  validarPersona,
} from '@gps/personas/dominio'
import { type FormEvent, useState } from 'react'
import { useLocation } from 'wouter'
import { COLOR_DE_RAMA } from '../ramas'
import {
  BOTON_PRINCIPAL,
  CAMPO,
  Campo,
  Chip,
  ELEGIBLE,
  ELEGIDO,
  Falla,
  Titulo,
  Volver,
} from '../ui'
import { DatosPersonales } from './DatosPersonales'
import { Cargos, type UnidadAbierta, Unidades } from './Vinculos'

const VACIO: DatosDePersona = {
  tipoDeDocumento: 'dni',
  numeroDeDocumento: '',
  nombres: '',
  apellidos: '',
  fechaDeNacimiento: '',
  domicilio: '',
  telefonoDeContacto: '',
}

export function AltaDePersona(props: { grupoId: string }) {
  const { grupo } = useGrupo(props.grupoId)
  const alta = useCrearPersona()
  const [, navegar] = useLocation()
  const hoy = new Date()

  const [datos, setDatos] = useState<DatosDePersona>(VACIO)
  const [categoria, setCategoria] = useState<Categoria>('beneficiario')
  // Null quiere decir "la que sugiere la edad". Un id quiere decir que alguien
  // la corrigió a mano, y entonces cambiar la fecha ya no la mueve.
  const [unidadElegida, setUnidadElegida] = useState<string | null>(null)
  const [desde, setDesde] = useState(aFechaDeCalendario(hoy))
  const [cargos, setCargos] = useState<DatosDeIngreso['cargos']>([])
  const [problemas, setProblemas] = useState<readonly Problema[]>([])

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
      <Volver href={`/grupos/${props.grupoId}`}>Grupo</Volver>
      <Titulo>Nueva persona</Titulo>

      {/* Dos columnas en escritorio, una en el teléfono: mismo orden y mismos
          controles. El resumen de la derecha ocupa el lugar que en el teléfono
          tiene el bloque gris de la unidad. */}
      <form onSubmit={enviar} className="mt-6 flex flex-col gap-6 md:flex-row md:items-start">
        <div className="flex-1 space-y-5 md:max-w-[560px]">
          <DatosPersonales
            datos={datos}
            onCambiar={setDatos}
            problemaDe={problemaDe}
            hoy={hoy}
            // La sugerencia vuelve a mandar cuando cambia la edad: corregir la
            // fecha después de haber elegido a mano suele ser arreglar un
            // tipeo, y dejar la unidad vieja ahí es dejar el error puesto.
            alCambiarLaFecha={() => setUnidadElegida(null)}
          >
            {!esAdherente && (
              <Unidades
                unidades={unidades}
                sugerida={sugerida}
                elegida={unidadElegida}
                onElegir={setUnidadElegida}
                problema={problemaDe('unidad')}
              />
            )}
          </DatosPersonales>

          <div>
            <span className="text-sm font-semibold">Categoría</span>
            <div className="mt-2 flex gap-2">
              {CATEGORIAS.map((una) => (
                <button
                  key={una.id}
                  type="button"
                  onClick={() => setCategoria(una.id)}
                  className={`min-h-12 flex-1 rounded-lg border text-base font-semibold ${
                    categoria === una.id ? ELEGIDO : `${ELEGIBLE} text-ink`
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
              <Cargos elegidos={cargos} onCambiar={setCargos} problema={problemaDe('cargos')} />
            </div>
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
              <Chip tono="warn">Sin afiliar</Chip>
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
            <Falla>
              {alta.error instanceof ErrorDeApi ? alta.error.errores.join(' ') : alta.error.message}
            </Falla>
          )}

          <button type="submit" disabled={alta.isPending} className={`${BOTON_PRINCIPAL} min-h-13`}>
            {alta.isPending ? 'Guardando…' : 'Guardar persona'}
          </button>
        </aside>
      </form>
    </>
  )
}
