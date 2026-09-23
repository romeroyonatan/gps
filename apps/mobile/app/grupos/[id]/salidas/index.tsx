import { type PermisosQuery, useActor, useGrupo, usePermisos } from '@gps/api'
import type { Actor } from '@gps/core'
import { aFechaDeCalendario } from '@gps/core/fechas'
import {
  type CategoriaDeSalida,
  categoriaDeSalida,
  type FirmanteRequerido,
  firmantesRequeridos,
  puedeAdministrarPermisosDelGrupo,
  resumenDeParticipantes,
} from '@gps/salidas/dominio'
import { Link, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { Accion, Cargando, Chip, Falla, Filtros, Titulo, Vacio } from '../../../../src/ui'
import { estadoDelPermiso, miFirmaPendiente } from './[permisoId]'

type Permiso = PermisosQuery['permisos'][number]

const FILTROS = [
  { id: 'actuales', etiqueta: 'Próximas y en curso' },
  { id: 'finalizadas', etiqueta: 'Finalizadas' },
  { id: 'anuladas', etiqueta: 'Anuladas' },
] as const

const VACIO: Record<CategoriaDeSalida, string> = {
  actuales: 'No hay salidas próximas ni en curso.',
  finalizadas: 'Todavía no hay salidas finalizadas.',
  anuladas: 'No hay salidas anuladas.',
}

/** Una salida en la lista: en qué anda y nada más. Todo lo que se toca
 *  —armarla, firmarla, adjuntarle algo— vive en su pantalla, así que la fila
 *  entera es el enlace y no hay un solo control acá adentro. */
function Fila(props: {
  permiso: Permiso
  grupoId: string
  actor: Actor | null
  firmantes: readonly FirmanteRequerido[]
}) {
  const { permiso } = props
  const estado = estadoDelPermiso(permiso, miFirmaPendiente(permiso, props.actor, props.firmantes))

  return (
    <Link href={`/grupos/${props.grupoId}/salidas/${permiso.id}`} asChild>
      {/* Fila de 72px: la densidad teléfono de la guía, con dos líneas de dato. */}
      <Pressable className="min-h-[72px] justify-center gap-1 border-b border-line py-3 active:bg-surface-3">
        <View className="flex-row items-start justify-between gap-3">
          <Text className="min-w-0 flex-1 text-base font-semibold text-ink">{permiso.lugar}</Text>
          <Chip tono={estado.tono}>{estado.texto}</Chip>
        </View>
        <Text className="text-label text-ink-muted">
          {permiso.desde} a {permiso.hasta}
          {permiso.estado !== 'borrador' &&
            permiso.emitidos.length > 0 &&
            ` · ${resumenDeParticipantes(
              permiso.emitidos.map((uno) => ({ marca: uno.marca as 'dirigente' | 'beneficiario' })),
            )}`}
        </Text>
      </Pressable>
    </Link>
  )
}

/** Las salidas del grupo. La acción va arriba de la lista y abre la pantalla
 *  del alta: nunca un formulario colgado abajo. */
export default function Pantalla() {
  const [filtro, setFiltro] = useState<CategoriaDeSalida>('actuales')
  const { id } = useLocalSearchParams<{ id: string }>()
  const consulta = usePermisos(id)
  const { distrito } = useGrupo(id)
  const actor = useActor()

  const firmantes = distrito ? firmantesRequeridos(id, distrito.id) : []
  const permisos = consulta.data?.permisos ?? []
  const hoy = aFechaDeCalendario(new Date())
  const visibles = permisos.filter((permiso) => categoriaDeSalida(permiso, hoy) === filtro)

  return (
    <ScrollView className="flex-1 bg-surface" contentContainerClassName="px-4 pb-10">
      <Titulo>Permisos de salida</Titulo>

      {actor && puedeAdministrarPermisosDelGrupo(actor, id) && (
        <View className="mt-5">
          <Accion href={`/grupos/${id}/salidas/nueva`}>Nueva salida</Accion>
        </View>
      )}

      {consulta.isPending && <Cargando>Consultando…</Cargando>}
      {consulta.error && (
        <Falla>No se pudieron consultar los permisos: {consulta.error.message}</Falla>
      )}

      <View className="mt-5">
        <Filtros opciones={FILTROS} valor={filtro} onElegir={setFiltro} />
      </View>

      <View className="mt-2">
        {visibles.map((permiso) => (
          <Fila
            key={permiso.id}
            permiso={permiso}
            grupoId={id}
            actor={actor}
            firmantes={firmantes}
          />
        ))}
      </View>

      {visibles.length === 0 && !consulta.isPending && <Vacio>{VACIO[filtro]}</Vacio>}
    </ScrollView>
  )
}
