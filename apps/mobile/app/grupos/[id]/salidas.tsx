import {
  type PermisosQuery,
  type TipoDeCargo,
  useActor,
  useAgregarParticipante,
  useAnularPermiso,
  useCrearPermiso,
  useDistritos,
  useElegirUnidades,
  useEmitirPermiso,
  useFirmarEnApp,
  useFirmarEnPapel,
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
import { Alert, Linking, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { PadDeFirma } from '../../../componentes/PadDeFirma'
import { BarraDeSesion } from '../../../src/BarraDeSesion'

type Permiso = PermisosQuery['permisos'][number]

const CLASE_DE_INPUT = 'min-h-12 rounded-lg border border-line-strong px-3 py-2 text-base text-ink'

/** El estado se lee, no se adivina: la píldora lleva su texto escrito y el
 *  color es refuerzo. */
const TONO_DE_ESTADO: Record<string, string> = {
  borrador: 'bg-surface-3 text-ink-muted',
  emitido: 'bg-warn-soft text-warn',
  firmado: 'bg-ok-soft text-ok',
  anulado: 'bg-surface-3 text-ink-faint',
}

function Etiqueta(props: { estado: string }) {
  const tono = TONO_DE_ESTADO[props.estado] ?? 'bg-surface-3 text-ink-muted'
  const [caja, letra] = tono.split(' ')
  return (
    <View className={`min-h-[26px] justify-center rounded-full px-2.5 py-0.5 ${caja}`}>
      <Text className={`text-label font-semibold ${letra}`}>{props.estado}</Text>
    </View>
  )
}

/** El botón negro: la acción principal de cada bloque. 48px de alto, el
 *  objetivo táctil de la guía. */
function Boton(props: { onPress: () => void; disabled?: boolean; children: string }) {
  return (
    <Pressable
      onPress={props.onPress}
      disabled={props.disabled}
      className={`min-h-12 items-center justify-center rounded-lg bg-accent px-4 ${props.disabled ? 'opacity-50' : ''}`}
    >
      <Text className="text-base font-semibold text-accent-ink">{props.children}</Text>
    </Pressable>
  )
}

function BotonSecundario(props: { onPress: () => void; children: string }) {
  return (
    <Pressable
      onPress={props.onPress}
      className="min-h-12 items-center justify-center rounded-lg border border-line-strong px-4"
    >
      <Text className="text-sm font-medium text-ink">{props.children}</Text>
    </Pressable>
  )
}

function Falla(props: { children: string | undefined }) {
  if (!props.children) return null
  return (
    <View className="mt-2 rounded-lg bg-danger-soft p-3">
      <Text className="text-xs text-danger">{props.children}</Text>
    </View>
  )
}

function Aviso(props: { children: string }) {
  return (
    <View className="mt-2 rounded-lg bg-warn-soft p-3">
      <Text className="text-xs text-warn">{props.children}</Text>
    </View>
  )
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
  const arbol = useDistritos()
  const lista = usePersonasDelGrupo(props.grupoId)
  const elegirUnidades = useElegirUnidades()
  const agregar = useAgregarParticipante()
  const quitar = useQuitarParticipante()

  const grupo = arbol.data?.distritos
    .flatMap((distrito) => distrito.grupos)
    .find((uno) => uno.id === props.grupoId)
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
                  <Pressable onPress={() => setFirmando(null)} className="min-h-12 justify-center">
                    <Text className="text-sm text-ink-muted">Cancelar</Text>
                  </Pressable>
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
              <Pressable
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
                className="min-h-12 justify-center px-2"
              >
                <Text className="text-xs text-ink-muted">quitar</Text>
              </Pressable>
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

function Tarjeta(props: {
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

  return (
    <View className="mt-4 rounded-lg border border-line p-4">
      <View className="flex-row items-start justify-between gap-2">
        <Text className="flex-1 text-lg font-bold text-ink">{permiso.lugar}</Text>
        <Etiqueta estado={permiso.estado} />
      </View>
      <Text className="mt-0.5 text-xs text-ink-muted">
        {permiso.desde} a {permiso.hasta}
        {permiso.comoSeViaja ? ` · ${permiso.comoSeViaja}` : ''}
      </Text>

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
        <Pressable
          onPress={() => anular.mutate({ permisoId: permiso.id })}
          className="mt-3 min-h-12 justify-center"
        >
          <Text className="text-xs text-ink-muted">Anular permiso</Text>
        </Pressable>
      )}
    </View>
  )
}

/** El formulario de alta. El aviso se muestra mientras se escribe y no recién
 *  al emitir: enterarse tarde de que faltan días no le sirve a nadie. */
function NuevoPermiso(props: { grupoId: string }) {
  const crear = useCrearPermiso()
  const hoy = aFechaDeCalendario(new Date())
  const [datos, setDatos] = useState({ lugar: '', desde: hoy, hasta: hoy, comoSeViaja: '' })
  const aviso = avisoDeAnticipacion(hoy, datos.desde)

  return (
    <View className="mt-8 gap-3 rounded-lg border border-line p-4">
      <Text className="text-lg font-bold text-ink">Nueva salida</Text>
      <TextInput
        className={CLASE_DE_INPUT}
        value={datos.lugar}
        onChangeText={(lugar) => setDatos({ ...datos, lugar })}
        placeholder="¿A dónde van?"
      />
      <View className="flex-row gap-2">
        <TextInput
          className={`${CLASE_DE_INPUT} flex-1`}
          accessibilityLabel="Salen"
          value={datos.desde}
          onChangeText={(desde) => setDatos({ ...datos, desde })}
          placeholder="aaaa-mm-dd"
        />
        <TextInput
          className={`${CLASE_DE_INPUT} flex-1`}
          accessibilityLabel="Vuelven"
          value={datos.hasta}
          onChangeText={(hasta) => setDatos({ ...datos, hasta })}
          placeholder="aaaa-mm-dd"
        />
      </View>
      <TextInput
        className={CLASE_DE_INPUT}
        value={datos.comoSeViaja}
        onChangeText={(comoSeViaja) => setDatos({ ...datos, comoSeViaja })}
        placeholder="Cómo viajan (opcional)"
      />
      {aviso && <Aviso>{aviso.mensaje}</Aviso>}
      <Falla>{crear.error?.message}</Falla>
      <Boton
        disabled={crear.isPending}
        onPress={() =>
          crear.mutate(
            { grupoId: props.grupoId, ...datos, comoSeViaja: datos.comoSeViaja || null },
            { onSuccess: () => setDatos({ lugar: '', desde: hoy, hasta: hoy, comoSeViaja: '' }) },
          )
        }
      >
        Crear borrador
      </Boton>
    </View>
  )
}

export default function Pantalla() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const consulta = usePermisos(id)
  const arbol = useDistritos()
  const actor = useActor()

  const distrito = arbol.data?.distritos.find((candidato) =>
    candidato.grupos.some((grupo) => grupo.id === id),
  )
  // Los tres cargos que firman este permiso, para saber cuál de ellos ocupa
  // quien mira. Sin el distrito todavía no se sabe, y el botón no se dibuja.
  const firmantes = distrito ? firmantesRequeridos(id, distrito.id) : []

  return (
    <ScrollView contentContainerClassName="px-4 pb-6">
      <BarraDeSesion />
      <Text className="mt-4 text-2xl font-bold text-ink">Permisos de salida</Text>

      {consulta.isPending && <Text className="mt-8 text-sm text-ink-muted">Consultando…</Text>}
      {consulta.error && (
        <View className="mt-8 rounded-lg bg-danger-soft p-4">
          <Text className="text-sm text-danger">
            No se pudieron consultar los permisos: {consulta.error.message}
          </Text>
        </View>
      )}

      {actor &&
        (consulta.data?.permisos ?? []).map((permiso) => (
          <Tarjeta
            key={permiso.id}
            permiso={permiso}
            grupoId={id}
            actor={actor}
            firmantes={firmantes}
          />
        ))}
      {consulta.data?.permisos.length === 0 && (
        <View className="mt-6 rounded-lg border border-line p-4">
          <Text className="text-sm text-ink-muted">El grupo todavía no cargó ninguna salida.</Text>
        </View>
      )}

      {actor && puedeAdministrarPermisosDelGrupo(actor, id) && <NuevoPermiso grupoId={id} />}
    </ScrollView>
  )
}
