import { useDefinirCuotaDeAfiliacion, useTesoreria } from '@gps/api'
import { type FormEvent, useState } from 'react'
import { useLocation } from 'wouter'
import { BOTON_PRINCIPAL, CAMPO, Campo, Falla, Titulo, Volver } from '../ui'

/** Definir la cuota de un período. Pantalla propia y no un formulario colgado
 *  del historial: es una tarea que termina, y al terminar vuelve a la lista,
 *  que recién cargada es la confirmación de que salió bien. */
export function NuevaCuota() {
  const consulta = useTesoreria()
  const definir = useDefinirCuotaDeAfiliacion()
  const [, navegar] = useLocation()
  const [periodoElegido, setPeriodoElegido] = useState('')
  const [importe, setImporte] = useState('')
  const periodos = consulta.data?.periodosConfigurablesDeAfiliacion ?? []
  const periodo = periodoElegido || String(periodos[0] ?? '')

  function guardar(evento: FormEvent) {
    evento.preventDefault()
    definir.mutate(
      { periodo: Number(periodo), importe: Number(importe) },
      { onSuccess: () => navegar('/tesoreria/configuracion') },
    )
  }

  return (
    <>
      <Volver href="/tesoreria/configuracion">Cuotas</Volver>
      <Titulo acompaña="Se aplica a las declaraciones del período. Lo ya cobrado conserva su importe.">
        Definir una cuota
      </Titulo>

      <form onSubmit={guardar} className="mt-6 max-w-[560px] space-y-5">
        <Campo etiqueta="Período de afiliación">
          <select
            required
            value={periodo}
            onChange={(evento) => setPeriodoElegido(evento.target.value)}
            className={`${CAMPO} h-13`}
          >
            {periodos.map((uno) => (
              <option key={uno} value={uno}>
                {uno} — marzo {uno} a febrero {uno + 1}
              </option>
            ))}
          </select>
        </Campo>

        <Campo etiqueta="Importe en pesos">
          <input
            type="number"
            min="1"
            step="1"
            required
            value={importe}
            onChange={(evento) => setImporte(evento.target.value)}
            className={`${CAMPO} h-13 tabular-nums`}
          />
        </Campo>

        {definir.error && <Falla>{definir.error.message}</Falla>}

        <button
          type="submit"
          disabled={definir.isPending || periodo === ''}
          className={BOTON_PRINCIPAL}
        >
          {definir.isPending ? 'Guardando…' : 'Guardar cuota'}
        </button>
      </form>
    </>
  )
}
