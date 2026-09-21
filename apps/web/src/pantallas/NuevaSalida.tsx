import { useActor, useCrearPermiso } from '@gps/api'
import { aFechaDeCalendario } from '@gps/core/fechas'
import { avisoDeAnticipacion, puedeAdministrarPermisosDelGrupo } from '@gps/salidas/dominio'
import { type FormEvent, useState } from 'react'
import { useLocation } from 'wouter'
import { Aviso, BOTON_PRINCIPAL, CAMPO, Campo, Falla, Nota, Titulo, Volver } from '../ui'

/** El alta de una salida. Pantalla propia y no un formulario al pie de la
 *  lista: cargar una salida es una tarea que termina, y al terminar vuelve a
 *  la lista con el borrador recién creado, que es la confirmación.
 *
 *  El aviso de anticipación se muestra mientras se escribe y no recién al
 *  emitir: enterarse tarde de que faltan días no le sirve a nadie. */
export function NuevaSalida(props: { grupoId: string }) {
  const hoy = aFechaDeCalendario(new Date())
  const [datos, setDatos] = useState({ lugar: '', desde: hoy, hasta: hoy, comoSeViaja: '' })
  const crear = useCrearPermiso()
  const actor = useActor()
  const [, navegar] = useLocation()
  const aviso = avisoDeAnticipacion(hoy, datos.desde)

  const volver = `/grupos/${props.grupoId}/salidas`

  function enviar(evento: FormEvent) {
    evento.preventDefault()
    crear.mutate(
      { grupoId: props.grupoId, ...datos, comoSeViaja: datos.comoSeViaja || null },
      // Cae en la salida recién creada y no en la lista: el borrador todavía
      // no tiene unidades ni gente, y elegirlas es el paso siguiente de la
      // misma tarea. Volver a la lista sería hacerla buscar lo que acaba de
      // cargar para poder terminarla.
      {
        onSuccess: (permiso) =>
          navegar(`/grupos/${props.grupoId}/salidas/${permiso.crearPermiso.id}`),
      },
    )
  }

  // La misma política pura que aplica el servidor: quien llega de memoria a
  // esta dirección sin poder administrar se encuentra con el motivo.
  if (actor !== null && !puedeAdministrarPermisosDelGrupo(actor, props.grupoId)) {
    return (
      <>
        <Volver href={volver}>Salidas</Volver>
        <Nota>Las salidas del grupo las carga su jefatura o su Secretaría.</Nota>
      </>
    )
  }

  return (
    <>
      <Volver href={volver}>Salidas</Volver>
      <Titulo acompaña="Queda como borrador: después elegís qué unidades van y quiénes.">
        Nueva salida
      </Titulo>

      <form onSubmit={enviar} className="mt-6 max-w-[560px] space-y-5">
        <Campo etiqueta="¿A dónde van?">
          <input
            value={datos.lugar}
            onChange={(evento) => setDatos({ ...datos, lugar: evento.target.value })}
            className={`${CAMPO} h-13`}
          />
        </Campo>

        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Salen">
            <input
              type="date"
              value={datos.desde}
              onChange={(evento) => setDatos({ ...datos, desde: evento.target.value })}
              className={`${CAMPO} h-13 tabular-nums`}
            />
          </Campo>
          <Campo etiqueta="Vuelven">
            <input
              type="date"
              value={datos.hasta}
              onChange={(evento) => setDatos({ ...datos, hasta: evento.target.value })}
              className={`${CAMPO} h-13 tabular-nums`}
            />
          </Campo>
        </div>

        <Campo etiqueta="Cómo viajan">
          <input
            value={datos.comoSeViaja}
            onChange={(evento) => setDatos({ ...datos, comoSeViaja: evento.target.value })}
            placeholder="Opcional"
            className={`${CAMPO} h-13`}
          />
        </Campo>

        {aviso && <Aviso>{aviso.mensaje}</Aviso>}
        {crear.error && <Falla>{crear.error.message}</Falla>}

        <button type="submit" disabled={crear.isPending} className={BOTON_PRINCIPAL}>
          {crear.isPending ? 'Creando…' : 'Crear borrador'}
        </button>
      </form>
    </>
  )
}
