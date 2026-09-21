import type { Trazos } from '@gps/salidas/dominio'
import { useRef, useState } from 'react'
import { type LayoutChangeEvent, PanResponder, View } from 'react-native'
import Svg from 'react-native-svg'
import { AccionAlMargen, Trazo } from '../src/ui'

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
          {/* `text-ink` y no un hex: la app sigue al sistema (ver
              app/_layout.tsx), y en oscuro una firma negra no se ve. */}
          {trazos.map((trazo) => (
            <Trazo
              key={trazo.id}
              d={trazo.puntos.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x} ${y}`).join(' ')}
              className="text-ink"
              strokeWidth={0.008}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          ))}
        </Svg>
      </View>
      <AccionAlMargen onPress={() => actualizar([])}>Borrar y empezar de nuevo</AccionAlMargen>
    </View>
  )
}
