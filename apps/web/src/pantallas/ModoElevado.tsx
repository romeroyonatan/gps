import { usePersonaActual, useRefrescarSesion } from '@gps/api'
import { useEffect, useState } from 'react'
import { Link } from 'wouter'
import { cuantoFalta } from './cuenta-regresiva'
import { enlaceDeElevacion } from './Ingreso'

/** La franja del modo elevado, con la cuenta regresiva.
 *
 *  La cuenta es de la interfaz, no la barrera: el servidor compara
 *  `elevadaHasta` contra su propio reloj en cada pedido, así que adelantar el
 *  reloj del teléfono no estira nada. Lo que hace acá es que las acciones
 *  globales desaparezcan solas cuando vence, en vez de quedar dibujadas hasta
 *  que alguien las toque y reciba un error. */
export function ModoElevado(props: { entorno: string }) {
  const sesion = usePersonaActual()
  const refrescar = useRefrescarSesion()
  const quien = sesion.data?.personaActual
  const [ahora, setAhora] = useState(() => Date.now())

  const hasta = quien?.elevadaHasta ?? null
  const falta = hasta ? cuantoFalta(hasta, ahora) : null

  // El reloj sólo corre mientras haya algo que contar: sin `falta` en las
  // dependencias seguía haciendo un render por segundo para siempre después
  // de vencida la elevación, contando un tiempo que ya no existe.
  useEffect(() => {
    if (!hasta || !falta) return
    const reloj = setInterval(() => setAhora(Date.now()), 1000)
    return () => clearInterval(reloj)
  }, [hasta, falta])

  // Al vencer se vuelve a preguntar una sola vez: el servidor va a contestar
  // que ya no está elevada, y con eso desaparece todo lo global.
  useEffect(() => {
    if (hasta && !falta) void refrescar()
  }, [hasta, falta, refrescar])

  if (!quien?.esAdministradorDesignado) return null

  if (!quien.estaElevado || !falta) {
    return (
      <a
        href={enlaceDeElevacion(props.entorno === 'demo' ? 'demo' : 'google', 'administrador')}
        className="mt-4 flex min-h-11 items-center rounded-lg bg-warn-soft px-4 text-sm text-warn"
      >
        Elevarse para administrar todo →{' '}
        <span className="opacity-80">pide volver a identificarte</span>
      </a>
    )
  }

  return (
    <div className="mt-4 rounded-lg bg-warn-soft px-4 py-2.5 text-sm text-warn">
      Modo elevado: ves y modificás toda la diócesis. Vence en {falta}. Todo lo que escribas queda
      auditado.{' '}
      <Link href="/auditoria" className="font-semibold underline">
        Ver auditoría →
      </Link>
    </div>
  )
}
