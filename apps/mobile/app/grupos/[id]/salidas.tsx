import {
  type PermisosQuery,
  type TipoDeCargo,
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
  useSubirArchivo,
  useTransporte,
} from '@gps/api'
import { aFechaDeCalendario } from '@gps/core/fechas'
import { nombreCompleto } from '@gps/personas/dominio'
import {
  avisoDeAnticipacion,
  candidatos,
  cuentaRegresivaDeSalida,
  type Trazos,
} from '@gps/salidas/dominio'
import * as DocumentPicker from 'expo-document-picker'
import * as ImagePicker from 'expo-image-picker'
import { Link, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import {
  Alert,
  Linking,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native'
import { PadDeFirma } from '../../../componentes/PadDeFirma'

type Permiso = PermisosQuery['permisos'][number]

const CLASE_DE_INPUT = 'rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900'

const COLOR_DE_ESTADO: Record<string, string> = {
  borrador: 'bg-slate-100 text-slate-700',
  emitido: 'bg-amber-100 text-amber-800',
  firmado: 'bg-emerald-100 text-emerald-800',
  anulado: 'bg-slate-100 text-slate-400',
}

function Casilla(props: { marcada: boolean; onCambiar: () => void; children: React.ReactNode }) {
  return (
    <Pressable onPress={props.onCambiar} className="flex-row items-center gap-2 py-1.5">
      <View
        className={`h-5 w-5 items-center justify-center rounded border ${
          props.marcada ? 'border-slate-900 bg-slate-900' : 'border-slate-300'
        }`}
      >
        {props.marcada && <Text className="text-xs text-white">✓</Text>}
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
    <View className="mt-3 border-t border-slate-100 pt-3">
      <Text className="text-xs font-semibold text-slate-700">¿Qué unidades van?</Text>
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
          <Text className="text-sm text-slate-700">{unidad.nombreParaMostrar}</Text>
        </Casilla>
      ))}

      <Text className="mt-3 text-xs font-semibold text-slate-700">
        ¿Quiénes van? <Text className="font-normal text-slate-400">{puestos.size} elegidos</Text>
      </Text>
      {puedenIr.length === 0 ? (
        <Text className="mt-1 text-xs text-slate-400">Elegí primero alguna unidad.</Text>
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
            <Text className="text-sm text-slate-700">
              {nombreCompleto(persona)}
              {persona.pertenencia.categoria === 'activo' && (
                <Text className="text-slate-400"> · dirigente</Text>
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

/** Las tres firmas. La camara es el caso principal: el papel que firmo el
 *  sacerdote se fotografia en el momento. */
function Firmas(props: { permiso: Permiso }) {
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
    <View className="mt-3 border-t border-slate-100 pt-3">
      <Text className="text-xs font-semibold text-slate-700">Firmas</Text>
      {props.permiso.firmas.map((firma) => (
        <View key={firma.cargo} className="mt-2 rounded-lg bg-slate-50 p-2.5">
          <Text className="text-sm text-slate-900">
            {firma.firmada ? '✓' : '○'} {firma.nombreDelCargo}
            <Text className="text-slate-400"> · {firma.quien ?? 'sin ocupante'}</Text>
          </Text>

          {firma.firmada ? (
            <Text className="mt-0.5 text-xs text-slate-500">
              Firmó {firma.modo === 'app' ? 'en la app' : 'en papel'} el {firma.fecha}
              {firma.verificada === false && (
                <Text className="font-medium text-red-700"> · sello no verificado</Text>
              )}
            </Text>
          ) : (
            <View className="mt-1.5 flex-row gap-2">
              <Pressable
                disabled={firma.quien === null}
                onPress={() => {
                  setFirmando(firma.cargo)
                  setTrazos({ trazos: [] })
                }}
                className={`rounded-lg px-3 py-1.5 ${firma.quien === null ? 'bg-slate-300' : 'bg-slate-900'}`}
              >
                <Text className="text-xs text-white">Firmar acá</Text>
              </Pressable>
              <Pressable
                onPress={() => subirPapel(firma.cargo)}
                className="rounded-lg border border-slate-300 px-3 py-1.5"
              >
                <Text className="text-xs text-slate-700">Foto del papel</Text>
              </Pressable>
            </View>
          )}

          {firmando === firma.cargo && (
            <View className="mt-2">
              <Text className="text-xs text-slate-500">
                Vas a firmar como {firma.nombreDelCargo}: {firma.quien}
              </Text>
              <View className="mt-1">
                <PadDeFirma onCambiar={setTrazos} />
              </View>
              <View className="mt-1.5 flex-row gap-3">
                <Pressable
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
                  className="rounded-lg bg-slate-900 px-3 py-1.5"
                >
                  <Text className="text-xs text-white">Firmar</Text>
                </Pressable>
                <Pressable onPress={() => setFirmando(null)} className="py-1.5">
                  <Text className="text-xs text-slate-500">Cancelar</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      ))}
      {(firmarEnApp.error ?? firmarEnPapel.error ?? subir.error) && (
        <View className="mt-2 rounded-lg bg-red-50 p-3">
          <Text className="text-xs text-red-800">
            {(firmarEnApp.error ?? firmarEnPapel.error ?? subir.error)?.message}
          </Text>
        </View>
      )}
    </View>
  )
}

/** Las planificaciones y demas. Se suben desde el telefono y se abren con el
 *  visor del sistema: un PDF o un .docx no se dibujan adentro de la app, y el
 *  navegador ya sabe mostrarlos o pasarlos a la app que corresponda. */
function Adjuntos(props: { permiso: Permiso }) {
  const subir = useSubirArchivo()
  const quitar = useQuitarAdjunto()
  // El origen del backend: en el telefono un link relativo no resuelve contra
  // nada.
  const { origen } = useTransporte()

  return (
    <View className="mt-3 border-t border-slate-100 pt-3">
      <Text className="text-xs font-semibold text-slate-700">Adjuntos</Text>

      {props.permiso.adjuntos.length === 0 ? (
        <Text className="mt-1 text-xs text-slate-400">Ninguno todavía.</Text>
      ) : (
        props.permiso.adjuntos.map((adjunto) => (
          <View key={adjunto.id} className="flex-row items-center justify-between py-1.5">
            <Pressable
              onPress={() => Linking.openURL(`${origen}${adjunto.url}?descargar`)}
              className="flex-1"
            >
              <Text className="text-sm text-slate-700 underline">{adjunto.nombre}</Text>
            </Pressable>
            {/* Con confirmacion: borra el archivo y no se deshace. */}
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
              className="px-2 py-1"
            >
              <Text className="text-xs text-slate-400">quitar</Text>
            </Pressable>
          </View>
        ))
      )}

      <View className="mt-1.5 flex-row gap-2">
        <Pressable
          onPress={async () => {
            const archivo = await elegirDocumento()
            if (archivo) subir.mutate({ permisoId: props.permiso.id, archivo, adjuntar: true })
          }}
          className="rounded-lg border border-slate-300 px-3 py-1.5"
        >
          <Text className="text-xs text-slate-700">Adjuntar archivo</Text>
        </Pressable>
        <Pressable
          onPress={async () => {
            // Una foto del croquis o de la lista escrita a mano: pasa seguido y
            // el explorador de archivos no la encuentra.
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
          className="rounded-lg border border-slate-300 px-3 py-1.5"
        >
          <Text className="text-xs text-slate-700">Foto</Text>
        </Pressable>
      </View>

      {subir.isPending && <Text className="mt-1 text-xs text-slate-500">Subiendo…</Text>}
      {(subir.error ?? quitar.error) && (
        <View className="mt-2 rounded-lg bg-red-50 p-3">
          <Text className="text-xs text-red-800">{(subir.error ?? quitar.error)?.message}</Text>
        </View>
      )}
    </View>
  )
}

function Tarjeta(props: { permiso: Permiso; grupoId: string }) {
  const { permiso } = props
  const emitir = useEmitirPermiso()
  const anular = useAnularPermiso()
  const hoy = aFechaDeCalendario(new Date())
  const aviso = avisoDeAnticipacion(hoy, permiso.desde)

  return (
    <View className="mt-4 rounded-lg bg-white p-4">
      <View className="flex-row items-start justify-between gap-2">
        <Text className="flex-1 text-sm font-semibold text-slate-900">{permiso.lugar}</Text>
        <View className={`rounded-full px-2 py-0.5 ${COLOR_DE_ESTADO[permiso.estado] ?? ''}`}>
          <Text className="text-xs">{permiso.estado}</Text>
        </View>
      </View>
      <Text className="mt-0.5 text-xs text-slate-500">
        {permiso.desde} a {permiso.hasta} · {cuentaRegresivaDeSalida(hoy, permiso.desde)}
        {permiso.comoSeViaja ? ` · ${permiso.comoSeViaja}` : ''}
      </Text>

      {permiso.estado === 'borrador' && <Armado permiso={permiso} grupoId={props.grupoId} />}
      {(permiso.estado === 'emitido' || permiso.estado === 'firmado') && (
        <Firmas permiso={permiso} />
      )}

      <Adjuntos permiso={permiso} />

      {permiso.estado === 'borrador' && (
        <>
          {aviso && (
            <View className="mt-2 rounded-lg bg-amber-50 p-3">
              <Text className="text-xs text-amber-900">{aviso.mensaje}</Text>
            </View>
          )}
          <Pressable
            onPress={() => emitir.mutate({ permisoId: permiso.id })}
            className="mt-3 rounded-lg bg-slate-900 px-4 py-3"
          >
            <Text className="text-center text-sm font-medium text-white">Emitir permiso</Text>
          </Pressable>
        </>
      )}

      {emitir.data?.emitirPermiso.avisos.map((mensaje) => (
        <View key={mensaje} className="mt-2 rounded-lg bg-amber-50 p-3">
          <Text className="text-xs text-amber-900">{mensaje}</Text>
        </View>
      ))}
      {(emitir.error ?? anular.error) && (
        <View className="mt-2 rounded-lg bg-red-50 p-3">
          <Text className="text-xs text-red-800">{(emitir.error ?? anular.error)?.message}</Text>
        </View>
      )}

      {(permiso.estado === 'emitido' || permiso.estado === 'firmado') && (
        <Pressable onPress={() => anular.mutate({ permisoId: permiso.id })} className="mt-3">
          <Text className="text-xs text-slate-400">Anular permiso</Text>
        </Pressable>
      )}
    </View>
  )
}

export default function Pantalla() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const consulta = usePermisos(id)
  const crear = useCrearPermiso()
  const hoy = aFechaDeCalendario(new Date())
  const [datos, setDatos] = useState({
    lugar: '',
    direccion: '',
    localidad: '',
    provincia: '',
    telefono: '',
    desde: hoy,
    hasta: hoy,
    comoSeViaja: '',
  })

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <ScrollView contentContainerClassName="px-4 py-10">
        <Link href={`/grupos/${id}`} className="text-sm text-slate-500">
          ← Grupo
        </Link>
        <Text className="mt-1 text-lg font-semibold text-slate-900">Permisos de salida</Text>

        {consulta.isPending && <Text className="mt-8 text-sm text-slate-500">Consultando…</Text>}
        {consulta.error && (
          <View className="mt-8 rounded-lg bg-red-50 p-4">
            <Text className="text-sm text-red-800">{consulta.error.message}</Text>
          </View>
        )}

        {(consulta.data?.permisos ?? []).map((permiso) => (
          <Tarjeta key={permiso.id} permiso={permiso} grupoId={id} />
        ))}
        {consulta.data?.permisos.length === 0 && (
          <View className="mt-6 rounded-lg bg-white p-4">
            <Text className="text-sm text-slate-500">
              El grupo todavía no cargó ninguna salida.
            </Text>
          </View>
        )}

        <View className="mt-8 gap-3 rounded-lg bg-white p-4">
          <Text className="text-sm font-semibold text-slate-900">Nueva salida</Text>
          <TextInput
            className={CLASE_DE_INPUT}
            value={datos.lugar}
            onChangeText={(lugar) => setDatos({ ...datos, lugar })}
            placeholder="¿A dónde van?"
          />
          <TextInput
            className={CLASE_DE_INPUT}
            value={datos.direccion}
            onChangeText={(direccion) => setDatos({ ...datos, direccion })}
            placeholder="Dirección"
          />
          <TextInput
            className={CLASE_DE_INPUT}
            value={datos.telefono}
            onChangeText={(telefono) => setDatos({ ...datos, telefono })}
            placeholder="Teléfono de contacto"
            keyboardType="phone-pad"
          />
          <View className="flex-row gap-2">
            <TextInput
              className={`${CLASE_DE_INPUT} flex-1`}
              value={datos.localidad}
              onChangeText={(localidad) => setDatos({ ...datos, localidad })}
              placeholder="Localidad"
            />
            <TextInput
              className={`${CLASE_DE_INPUT} flex-1`}
              value={datos.provincia}
              onChangeText={(provincia) => setDatos({ ...datos, provincia })}
              placeholder="Provincia"
            />
          </View>
          <View className="flex-row gap-2">
            <TextInput
              className={`${CLASE_DE_INPUT} flex-1`}
              value={datos.desde}
              onChangeText={(desde) => setDatos({ ...datos, desde })}
              placeholder="aaaa-mm-dd"
            />
            <TextInput
              className={`${CLASE_DE_INPUT} flex-1`}
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
          {crear.error && (
            <View className="rounded-lg bg-red-50 p-3">
              <Text className="text-xs text-red-800">{crear.error.message}</Text>
            </View>
          )}
          <Pressable
            onPress={() =>
              crear.mutate(
                { grupoId: id, ...datos, comoSeViaja: datos.comoSeViaja || null },
                {
                  onSuccess: () =>
                    setDatos({
                      lugar: '',
                      direccion: '',
                      localidad: '',
                      provincia: '',
                      telefono: '',
                      desde: hoy,
                      hasta: hoy,
                      comoSeViaja: '',
                    }),
                },
              )
            }
            className="rounded-lg bg-slate-900 px-4 py-3"
          >
            <Text className="text-center text-sm font-medium text-white">Crear borrador</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
