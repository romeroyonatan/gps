import { useActor, useCrearPermiso } from '@gps/api'
import { aFechaDeCalendario } from '@gps/core/fechas'
import { avisoDeAnticipacion, puedeAdministrarPermisosDelGrupo } from '@gps/salidas/dominio'
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { ScrollView, TextInput, View } from 'react-native'
import { Aviso, Boton, CAMPO, Campo, Falla, Nota, Titulo, Volver } from '../../../../src/ui'

/** El alta de una salida. Pantalla propia y no un formulario al pie de la
 *  lista: cargar una salida es una tarea que termina.
 *
 *  El aviso de anticipación se muestra mientras se escribe y no recién al
 *  emitir: enterarse tarde de que faltan días no le sirve a nadie. */
export default function Pantalla() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const hoy = aFechaDeCalendario(new Date())
  const [datos, setDatos] = useState({ lugar: '', desde: hoy, hasta: hoy, comoSeViaja: '' })
  const crear = useCrearPermiso()
  const actor = useActor()
  const aviso = avisoDeAnticipacion(hoy, datos.desde)

  const volver = `/grupos/${id}/salidas`

  // La misma política pura que aplica el servidor: quien llega de memoria a
  // esta dirección sin poder administrar se encuentra con el motivo.
  if (actor !== null && !puedeAdministrarPermisosDelGrupo(actor, id)) {
    return (
      <ScrollView className="flex-1 bg-surface" contentContainerClassName="px-4 pb-10">
        <Volver href={volver}>Salidas</Volver>
        <Nota>Las salidas del grupo las carga su jefatura o su Secretaría.</Nota>
      </ScrollView>
    )
  }

  return (
    <ScrollView
      className="flex-1 bg-surface"
      contentContainerClassName="px-4 pb-10"
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      <Volver href={volver}>Salidas</Volver>
      <Titulo acompaña="Queda como borrador: después elegís qué unidades van y quiénes.">
        Nueva salida
      </Titulo>

      <View className="mt-6 gap-5">
        <Campo etiqueta="¿A dónde van?">
          <TextInput
            className={CAMPO}
            value={datos.lugar}
            onChangeText={(lugar) => setDatos({ ...datos, lugar })}
          />
        </Campo>

        <View className="flex-row gap-3">
          <View className="flex-1">
            <Campo etiqueta="Salen">
              {/* No hay <input type="date"> en React Native: el texto crudo
                  alcanza porque el servidor rechaza lo que no sea una fecha
                  del almanaque. */}
              <TextInput
                className={CAMPO}
                placeholder="aaaa-mm-dd"
                keyboardType="numbers-and-punctuation"
                value={datos.desde}
                onChangeText={(desde) => setDatos({ ...datos, desde })}
              />
            </Campo>
          </View>
          <View className="flex-1">
            <Campo etiqueta="Vuelven">
              <TextInput
                className={CAMPO}
                placeholder="aaaa-mm-dd"
                keyboardType="numbers-and-punctuation"
                value={datos.hasta}
                onChangeText={(hasta) => setDatos({ ...datos, hasta })}
              />
            </Campo>
          </View>
        </View>

        <Campo etiqueta="Cómo viajan">
          <TextInput
            className={CAMPO}
            placeholder="Opcional"
            value={datos.comoSeViaja}
            onChangeText={(comoSeViaja) => setDatos({ ...datos, comoSeViaja })}
          />
        </Campo>

        {aviso && <Aviso>{aviso.mensaje}</Aviso>}
        <Falla>{crear.error?.message}</Falla>

        <Boton
          disabled={crear.isPending}
          onPress={() =>
            crear.mutate(
              { grupoId: id, ...datos, comoSeViaja: datos.comoSeViaja || null },
              // Cae en la salida recién creada y no en la lista: el borrador
              // todavía no tiene unidades ni gente, y elegirlas es el paso
              // siguiente de la misma tarea. `replace` y no `push`: volver
              // desde el borrador es ir a la lista, no al formulario vacío.
              {
                onSuccess: (permiso) =>
                  router.replace(`/grupos/${id}/salidas/${permiso.crearPermiso.id}`),
              },
            )
          }
        >
          {crear.isPending ? 'Creando…' : 'Crear borrador'}
        </Boton>
      </View>
    </ScrollView>
  )
}
