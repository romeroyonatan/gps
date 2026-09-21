import { useAlcance, useDistritos, useJefesDeGrupos, useVersion } from '@gps/api'
import { aFechaDeCalendario } from '@gps/core/fechas'
import type { Unidad } from '@gps/estructura/dominio'
import { puedeVerPersonasDelGrupo } from '@gps/personas/dominio'
import { Link } from 'expo-router'
import { useState } from 'react'
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import {
  BotonSecundario,
  CAMPO,
  Cargando,
  Chevron,
  ChipDeRama,
  Falla,
  Titulo,
  Vacio,
} from '../src/ui'

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
      <View className="h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-3">
        <Text className="text-sm font-bold text-ink">{props.numero}</Text>
      </View>
      <View className="min-w-0 flex-1">
        <Text
          numberOfLines={1}
          className={`text-base font-semibold ${props.seAbre ? 'text-ink' : 'text-ink-muted'}`}
        >
          {props.nombre}
        </Text>
        <Text numberOfLines={1} className="mt-0.5 text-label text-ink-muted">
          {props.jefes.length > 0 ? props.jefes.join(' · ') : 'Sin jefatura registrada'}
        </Text>
        {props.unidades.length === 0 ? (
          <Text className="mt-1.5 text-label text-ink-faint">Todavía no abrió ninguna unidad</Text>
        ) : (
          <View className="mt-1.5 flex-row flex-wrap gap-1.5">
            {props.unidades.map((unidad) => (
              <ChipDeRama key={unidad.id} rama={unidad.rama} />
            ))}
          </View>
        )}
      </View>
      {props.seAbre && <Chevron />}
    </>
  )

  // Fila de 72px: la densidad teléfono de la guía, con dos líneas de dato.
  const clase = 'min-h-[72px] flex-row items-center gap-3 border-t border-line px-4 py-2.5'
  if (!props.seAbre) return <View className={clase}>{contenido}</View>

  return (
    <Link href={`/grupos/${props.id}`} asChild>
      <Pressable className={`${clase} active:bg-surface-3`}>{contenido}</Pressable>
    </Link>
  )
}

function coincide(texto: string, busqueda: string) {
  return texto.toLowerCase().includes(busqueda)
}

export default function Pantalla() {
  const { data, isPending, error } = useDistritos()
  const version = useVersion()
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
    <ScrollView className="flex-1 bg-surface" contentContainerClassName="px-4 pb-10">
      {/* En el teléfono el directorio es la portada, así que se lleva el
            enlace a Tesorería: no hay barra lateral donde ponerlo. */}
      <Titulo enlace={{ texto: 'Tesorería', href: '/tesoreria' }}>Estructura</Titulo>

      {isPending && <Cargando>Consultando la estructura…</Cargando>}
      {error && <Falla>No se pudo consultar la estructura: {error.message}</Falla>}
      {data?.distritos.length === 0 && <Vacio>No hay distritos cargados todavía.</Vacio>}

      {distritos.length > 0 && (
        <>
          <View className="mt-5 flex-row items-end gap-7">
            <View>
              <Text className="text-2xl font-bold text-ink">{distritos.length}</Text>
              <Text className="mt-1 text-label text-ink-muted">distritos</Text>
            </View>
            <View>
              <Text className="text-2xl font-bold text-ink">{totalGrupos}</Text>
              <Text className="mt-1 text-label text-ink-muted">grupos</Text>
            </View>
          </View>

          <View className="mt-4 gap-2">
            <TextInput
              accessibilityLabel="Buscar en la estructura"
              value={busqueda}
              onChangeText={setBusqueda}
              placeholder="Buscar grupo, número, zona o jefatura"
              className={CAMPO}
            />
            <BotonSecundario
              onPress={() =>
                setCerrados(
                  Object.fromEntries(distritos.map((distrito) => [distrito.id, algunoAbierto])),
                )
              }
            >
              {algunoAbierto ? 'Contraer todo' : 'Expandir todo'}
            </BotonSecundario>
          </View>

          {sinResultados && (
            <Vacio>Ningún grupo coincide. Probá con el número de grupo o la zona.</Vacio>
          )}

          <View className="mt-4 overflow-hidden rounded-xl border border-line-strong">
            {filtrados.map((distrito) => (
              <View key={distrito.id}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: distrito.abierto }}
                  onPress={() =>
                    setCerrados((previos) => ({
                      ...previos,
                      [distrito.id]: !cerrados[distrito.id],
                    }))
                  }
                  className="min-h-16 flex-row items-center gap-3 bg-surface-3 px-4 py-2.5"
                >
                  <Chevron abierto={distrito.abierto} className="text-ink-muted" />
                  <View className="min-w-0 flex-1">
                    <Text className="text-lg font-bold text-ink">Distrito {distrito.numero}</Text>
                    <Text numberOfLines={1} className="text-sm text-ink-muted">
                      {distrito.zona}
                    </Text>
                  </View>
                  <Text className="shrink-0 text-sm text-ink-muted">
                    {filtro === ''
                      ? `${distrito.grupos.length} grupos`
                      : `${distrito.encontrados.length} de ${distrito.grupos.length}`}
                  </Text>
                </Pressable>
                {distrito.abierto &&
                  (distrito.encontrados.length === 0 ? (
                    <Text className="border-t border-line px-4 py-3.5 text-sm text-ink-muted">
                      Sin coincidencias en este distrito.
                    </Text>
                  ) : (
                    distrito.encontrados.map((grupo) => (
                      <Grupo
                        key={grupo.id}
                        id={grupo.id}
                        numero={grupo.numero}
                        nombre={grupo.nombre}
                        jefes={porGrupo.get(grupo.id) ?? []}
                        seAbre={alcance !== null && puedeVerPersonasDelGrupo(alcance, grupo.id)}
                        unidades={grupo.unidades}
                      />
                    ))
                  ))}
              </View>
            ))}
          </View>
        </>
      )}

      {version.data && (
        <Text className="mt-10 text-xs text-ink-faint">
          v{version.data.version.numero} · {version.data.version.entorno} ·{' '}
          {version.data.version.modulos.join(', ')}
        </Text>
      )}
    </ScrollView>
  )
}
