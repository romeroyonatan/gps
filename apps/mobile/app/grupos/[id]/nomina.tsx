import { periodoDe } from '@gps/afiliacion/dominio'
import { useActor, useAfiliadosEn, useGrupo, usePersonasDelGrupo } from '@gps/api'
import { aFechaDeCalendario } from '@gps/core/fechas'
import { etiquetaDeEdades, ramaDelCatalogo } from '@gps/estructura/dominio'
import {
  calcularEdad,
  estaVigente,
  nombreCompleto,
  nombreDelCargo,
  nombreDelTipo,
  puedeAdministrarPlantelDeGrupo,
} from '@gps/personas/dominio'
import { Link, router, useLocalSearchParams } from 'expo-router'
import { Pressable, ScrollView, Text, View } from 'react-native'
import {
  Accion,
  BotonSecundario,
  Cargando,
  Chevron,
  Chip,
  Falla,
  Titulo,
  Vacio,
} from '../../../src/ui'

type Persona = NonNullable<ReturnType<typeof usePersonasDelGrupo>['data']>['personas'][number]

function FilaDePersona(props: {
  grupoId: string
  persona: Persona
  hoy: Date
  afiliada: boolean
  periodo: number
}) {
  // El "hasta" generado es opcional (string | null | undefined); el del
  // dominio es string | null a secas. Se normaliza solo en esta frontera.
  const vigentes = props.persona.cargos.filter((cargo) =>
    estaVigente({ desde: cargo.desde, hasta: cargo.hasta ?? null }, props.hoy),
  )
  return (
    // La fila entera se toca: es como se llega a una persona, acá y en la web.
    <Link href={`/grupos/${props.grupoId}/personas/${props.persona.id}`} asChild>
      <Pressable className="min-h-[72px] flex-row items-center gap-3 border-b border-line py-3">
        <View className="min-w-0 flex-1">
          <Text className="text-sm font-semibold text-ink">{nombreCompleto(props.persona)}</Text>
          <Text className="mt-0.5 text-xs text-ink-muted">
            {nombreDelTipo(props.persona.tipoDeDocumento)} {props.persona.numeroDeDocumento} ·{' '}
            {calcularEdad(props.persona.fechaDeNacimiento, props.hoy)} años
          </Text>
          {vigentes.length > 0 && (
            <Text className="mt-1.5 text-xs text-ink-faint">
              {vigentes.map((cargo) => nombreDelCargo(cargo.cargo)).join(' · ')}
            </Text>
          )}
        </View>
        {/* El período va escrito: pertenecer no es estar afiliado, y "afiliado"
          a secas no dice de cuándo. El sustantivo y no el adjetivo porque el
          padrón no guarda el género de la persona. */}
        <Chip tono={props.afiliada ? 'ok' : 'warn'}>
          {props.afiliada ? `Afiliación ${props.periodo}` : 'Sin afiliar'}
        </Chip>
        <Chevron />
      </Pressable>
    </Link>
  )
}

function Unidad(props: {
  grupoId: string
  titulo: string
  detalle?: string
  personas: readonly Persona[]
  hoy: Date
  afiliados: ReadonlySet<string>
  periodo: number
}) {
  return (
    <View className="mt-6">
      <Text className="text-lg font-bold text-ink">
        {props.titulo}
        {props.detalle && (
          <Text className="text-label font-medium text-ink-muted"> {props.detalle}</Text>
        )}
      </Text>
      {props.personas.length === 0 ? (
        <Text className="mt-1 text-label text-ink-faint">Todavía no hay nadie</Text>
      ) : (
        <View className="mt-2">
          {props.personas.map((persona) => (
            <FilaDePersona
              key={persona.id}
              grupoId={props.grupoId}
              persona={persona}
              hoy={props.hoy}
              afiliada={props.afiliados.has(persona.id)}
              periodo={props.periodo}
            />
          ))}
        </View>
      )}
    </View>
  )
}

/** La nómina del grupo: quién pertenece, por unidad, y los adherentes. Se
 *  llama como en la web y como la llama el negocio. Salió del inicio cuando el
 *  inicio se volvió un resumen: son dos preguntas
 *  distintas —"¿qué tengo que hacer hoy?" y "¿quiénes son?"— y ahora son dos
 *  pestañas. */
export default function Pantalla() {
  const actor = useActor()
  const { id } = useLocalSearchParams<{ id: string }>()
  const arbol = useGrupo(id)
  const lista = usePersonasDelGrupo(id)
  const hoy = new Date()

  const personas = lista.data?.personas ?? []
  const periodo = periodoDe(aFechaDeCalendario(hoy))
  const consulta = useAfiliadosEn(
    periodo,
    personas.map((persona) => persona.id),
  )
  const afiliados = new Set(consulta.data?.afiliadosEn ?? [])
  // La misma política pura que aplica el servidor: no se ofrece lo que después
  // se va a rechazar.
  const puedeAdministrar = actor !== null && puedeAdministrarPlantelDeGrupo(actor, id)

  const { grupo } = arbol

  return (
    <ScrollView className="flex-1 bg-surface" contentContainerClassName="px-4 pb-6">
      <Titulo>Nómina</Titulo>

      {(arbol.isPending || lista.isPending) && <Cargando>Consultando el grupo…</Cargando>}
      {(arbol.error ?? lista.error) && (
        <Falla>No se pudo consultar el grupo: {(arbol.error ?? lista.error)?.message}</Falla>
      )}

      {grupo && (
        <>
          {/* La acción arriba de la lista, como pide la guía: nunca un
              formulario colgado abajo. */}
          <View className="mt-5 gap-2">
            <Accion href={`/grupos/${id}/alta`}>Alta de persona</Accion>
            {/* La ceremonia se carga desde acá porque es esta misma lista vista
                de otra forma: quiénes cambian de unidad este año. Con la forma
                del botón secundario: la acción de esta pantalla es el alta, y
                dos negras al lado no dicen cuál es cuál. */}
            {puedeAdministrar && (
              <BotonSecundario onPress={() => router.push(`/grupos/${id}/pases`)}>
                Ceremonia de pases
              </BotonSecundario>
            )}
          </View>

          {/* Ya vienen ordenadas por el servidor: por catalogo y, dentro de una
              rama, por nombre. Los dirigentes antes que los beneficiarios, que
              son los que uno busca cuando abre la unidad. Una unidad abierta
              sin nadie se muestra vacia, porque es informacion. */}
          {grupo.unidades.map((unidad) => {
            const suyas = personas.filter((persona) => persona.pertenencia.unidadId === unidad.id)
            const rama = ramaDelCatalogo(unidad.rama)
            return (
              <Unidad
                key={unidad.id}
                grupoId={id}
                titulo={unidad.nombre}
                detalle={
                  rama ? `${rama.nombre} · ${etiquetaDeEdades(rama)} · ${unidad.sexo}` : undefined
                }
                personas={[
                  ...suyas.filter((p) => p.pertenencia.categoria === 'activo'),
                  ...suyas.filter((p) => p.pertenencia.categoria === 'beneficiario'),
                ]}
                hoy={hoy}
                afiliados={afiliados}
                periodo={periodo}
              />
            )
          })}

          {grupo.unidades.length === 0 && <Vacio>El grupo todavía no abrió ninguna unidad.</Vacio>}

          <Unidad
            grupoId={id}
            titulo="Adherentes"
            personas={personas.filter((p) => p.pertenencia.categoria === 'adherente')}
            hoy={hoy}
            afiliados={afiliados}
            periodo={periodo}
          />
        </>
      )}
    </ScrollView>
  )
}
