import { periodoDe } from '@gps/afiliacion/dominio'
import { useAfiliadosEn, useDistritos, usePersonasDelGrupo } from '@gps/api'
import { aFechaDeCalendario } from '@gps/core/fechas'
import { etiquetaDeEdades, ramaDelCatalogo } from '@gps/estructura/dominio'
import {
  calcularEdad,
  estaVigente,
  nombreCompleto,
  nombreDelCargo,
  nombreDelTipo,
} from '@gps/personas/dominio'
import { Link, useLocalSearchParams } from 'expo-router'
import { SafeAreaView, ScrollView, Text, View } from 'react-native'
import { AltaDePersona } from '../../../componentes/AltaDePersona'

type Persona = NonNullable<ReturnType<typeof usePersonasDelGrupo>['data']>['personas'][number]

function FilaDePersona(props: { persona: Persona; hoy: Date; afiliada: boolean }) {
  // El "hasta" generado es opcional (string | null | undefined); el del
  // dominio es string | null a secas. Se normaliza solo en esta frontera.
  const vigentes = props.persona.cargos.filter((cargo) =>
    estaVigente({ desde: cargo.desde, hasta: cargo.hasta ?? null }, props.hoy),
  )
  return (
    <View className="border-b border-slate-200 px-4 py-3">
      <Text className="text-sm font-medium text-slate-900">
        <Text
          accessibilityLabel={props.afiliada ? 'Afiliada' : 'Sin afiliar'}
          className={props.afiliada ? 'text-emerald-600' : 'text-slate-300'}
        >
          {props.afiliada ? '✓ ' : '✗ '}
        </Text>
        {nombreCompleto(props.persona)}
      </Text>
      <Text className="mt-0.5 text-xs text-slate-500">
        {nombreDelTipo(props.persona.tipoDeDocumento)} {props.persona.numeroDeDocumento}
        <Text className="text-slate-400">
          {' · '}
          {calcularEdad(props.persona.fechaDeNacimiento, props.hoy)} años
        </Text>
      </Text>
      {vigentes.length > 0 && (
        <View className="mt-1.5 flex-row flex-wrap gap-1.5">
          {vigentes.map((cargo) => (
            <View key={cargo.cargo} className="rounded-full bg-slate-100 px-2.5 py-1">
              <Text className="text-xs text-slate-700">{nombreDelCargo(cargo.cargo)}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}

function Seccion(props: {
  titulo: string
  detalle?: string
  personas: readonly Persona[]
  hoy: Date
  afiliados: ReadonlySet<string>
}) {
  return (
    <View className="mt-6">
      <Text className="text-sm font-semibold text-slate-900">
        {props.titulo}
        {props.detalle && <Text className="font-normal text-slate-400"> {props.detalle}</Text>}
      </Text>
      {props.personas.length === 0 ? (
        <Text className="mt-1 text-xs text-slate-400">Todavía no hay nadie</Text>
      ) : (
        <View className="mt-2 overflow-hidden rounded-lg bg-white">
          {props.personas.map((persona) => (
            <FilaDePersona
              key={persona.id}
              persona={persona}
              hoy={props.hoy}
              afiliada={props.afiliados.has(persona.id)}
            />
          ))}
        </View>
      )}
    </View>
  )
}

export default function Pantalla() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const arbol = useDistritos()
  const lista = usePersonasDelGrupo(id)
  const hoy = new Date()

  const personas = lista.data?.personas ?? []
  // El periodo lo calcula el cliente, de su propio almanaque: es el mismo
  // criterio que estaVigente y que calcularEdad, que tampoco los resuelve el
  // servidor.
  const periodo = periodoDe(aFechaDeCalendario(hoy))
  const consultaAfiliados = useAfiliadosEn(
    periodo,
    personas.map((persona) => persona.id),
  )
  const afiliados = new Set(consultaAfiliados.data?.afiliadosEn ?? [])

  // Reusa la query del arbol en vez de estrenar grupo(id): ya esta en cache
  // porque venis de ahi, y de paso trae el distrito para el encabezado.
  const distrito = arbol.data?.distritos.find((candidato) =>
    candidato.grupos.some((grupo) => grupo.id === id),
  )
  const grupo = distrito?.grupos.find((candidato) => candidato.id === id)

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <ScrollView contentContainerClassName="px-4 py-10">
        <Link href="/" className="text-sm text-slate-500">
          ← Distrito {distrito?.numero}
        </Link>

        {(arbol.isPending || lista.isPending) && (
          <Text className="mt-8 text-sm text-slate-500">Consultando el grupo…</Text>
        )}

        {(arbol.error ?? lista.error) && (
          <View className="mt-8 rounded-lg bg-red-50 p-4">
            <Text className="text-sm text-red-800">
              No se pudo consultar el grupo: {(arbol.error ?? lista.error)?.message}
            </Text>
          </View>
        )}

        {grupo && (
          <>
            <Text className="mt-1 text-lg font-semibold text-slate-900">
              <Text className="text-slate-400">Grupo Scout Nº{grupo.numero} -</Text> {grupo.nombre}
            </Text>
            <Link href={`/grupos/${id}/afiliacion`} className="mt-2 text-sm text-slate-500">
              Afiliación →
            </Link>
            <Link href={`/grupos/${id}/salidas`} className="mt-2 text-sm text-slate-500">
              Salidas →
            </Link>

            {/* Ya vienen ordenadas por el servidor: por catalogo y, dentro de
                una rama, por nombre. Los dirigentes antes que los beneficiarios,
                que son los que uno busca cuando abre la unidad. Una unidad
                abierta sin nadie se muestra vacia, porque es informacion. */}
            {grupo.unidades.map((unidad) => {
              const suyas = personas.filter((persona) => persona.pertenencia.unidadId === unidad.id)
              const rama = ramaDelCatalogo(unidad.rama)
              return (
                <Seccion
                  key={unidad.id}
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
                />
              )
            })}

            {grupo.unidades.length === 0 && (
              <View className="mt-6 rounded-lg bg-white p-4">
                <Text className="text-sm text-slate-500">
                  El grupo todavía no abrió ninguna unidad.
                </Text>
              </View>
            )}

            <Seccion
              titulo="Adherentes"
              personas={personas.filter((p) => p.pertenencia.categoria === 'adherente')}
              hoy={hoy}
              afiliados={afiliados}
            />

            <AltaDePersona grupoId={id} unidadesAbiertas={grupo.unidades} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
