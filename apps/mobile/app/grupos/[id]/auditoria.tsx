import {
  rutaDeExportacionDeAuditoria,
  useActor,
  useAuditoria,
  useDistritos,
  useTransporte,
} from '@gps/api'
import {
  etiquetaDeAccion,
  etiquetaDeModulo,
  gruposAuditables,
  limiteDelDia,
  MODULOS_AUDITADOS,
  opcionesDelFiltro,
  quienActuo,
} from '@gps/auditoria/dominio'
import { File, Paths } from 'expo-file-system'
import { Link, useLocalSearchParams } from 'expo-router'
import * as Sharing from 'expo-sharing'
import { useState } from 'react'
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { secretoDeSesion } from '../../../src/sesion'
import {
  BotonSecundario,
  CAMPO,
  Campo,
  Cargando,
  Chevron,
  Chip,
  Falla,
  Filtros,
  Nota,
  Titulo,
  Vacio,
  Volver,
} from '../../../src/ui'

type Evento = NonNullable<
  ReturnType<typeof useAuditoria>['data']
>['pages'][number]['auditoria']['eventos'][number]

/** Cuántas personas se ofrecen de una vez en el filtro de quién. */
const ACTORES_A_LA_VISTA = 5

const hora = new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short' })

/** Un evento: qué pasó y quién, en dos líneas; lo que cambió, al tocarlo. */
function Fila(props: { evento: Evento; conGrupo: boolean }) {
  const { evento } = props
  const [abierta, setAbierta] = useState(false)
  const permisoId =
    evento.entidadTipo === 'permiso'
      ? evento.entidadId
      : evento.modulo === 'salidas'
        ? evento.resumen.find((dato) => dato.clave === 'permisoId')?.valor
        : null
  const permiso = permisoId && evento.grupoId
  const equipo = evento.accion.startsWith('equipo.') && evento.objetivoPersonaId
  const invitacion = evento.accion.startsWith('invitacion.')
  const hayDetalle = Boolean(
    permiso || evento.objetivoPersonaId || evento.resumen.length || evento.cambios.length,
  )

  return (
    <View className="border-b border-line">
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: abierta }}
        disabled={!hayDetalle}
        onPress={() => setAbierta(!abierta)}
        className="min-h-[72px] flex-row items-center gap-3 py-3 active:bg-surface-3"
      >
        <View className="min-w-0 flex-1 gap-1">
          <View className="flex-row items-start justify-between gap-3">
            <Text className="min-w-0 flex-1 text-base font-semibold text-ink">
              {etiquetaDeAccion(evento.accion)}
            </Text>
            {evento.resultado === 'rechazado' ? (
              <Chip tono="warn">Rechazado</Chip>
            ) : (
              evento.elevado && <Chip tono="info">Elevado</Chip>
            )}
          </View>
          <Text className="text-label text-ink-muted">
            {hora.format(new Date(evento.ocurridoEn))} · {quienActuo(evento)} ·{' '}
            {etiquetaDeModulo(evento.modulo)}
            {props.conGrupo && evento.grupoNombre ? ` · ${evento.grupoNombre}` : ''}
          </Text>
        </View>
        {hayDetalle && <Chevron abierto={abierta} />}
      </Pressable>
      {abierta && (
        <View className="mb-3 gap-1.5 rounded-lg bg-surface-3 p-3">
          {evento.objetivoPersonaId && (
            <Text className="text-sm text-ink">
              <Text className="font-semibold">{invitacion ? 'Destinatario ' : 'Persona '}</Text>
              {evento.objetivoNombre ?? evento.objetivoPersonaId}
            </Text>
          )}
          {permiso && (
            <Link href={`/grupos/${evento.grupoId}/salidas/${permisoId}`} asChild>
              <Pressable accessibilityRole="link" className="min-h-11 justify-center">
                <Text className="text-sm font-semibold text-ink underline">Ver permiso →</Text>
              </Pressable>
            </Link>
          )}
          {evento.cambios.map((cambio) => (
            <View key={`c-${cambio.campo}`}>
              <Text className="text-sm font-semibold text-ink">{cambio.campo}</Text>
              <Text className="text-sm text-ink-muted">
                <Text className="line-through">{cambio.anterior}</Text> → {cambio.nuevo}
              </Text>
            </View>
          ))}
          {evento.resumen
            .filter(
              (dato) =>
                !(
                  (equipo && dato.clave === 'personaId') ||
                  (permiso && dato.clave === 'permisoId')
                ),
            )
            .map((dato) => (
              <View key={`r-${dato.clave}`} className="flex-row gap-2">
                <Text className="text-sm font-semibold text-ink">{dato.clave}</Text>
                <Text className="min-w-0 flex-1 text-sm text-ink-muted">{dato.valor}</Text>
              </View>
            ))}
        </View>
      )}
    </View>
  )
}

/** La auditoría del grupo. Misma jerarquía que la web; como no hay `<select>`,
 *  cada filtro es una fila de `Filtros`. El servidor ya cruza los filtros con
 *  el alcance; acá sólo se evita ofrecer grupos que se van a rechazar. */
export default function Pantalla() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const actor = useActor()
  const distritos = useDistritos()
  const { origen } = useTransporte()
  const [grupoId, setGrupoId] = useState(id)
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [actorPersonaId, setActorPersonaId] = useState('')
  const [modulo, setModulo] = useState('')
  const [accion, setAccion] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [exportando, setExportando] = useState(false)
  const [errorAlExportar, setErrorAlExportar] = useState('')

  const permitidos = actor ? gruposAuditables(actor) : []
  const filtros = {
    desde: limiteDelDia(desde, false),
    hasta: limiteDelDia(hasta, true),
    grupoId: grupoId || undefined,
    actorPersonaId: actorPersonaId || undefined,
    modulo: modulo || undefined,
    accion: accion || undefined,
  }
  const consulta = useAuditoria(filtros)

  async function exportar() {
    setExportando(true)
    setErrorAlExportar('')
    try {
      const secreto = await secretoDeSesion()
      if (!secreto) throw new Error('Necesitás iniciar sesión.')
      const archivo = await File.downloadFileAsync(
        `${origen}${rutaDeExportacionDeAuditoria(filtros)}`,
        new File(Paths.cache, 'auditoria.xlsx'),
        { headers: { authorization: `Bearer ${secreto}` }, idempotent: true },
      )
      try {
        await Sharing.shareAsync(archivo.uri, {
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          dialogTitle: 'Guardar auditoría',
        })
      } finally {
        archivo.delete()
      }
    } catch (error) {
      setErrorAlExportar(
        error instanceof Error ? error.message : 'No se pudo exportar la auditoría.',
      )
    } finally {
      setExportando(false)
    }
  }

  if (permitidos !== null && !permitidos.includes(id)) {
    return (
      <ScrollView className="flex-1 bg-surface" contentContainerClassName="px-4 pb-10">
        <Volver href={`/grupos/${id}/mas`}>Más</Volver>
        <Titulo>Auditoría</Titulo>
        <Nota>
          La auditoría de un grupo la ven su Jefatura y su Secretaría, y la diócesis entera sólo con
          elevación.
        </Nota>
      </ScrollView>
    )
  }

  const grupos = (distritos.data?.distritos ?? []).flatMap((distrito) => distrito.grupos)
  const nombreDeGrupo = (uno: string) => {
    const grupo = grupos.find((candidato) => candidato.id === uno)
    return grupo ? `Nº${grupo.numero} · ${grupo.nombre}` : uno
  }
  // Con un solo grupo posible el selector no elige nada, así que no se dibuja.
  const idsDeGrupo =
    permitidos === null ? grupos.map((grupo) => grupo.id) : permitidos.length > 1 ? permitidos : []
  const opcionesDeGrupo = [
    { id: '', etiqueta: permitidos === null ? 'Toda la diócesis' : 'Todos mis grupos' },
    ...idsDeGrupo.map((uno) => ({ id: uno, etiqueta: nombreDeGrupo(uno) })),
  ]

  const eventos = consulta.data?.pages.flatMap((pagina) => pagina.auditoria.eventos) ?? []
  const actores = opcionesDelFiltro(
    eventos,
    (evento) =>
      evento.actorPersonaId && evento.actorNombre
        ? [evento.actorPersonaId, evento.actorNombre]
        : null,
    actorPersonaId,
  )
  const texto = busqueda.trim().toLowerCase()
  const visiblesDeActores = [
    ...actores.filter((uno) => uno.id === actorPersonaId),
    ...actores
      .filter((uno) => uno.id !== actorPersonaId && uno.etiqueta.toLowerCase().includes(texto))
      .slice(0, ACTORES_A_LA_VISTA),
  ]
  const acciones = opcionesDelFiltro(
    eventos,
    (evento) => [evento.accion, etiquetaDeAccion(evento.accion)],
    accion,
  )

  return (
    <ScrollView
      className="flex-1 bg-surface"
      contentContainerClassName="px-4 pb-10"
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled"
    >
      <Volver href={`/grupos/${id}/mas`}>Más</Volver>
      <Titulo acompaña="Quién cambió qué y cuándo, del más reciente al más antiguo.">
        Auditoría
      </Titulo>
      <View className="mt-4">
        <BotonSecundario onPress={exportar} disabled={exportando}>
          {exportando ? 'Preparando Excel…' : 'Exportar Excel'}
        </BotonSecundario>
        {errorAlExportar && <Falla>{errorAlExportar}</Falla>}
      </View>

      <View className="mt-5 gap-4">
        {idsDeGrupo.length > 0 && (
          <Campo etiqueta="Grupo">
            <Filtros opciones={opcionesDeGrupo} valor={grupoId} onElegir={setGrupoId} />
          </Campo>
        )}
        <View className="flex-row gap-3">
          <View className="flex-1">
            <Campo etiqueta="Desde">
              <TextInput
                className={CAMPO}
                placeholder="aaaa-mm-dd"
                keyboardType="numbers-and-punctuation"
                value={desde}
                onChangeText={setDesde}
              />
            </Campo>
          </View>
          <View className="flex-1">
            <Campo etiqueta="Hasta">
              <TextInput
                className={CAMPO}
                placeholder="aaaa-mm-dd"
                keyboardType="numbers-and-punctuation"
                value={hasta}
                onChangeText={setHasta}
              />
            </Campo>
          </View>
        </View>
        <Campo etiqueta="Módulo">
          <Filtros
            opciones={[{ id: '', etiqueta: 'Todos' }, ...MODULOS_AUDITADOS]}
            valor={modulo}
            onElegir={setModulo}
          />
        </Campo>
        {acciones.length > 0 && (
          <Campo etiqueta="Acción">
            <Filtros
              opciones={[{ id: '', etiqueta: 'Todas' }, ...acciones]}
              valor={accion}
              onElegir={setAccion}
            />
          </Campo>
        )}
        {actores.length > 0 && (
          <Campo etiqueta="Quién">
            {/* La gente que actúa en un grupo son decenas: una píldora por
                persona tapa la pantalla. Se busca por nombre y se muestran
                pocas; la elegida siempre queda a la vista. */}
            <TextInput
              className={CAMPO}
              placeholder="Buscar por nombre"
              autoCapitalize="none"
              autoCorrect={false}
              value={busqueda}
              onChangeText={setBusqueda}
            />
            <View className="mt-2">
              <Filtros
                opciones={[{ id: '', etiqueta: 'Cualquiera' }, ...visiblesDeActores]}
                valor={actorPersonaId}
                onElegir={setActorPersonaId}
              />
            </View>
          </Campo>
        )}
      </View>

      {consulta.isPending && <Cargando>Consultando…</Cargando>}
      {consulta.error && <Falla>No se pudo consultar la auditoría: {consulta.error.message}</Falla>}

      <View className="mt-5">
        {eventos.map((evento) => (
          <Fila key={evento.id} evento={evento} conGrupo={grupoId !== id} />
        ))}
      </View>

      {!consulta.isPending && !consulta.error && eventos.length === 0 && (
        <Vacio>No hay eventos con estos filtros.</Vacio>
      )}

      {consulta.hasNextPage && (
        <View className="mt-4">
          <BotonSecundario
            onPress={() => consulta.fetchNextPage()}
            disabled={consulta.isFetchingNextPage}
          >
            {consulta.isFetchingNextPage ? 'Cargando…' : 'Cargar anteriores'}
          </BotonSecundario>
        </View>
      )}
    </ScrollView>
  )
}
