import type { Trazos } from '@gps/salidas/dominio'
import { useRef, useState } from 'react'
import { type LayoutChangeEvent, PanResponder, Pressable, Text, View } from 'react-native'
import Svg, { Path } from 'react-native-svg'

/** La tinta. Es el valor de `--ink` en claro y no la variable: react-native-svg
 *  no lee clases ni variables CSS, quiere un color.
 *  ponytail: mobile todavía no prende el modo oscuro -`darkMode: 'class'` y
 *  nadie pone la clase-; cuando lo prenda, esto sale del tema y no de acá. */
const TINTA = '#000000'

/** El lienzo donde se dibuja la firma, en mobile. Guarda el mismo formato que
 *  el de web -coordenadas normalizadas de 0 a 1- para que una firma hecha en el
 *  telefono se vea igual en el PDF que una hecha en la compu.
 *
 *  PanResponder y no gestos de reanimated: lo unico que hace falta es la
 *  posicion del dedo, y PanResponder viene con React Native. */
export function PadDeFirma(props: { onCambiar: (trazos: Trazos) => void }) {
  // Cada trazo con un id propio, para que React lo identifique sin usar el
  // indice: dibujar es agregar al final, pero borrar reinicia la lista entera y
  // con indices React reusaria los paths viejos.
  const [trazos, setTrazos] = useState<{ id: number; puntos: (readonly [number, number])[] }[]>([])
  const siguienteId = useRef(0)
  const medida = useRef({ ancho: 1, alto: 1 })
  // En un ref ademas del estado: los callbacks de PanResponder se crean una vez
  // y capturarian el primer valor del estado para siempre.
  const actuales = useRef<{ id: number; puntos: (readonly [number, number])[] }[]>([])

  function actualizar(todos: { id: number; puntos: (readonly [number, number])[] }[]) {
    actuales.current = todos
    setTrazos(todos)
    props.onCambiar({ trazos: todos.map((trazo) => trazo.puntos) })
  }

  function punto(x: number, y: number): readonly [number, number] {
    return [
      Math.min(Math.max(x / medida.current.ancho, 0), 1),
      Math.min(Math.max(y / medida.current.alto, 0), 1),
    ]
  }

  const gestos = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evento) => {
        const { locationX, locationY } = evento.nativeEvent
        actualizar([
          ...actuales.current,
          { id: siguienteId.current++, puntos: [punto(locationX, locationY)] },
        ])
      },
      onPanResponderMove: (evento) => {
        const { locationX, locationY } = evento.nativeEvent
        const anteriores = actuales.current
        const ultimo = anteriores[anteriores.length - 1]
        if (!ultimo) return
        actualizar([
          ...anteriores.slice(0, -1),
          { ...ultimo, puntos: [...ultimo.puntos, punto(locationX, locationY)] },
        ])
      },
    }),
  ).current

  function medir(evento: LayoutChangeEvent) {
    const { width, height } = evento.nativeEvent.layout
    medida.current = { ancho: width || 1, alto: height || 1 }
  }

  return (
    <View>
      <View
        onLayout={medir}
        {...gestos.panHandlers}
        className="h-40 w-full rounded-lg border border-dashed border-line-strong bg-surface-2"
      >
        <Svg width="100%" height="100%" viewBox="0 0 1 1" preserveAspectRatio="none">
          {trazos.map((trazo) => (
            <Path
              key={trazo.id}
              d={trazo.puntos.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x} ${y}`).join(' ')}
              stroke={TINTA}
              strokeWidth={0.008}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          ))}
        </Svg>
      </View>
      <Pressable onPress={() => actualizar([])} className="min-h-12 justify-center">
        <Text className="text-sm text-ink-muted">Borrar y empezar de nuevo</Text>
      </Pressable>
    </View>
  )
}
