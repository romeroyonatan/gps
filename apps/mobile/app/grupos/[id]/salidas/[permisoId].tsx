import {
  type PermisosQuery,
  type TipoDeCargo,
  useActor,
  useAgregarParticipante,
  useAnularPermiso,
  useElegirUnidades,
  useEmitirPermiso,
  useFirmarEnApp,
  useFirmarEnPapel,
  useGrupo,
  usePermisos,
  usePersonasDelGrupo,
  useQuitarAdjunto,
  useQuitarParticipante,
  useReEmitirPermiso,
  useSubirArchivo,
  useTransporte,
} from '@gps/api'
import type { Actor } from '@gps/core'
import { aFechaDeCalendario } from '@gps/core/fechas'
import { nombreCompleto } from '@gps/personas/dominio'
import {
  avisoDeAnticipacion,
  candidatos,
  type FirmanteRequerido,
  firmantesRequeridos,
  marcaSegunCategoria,
  puedeAdministrarPermisosDelGrupo,
  puedeFirmarEnLaApp,
  resumenDeParticipantes,
  type Trazos,
} from '@gps/salidas/dominio'
import * as DocumentPicker from 'expo-document-picker'
import * as ImagePicker from 'expo-image-picker'
import { useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { Alert, Linking, Pressable, ScrollView, Text, View } from 'react-native'
import { PadDeFirma } from '../../../../componentes/PadDeFirma'
import {
  AccionAlMargen,
  Aviso,
  Boton,
  BotonSecundario,
  Cargando,
  Chip,
  Falla,
  Titulo,
  Vacio,
  Volver,
} from '../../../../src/ui'

type Permiso = PermisosQuery['permisos'][number]

/** Si alguna de las firmas que faltan es la de quien mira. Lo deciden las
 *  mismas funciones puras que corre el servidor, así "pendiente de tu firma"
 *  quiere decir lo mismo en la lista, en el detalle y en el inicio del grupo. */
export function miFirmaPendiente(
  permiso: Permiso,
  actor: Actor | null,
  firmantes: readonly FirmanteRequerido[],
): boolean {
  return permiso.firmas.some((firma) => {
    if (firma.firmada) return false
    const firmante = firmantes.find((uno) => uno.cargo === firma.cargo)
    return actor !== null && firmante !== undefined && puedeFirmarEnLaApp(actor, firmante)
  })
}

/** Cómo está el permiso, contado como lo cuenta quien mira: lo que importa no
 *  es la palabra del estado sino cuántas firmas faltan y si alguna es la suya.
 *  Es el gemelo del de `apps/web/src/pantallas/Salida.tsx`, y la lista lo
 *  importa de acá por lo mismo que allá. */
export function estadoDelPermiso(permiso: Permiso, esperaMiFirma: boolean) {
  if (permiso.estado === 'borrador') return { tono: 'neutro', texto: 'Borrador' } as const
  if (permiso.estado === 'anulado') return { tono: 'neutro', texto: 'Anulada' } as const

  const faltan = permiso.firmas.filter((firma) => !firma.firmada).length
  if (faltan === 0) return { tono: 'ok', texto: 'Firmada por los tres' } as const
  if (esperaMiFirma) return { tono: 'warn', texto: 'Pendiente de tu firma' } as const
  return {
    tono: 'info',
    texto: faltan === 1 ? 'Falta 1 firma' : `Faltan ${faltan} firmas`,
  } as const
}

function Casilla(props: { marcada: boolean; onCambiar: () => void; children: React.ReactNode }) {
  return (
    <Pressable onPress={props.onCambiar} className="min-h-12 flex-row items-center gap-2.5 py-1.5">
      <View
        className={`h-5 w-5 items-center justify-center rounded border ${
          props.marcada ? 'border-accent bg-accent' : 'border-line-strong'
        }`}
      >
        {props.marcada && <Text className="text-xs text-accent-ink">✓</Text>}
      </View>
      <View className="flex-1">{props.children}</View>
    </Pressable>
  )
}

/** Elegir unidades y quien va. Solo mientras es borrador. */
function Armado(props: { permiso: Permiso; grupoId: string }) {
  const { grupo } = useGrupo(props.grupoId)
  const lista = usePersonasDelGrupo(props.grupoId)
  const elegirUnidades = useElegirUnidades()
  const agregar = useAgregarParticipante()
  const quitar = useQuitarParticipante()

  const elegidas = props.permiso.unidadIds
  const puestos = new Set(props.permiso.participantes.map((uno) => uno.personaId))

  // La misma funcion pura que corre el servidor: la pantalla no puede ofrecer a
  // alguien que el servidor despues va a rechazar.
  const puedenIr = candidatos(
    (lista.data?.personas ?? []).map((persona) => ({
      ...persona,
      pertenencia: {
        unidadId: persona.pertenencia.unidadId ?? null,
        categoria: persona.pertenencia.categoria,
      },
    })),
    elegidas,
  )

  return (
    <View className="mt-3 border-t border-line pt-3">
      <Text className="text-label font-semibold text-ink">¿Qué unidades van?</Text>
      {(grupo?.unidades ?? []).map((unidad) => (
        <Casilla
          key={unidad.id}
          marcada={elegidas.includes(unidad.id)}
          onCambiar={() =>
            elegirUnidades.mutate({
              permisoId: props.permiso.id,
              unidadIds: elegidas.includes(unidad.id)
                ? elegidas.filter((id) => id !== unidad.id)
                : [...elegidas, unidad.id],
            })
          }
        >
          <Text className="text-sm text-ink">{unidad.nombreParaMostrar}</Text>
        </Casilla>
      ))}

      <Text className="mt-3 text-label font-semibold text-ink">
        ¿Quiénes van? <Text className="font-normal text-ink-muted">{puestos.size} elegidos</Text>
      </Text>
      {puedenIr.length === 0 ? (
        <Text className="mt-1 text-xs text-ink-faint">Elegí primero alguna unidad.</Text>
      ) : (
        puedenIr.map((persona) => (
          <Casilla
            key={persona.id}
            marcada={puestos.has(persona.id)}
            onCambiar={() =>
              (puestos.has(persona.id) ? quitar : agregar).mutate({
                permisoId: props.permiso.id,
                personaId: persona.id,
              })
            }
          >
            <Text className="text-sm text-ink">
              {nombreCompleto(persona)}
              {marcaSegunCategoria(persona.pertenencia.categoria) === 'dirigente' && (
                <Text className="text-ink-muted"> · dirigente</Text>
              )}
            </Text>
          </Casilla>
        ))
      )}
    </View>
  )
}

/** Un archivo elegido del telefono, listo para subir. React Native no tiene
 *  File: se arma desde el uri que devuelve el picker. */
async function comoArchivo(uri: string, nombre: string, tipo: string): Promise<File> {
  const bytes = await (await fetch(uri)).blob()
  return new File([bytes], nombre, { type: tipo })
}

/** Lo que el jefe de rama ya tenia escrito: una planificacion en .docx, una
 *  lista de materiales, un croquis. Abre el explorador de archivos del
 *  telefono, no la galeria: una planificacion no es una foto. */
async function elegirDocumento(): Promise<File | null> {
  const elegido = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true })
  const archivo = elegido.canceled ? null : elegido.assets[0]
  if (!archivo) return null
  return await comoArchivo(
    archivo.uri,
    archivo.name,
    archivo.mimeType ?? 'application/octet-stream',
  )
}

/** Las tres firmas, cada una con sus dos caminos.
 *
 *  Firmar en la app es personal: el botón sólo aparece para el cargo que ocupa
 *  quien mira, y ni siquiera la elevación firma por otro. El papel, en cambio,
 *  lo registra quien administra el permiso: no verifica la firma, declara que
 *  la vio. La camara es el caso principal: el papel que firmo el sacerdote se
 *  fotografia en el momento. */
function Firmas(props: {
  permiso: Permiso
  actor: Actor
  firmantes: readonly FirmanteRequerido[]
  administra: boolean
}) {
  const [firmando, setFirmando] = useState<TipoDeCargo | null>(null)
  const [trazos, setTrazos] = useState<Trazos>({ trazos: [] })
  const firmarEnApp = useFirmarEnApp()
  const firmarEnPapel = useFirmarEnPapel()
  const subir = useSubirArchivo()

  /** Saca o elige una foto y la sube. Sin convertir del lado del cliente: un
   *  HEIC lo convierte el servidor, que ademas cubre el caso de la web. */
  async function subirPapel(cargo: TipoDeCargo) {
    const elegida = await ImagePicker.launchCameraAsync({ quality: 0.8 })
    const foto = elegida.canceled
      ? await ImagePicker.launchImageLibraryAsync({ quality: 0.8 })
      : elegida
    const archivo = foto.canceled ? null : foto.assets[0]
    if (!archivo) return

    subir.mutate(
      {
        permisoId: props.permiso.id,
        archivo: await comoArchivo(
          archivo.uri,
          archivo.fileName ?? 'firmado.jpg',
          archivo.mimeType ?? 'image/jpeg',
        ),
        adjuntar: false,
      },
      {
        onSuccess: (escaneoId) =>
          firmarEnPapel.mutate({ permisoId: props.permiso.id, cargos: [cargo], escaneoId }),
      },
    )
  }

  return (
    <View className="mt-3 border-t border-line pt-3">
      <Text className="text-label font-semibold text-ink">Firmas</Text>
      {props.permiso.firmas.map((firma) => {
        const firmante = props.firmantes.find((uno) => uno.cargo === firma.cargo)
        const esTuya = firmante !== undefined && puedeFirmarEnLaApp(props.actor, firmante)
        return (
          <View key={firma.cargo} className="mt-2 rounded-lg bg-surface-3 p-2.5">
            <Text className="text-sm text-ink">
              {firma.firmada ? '✓' : '○'} {firma.nombreDelCargo}
              <Text className="text-ink-muted"> · {firma.quien ?? 'sin ocupante'}</Text>
            </Text>

            {firma.firmada ? (
              <Text className="mt-0.5 text-xs text-ink-muted">
                Firmó {firma.modo === 'app' ? 'en la app' : 'en papel'} el {firma.fecha}
                {firma.verificada === false && (
                  <Text className="font-medium text-danger"> · sello no verificado</Text>
                )}
              </Text>
            ) : (
              <View className="mt-1.5 flex-row flex-wrap gap-2">
                {esTuya && firma.quien !== null && (
                  <Boton
                    onPress={() => {
                      setFirmando(firma.cargo)
                      setTrazos({ trazos: [] })
                    }}
                  >
                    Firmar acá
                  </Boton>
                )}
                {props.administra && (
                  <BotonSecundario onPress={() => subirPapel(firma.cargo)}>
                    Foto del papel
                  </BotonSecundario>
                )}
              </View>
            )}

            {firmando === firma.cargo && (
              <View className="mt-2">
                <Text className="text-xs text-ink-muted">
                  Vas a firmar como {firma.nombreDelCargo}: {firma.quien}
                </Text>
                <View className="mt-1">
                  <PadDeFirma onCambiar={setTrazos} />
                </View>
                <View className="mt-1.5 flex-row items-center gap-3">
                  <Boton
                    disabled={firmarEnApp.isPending}
                    onPress={() =>
                      firmarEnApp.mutate(
                        {
                          permisoId: props.permiso.id,
                          cargo: firma.cargo,
                          trazos: JSON.stringify(trazos.trazos),
                        },
                        { onSuccess: () => setFirmando(null) },
                      )
                    }
                  >
                    Firmar
                  </Boton>
                  <AccionAlMargen onPress={() => setFirmando(null)}>Cancelar</AccionAlMargen>
                </View>
              </View>
            )}
          </View>
        )
      })}
      <Falla>{(firmarEnApp.error ?? firmarEnPapel.error ?? subir.error)?.message}</Falla>
      {subir.isPending && (
        <Text className="mt-1 text-xs text-ink-muted">Subiendo el papel firmado…</Text>
      )}
    </View>
  )
}

/** Las planificaciones y demas. Se suben desde el telefono y se abren con el
 *  visor del sistema: un PDF o un .docx no se dibujan adentro de la app, y el
 *  navegador ya sabe mostrarlos o pasarlos a la app que corresponda. */
function Adjuntos(props: { permiso: Permiso; administra: boolean }) {
  const subir = useSubirArchivo()
  const quitar = useQuitarAdjunto()
  // El origen del backend: en el telefono un link relativo no resuelve contra
  // nada.
  const { origen } = useTransporte()

  return (
    <View className="mt-3 border-t border-line pt-3">
      <Text className="text-label font-semibold text-ink">Adjuntos</Text>

      {props.permiso.adjuntos.length === 0 ? (
        <Text className="mt-1 text-xs text-ink-faint">Ninguno todavía.</Text>
      ) : (
        props.permiso.adjuntos.map((adjunto) => (
          <View key={adjunto.id} className="flex-row items-center justify-between py-1.5">
            <Pressable
              onPress={() => Linking.openURL(`${origen}${adjunto.url}?descargar`)}
              className="min-h-12 flex-1 justify-center"
            >
              <Text className="text-sm text-ink underline">{adjunto.nombre}</Text>
            </Pressable>
            {/* Con confirmacion: borra el archivo y no se deshace. */}
            {props.administra && (
              <AccionAlMargen
                onPress={() =>
                  Alert.alert(
                    'Borrar adjunto',
                    `¿Borrar "${adjunto.nombre}"? No se puede deshacer.`,
                    [
                      { text: 'No', style: 'cancel' },
                      {
                        text: 'Borrar',
                        style: 'destructive',
                        onPress: () =>
                          quitar.mutate({ permisoId: props.permiso.id, adjuntoId: adjunto.id }),
                      },
                    ],
                  )
                }
              >
                quitar
              </AccionAlMargen>
            )}
          </View>
        ))
      )}

      {props.administra && (
        <View className="mt-1.5 flex-row gap-2">
          <BotonSecundario
            onPress={async () => {
              const archivo = await elegirDocumento()
              if (archivo) subir.mutate({ permisoId: props.permiso.id, archivo, adjuntar: true })
            }}
          >
            Adjuntar archivo
          </BotonSecundario>
          <BotonSecundario
            onPress={async () => {
              // Una foto del croquis o de la lista escrita a mano: pasa seguido
              // y el explorador de archivos no la encuentra.
              const foto = await ImagePicker.launchImageLibraryAsync({ quality: 0.8 })
              const elegida = foto.canceled ? null : foto.assets[0]
              if (!elegida) return
              subir.mutate({
                permisoId: props.permiso.id,
                archivo: await comoArchivo(
                  elegida.uri,
                  elegida.fileName ?? 'foto.jpg',
                  elegida.mimeType ?? 'image/jpeg',
                ),
                adjuntar: true,
              })
            }}
          >
            Foto
          </BotonSecundario>
        </View>
      )}

      {subir.isPending && <Text className="mt-1 text-xs text-ink-muted">Subiendo…</Text>}
      <Falla>{(subir.error ?? quitar.error)?.message}</Falla>
    </View>
  )
}

function Detalle(props: {
  permiso: Permiso
  grupoId: string
  actor: Actor
  firmantes: readonly FirmanteRequerido[]
}) {
  const { permiso } = props
  const emitir = useEmitirPermiso()
  const anular = useAnularPermiso()
  const reEmitir = useReEmitirPermiso()
  const { origen } = useTransporte()
  const aviso = avisoDeAnticipacion(aFechaDeCalendario(new Date()), permiso.desde)
  const administra = puedeAdministrarPermisosDelGrupo(props.actor, props.grupoId)

  const estado = estadoDelPermiso(permiso, miFirmaPendiente(permiso, props.actor, props.firmantes))

  return (
    <>
      <Titulo
        acompaña={`${permiso.desde} a ${permiso.hasta}${
          permiso.comoSeViaja ? ` · ${permiso.comoSeViaja}` : ''
        }`}
      >
        {permiso.lugar}
      </Titulo>
      <View className="mt-2 flex-row">
        <Chip tono={estado.tono}>{estado.texto}</Chip>
      </View>

      {permiso.estado === 'borrador' && administra && (
        <Armado permiso={permiso} grupoId={props.grupoId} />
      )}

      {permiso.estado !== 'borrador' && permiso.emitidos.length > 0 && (
        <Text className="mt-2 text-xs text-ink-muted">
          {resumenDeParticipantes(
            permiso.emitidos.map((uno) => ({ marca: uno.marca as 'dirigente' | 'beneficiario' })),
          )}
        </Text>
      )}

      {(permiso.estado === 'emitido' || permiso.estado === 'firmado') && (
        <Firmas
          permiso={permiso}
          actor={props.actor}
          firmantes={props.firmantes}
          administra={administra}
        />
      )}

      <Adjuntos permiso={permiso} administra={administra} />

      <View className="mt-3 gap-2 border-t border-line pt-3">
        {permiso.estado === 'borrador' && administra && (
          <>
            {aviso && <Aviso>{aviso.mensaje}</Aviso>}
            <Boton
              disabled={emitir.isPending}
              onPress={() => emitir.mutate({ permisoId: permiso.id })}
            >
              Emitir permiso
            </Boton>
          </>
        )}
        {/* Ver y bajar son la misma cosa en el teléfono: el visor del sistema
            abre el PDF y desde ahí se guarda o se manda. */}
        {permiso.estado !== 'borrador' && (
          <BotonSecundario onPress={() => Linking.openURL(`${origen}/permisos/${permiso.id}/pdf`)}>
            Ver PDF
          </BotonSecundario>
        )}
        {permiso.estado === 'anulado' && administra && (
          <BotonSecundario onPress={() => reEmitir.mutate({ permisoId: permiso.id })}>
            Re-emitir
          </BotonSecundario>
        )}
      </View>

      {emitir.data?.emitirPermiso.avisos.map((mensaje) => (
        <Aviso key={mensaje}>{mensaje}</Aviso>
      ))}
      {permiso.estado === 'emitido' && !permiso.firmas.every((firma) => firma.firmada) && (
        <Text className="mt-2 text-xs text-ink-faint">
          Si alguien va a firmar en la app, mejor que lo haga antes de imprimir.
        </Text>
      )}
      <Falla>{(emitir.error ?? anular.error ?? reEmitir.error)?.message}</Falla>

      {/* Lo menos frecuente, al final y chiquito. */}
      {(permiso.estado === 'emitido' || permiso.estado === 'firmado') && administra && (
        <View className="mt-3">
          <AccionAlMargen onPress={() => anular.mutate({ permisoId: permiso.id })}>
            Anular permiso
          </AccionAlMargen>
        </View>
      )}
    </>
  )
}

/** Una salida: armarla mientras es borrador, firmarla, adjuntarle lo que haya
 *  y bajar el PDF. Todo lo que se toca de un permiso vive acá, y la lista no
 *  tiene un solo control adentro.
 *
 *  Reusa la consulta de la lista en vez de estrenar `permiso(id)`: ya está en
 *  cache porque venís de ahí. El día que la lista se pagine, se agrega
 *  `permiso(id)` y se arregla en un solo lugar. */
export default function Pantalla() {
  const { id, permisoId } = useLocalSearchParams<{ id: string; permisoId: string }>()
  const consulta = usePermisos(id)
  const { distrito } = useGrupo(id)
  const actor = useActor()

  const permiso = consulta.data?.permisos.find((uno) => uno.id === permisoId)
  // Los tres cargos que firman este permiso, para saber cuál de ellos ocupa
  // quien mira. Sin el distrito todavía no se sabe, y el botón no se dibuja.
  const firmantes = distrito ? firmantesRequeridos(id, distrito.id) : []

  return (
    <ScrollView className="flex-1 bg-surface" contentContainerClassName="px-4 pb-10">
      <Volver href={`/grupos/${id}/salidas`}>Salidas</Volver>

      {consulta.isPending && <Cargando>Consultando la salida…</Cargando>}
      {consulta.error && <Falla>No se pudo consultar la salida: {consulta.error.message}</Falla>}
      {!permiso && !consulta.isPending && !consulta.error && (
        <Vacio>No hay ninguna salida en esta dirección.</Vacio>
      )}

      {permiso && actor && (
        <Detalle permiso={permiso} grupoId={id} actor={actor} firmantes={firmantes} />
      )}
    </ScrollView>
  )
}
