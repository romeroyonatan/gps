import type { Trazos } from '@gps/salidas/dominio'
import { type PointerEvent as EventoDePuntero, useRef, useState } from 'react'

/** El lienzo donde se dibuja la firma. Guarda coordenadas normalizadas de 0 a
 *  1, no pixeles: la misma firma tiene que verse igual hecha en un telefono de
 *  375px y en una pantalla grande, y el PDF la escala a donde vaya.
 *
 *  Sin libreria: son pointer events y lineas. Una libreria de firma traeria
 *  suavizado y presion, que un permiso de salida no necesita.
 *
 *  `touch-none` es lo que impide que arrastrar el dedo scrollee la pagina en
 *  vez de dibujar; sin eso, en un telefono no se puede firmar. */
export function PadDeFirma(props: {
  onCambiar: (trazos: Trazos) => void
  deshabilitado?: boolean
}) {
  const lienzo = useRef<HTMLCanvasElement>(null)
  const [trazos, setTrazos] = useState<(readonly [number, number])[][]>([])
  const dibujando = useRef(false)

  function puntoDe(evento: EventoDePuntero<HTMLCanvasElement>): readonly [number, number] {
    const caja = evento.currentTarget.getBoundingClientRect()
    return [(evento.clientX - caja.left) / caja.width, (evento.clientY - caja.top) / caja.height]
  }

  function repintar(todos: (readonly [number, number])[][]) {
    const canvas = lienzo.current
    const pincel = canvas?.getContext('2d')
    if (!canvas || !pincel) return
    pincel.clearRect(0, 0, canvas.width, canvas.height)
    pincel.strokeStyle = '#000000'
    pincel.lineWidth = 2
    pincel.lineCap = 'round'
    pincel.lineJoin = 'round'
    for (const trazo of todos) {
      pincel.beginPath()
      trazo.forEach(([x, y], indice) => {
        const px = x * canvas.width
        const py = y * canvas.height
        if (indice === 0) pincel.moveTo(px, py)
        else pincel.lineTo(px, py)
      })
      pincel.stroke()
    }
  }

  function actualizar(todos: (readonly [number, number])[][]) {
    setTrazos(todos)
    repintar(todos)
    props.onCambiar({ trazos: todos })
  }

  return (
    <div>
      <canvas
        ref={lienzo}
        width={600}
        height={200}
        aria-label="Dibujá tu firma"
        className="h-40 w-full touch-none rounded-lg border border-dashed border-line-strong bg-white"
        onPointerDown={(evento) => {
          if (props.deshabilitado) return
          // Capturar el puntero mantiene el trazo aunque el dedo se salga del
          // lienzo: sin esto, la linea se corta en el borde.
          evento.currentTarget.setPointerCapture(evento.pointerId)
          dibujando.current = true
          actualizar([...trazos, [puntoDe(evento)]])
        }}
        onPointerMove={(evento) => {
          if (!dibujando.current) return
          const ultimo = trazos[trazos.length - 1] ?? []
          actualizar([...trazos.slice(0, -1), [...ultimo, puntoDe(evento)]])
        }}
        onPointerUp={() => {
          dibujando.current = false
        }}
        onPointerLeave={() => {
          dibujando.current = false
        }}
      />
      <button
        type="button"
        onClick={() => actualizar([])}
        className="mt-1 min-h-9 text-label text-ink-muted hover:text-ink"
      >
        Borrar y empezar de nuevo
      </button>
    </div>
  )
}
