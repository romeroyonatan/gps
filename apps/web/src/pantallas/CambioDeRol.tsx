import { useDistritos } from '@gps/api'
import type { Actor, RolConAmbito } from '@gps/core'
import { claveDelRol, nombreDelRol, rolesParaElegir } from '@gps/personas/dominio'
import { useState } from 'react'
import { useLocation } from 'wouter'

type Funcion = RolConAmbito

/** A dónde entra cada rol. Cambiar de rol vuelve a este inicio y no intenta
 *  traducir la pantalla actual: la bandeja del comisionado no tiene
 *  equivalente en tesorería. */
export function inicioDelRol(funcion: Funcion): string {
  if (funcion.ambito.tipo === 'grupo' && funcion.ambito.id) return `/grupos/${funcion.ambito.id}`
  if (funcion.rol === 'tesoreriaDiocesana') return '/tesoreria'
  return '/'
}

/** El rol activo se recuerda mientras dure la sesión: se vuelve a la pantalla
 *  donde se dejó sin volver a elegir. Va en `localStorage` y no en el servidor
 *  porque es una preferencia de este dispositivo, no un hecho de la persona
 *  —y la autorización no depende de ella: el servidor sigue mirando todas las
 *  funciones vigentes—.
 *
 *  Cerrar sesión lo olvida: entrar de nuevo es empezar de nuevo, y en un
 *  dispositivo compartido heredar el rol de quien salió es lo contrario de lo
 *  que se pidió al salir. */
function clavePersistida(personaId: string) {
  return `gps.rol:${personaId}`
}

function leerGuardado(personaId: string): string | null {
  try {
    return localStorage.getItem(clavePersistida(personaId))
  } catch {
    return null
  }
}

/** Lo llama la salida: sin esto, volver a entrar reabre el último rol en vez
 *  de preguntar. */
export function olvidarRolActivo(personaId: string): void {
  try {
    localStorage.removeItem(clavePersistida(personaId))
  } catch {
    // Ventana privada o almacenamiento bloqueado: no había nada que olvidar.
  }
}

export function useRolActivo(actor: Actor) {
  const roles = rolesParaElegir(actor)
  const [elegida, elegir] = useState(() => leerGuardado(actor.personaId))
  const guardado = roles.find((funcion) => claveDelRol(funcion) === elegida) ?? null
  // Si lo guardado ya no corresponde -le revocaron el cargo- se cae al
  // primero en vez de dejar la pantalla sin rol.
  const activo = guardado ?? roles[0] ?? null

  return {
    roles,
    activo,
    /** Si ya hay una decisión, propia o porque no había nada que decidir. Con
     *  una sola función no se pregunta: se entra con ésa. */
    elegido: guardado !== null || roles.length <= 1,
    elegir(funcion: Funcion) {
      const clave = claveDelRol(funcion)
      try {
        localStorage.setItem(clavePersistida(actor.personaId), clave)
      } catch {
        // Ventana privada o almacenamiento bloqueado: el rol vale igual para
        // esta sesión, sólo no se recuerda para la próxima.
      }
      elegir(clave)
    },
  }
}

/** El nombre de la entidad sobre la que manda un rol. Sale del directorio de
 *  la asociación, que ve cualquiera con sesión. */
export function useNombreDelAmbito() {
  const { data } = useDistritos()
  const distritos = data?.distritos ?? []

  return (funcion: Funcion): string => {
    if (funcion.ambito.tipo === 'diocesis') return 'Toda la diócesis'
    if (funcion.ambito.tipo === 'distrito') {
      const distrito = distritos.find((uno) => uno.id === funcion.ambito.id)
      return distrito ? `Distrito ${distrito.numero} · ${distrito.zona}` : 'Su distrito'
    }
    for (const distrito of distritos) {
      const grupo = distrito.grupos.find((uno) => uno.id === funcion.ambito.id)
      if (grupo) return `Grupo Nº${grupo.numero} · ${grupo.nombre}`
    }
    return 'Su grupo'
  }
}

/** El conmutador de rol. Vive en dos lugares -la cabecera del teléfono y el
 *  pie de la barra de tareas-, y por eso la hoja se abre para donde haya
 *  lugar: abajo en la cabecera, arriba cuando cuelga del pie.
 *
 *  Con una sola función no hay control: se muestra el ámbito y nada más. No se
 *  ofrece un menú de una sola opción. */
export function CambioDeRol(props: {
  roles: readonly Funcion[]
  activo: Funcion
  elegir: (funcion: Funcion) => void
  hacia?: 'abajo' | 'arriba'
  /** Si el ámbito puede ocupar dos líneas. En el pie de la barra sobra alto y
   *  falta ancho, así que un nombre largo se lee entero; en la cabecera del
   *  teléfono la franja mide 44px y ahí se recorta. */
  envuelve?: boolean
}) {
  const { roles, activo, elegir } = props
  const arriba = props.hacia === 'arriba'
  const nombreDelAmbito = useNombreDelAmbito()
  const [, navegar] = useLocation()
  const [abierta, abrir] = useState(false)

  // El tope de ancho es lo que hace que `truncate` haga algo: sin él la caja
  // crece con el texto y se sale. `max-w-full` lo topa contra la columna del
  // pie y `min-w-0` lo deja encogerse en la fila de la cabecera.
  if (roles.length === 1) {
    return (
      <span
        className={`block min-w-0 max-w-full text-sm text-ink-muted ${
          props.envuelve ? 'text-pretty' : 'truncate'
        }`}
        title={nombreDelAmbito(activo)}
      >
        {nombreDelAmbito(activo)}
      </span>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={() => abrir(!abierta)}
        aria-expanded={abierta}
        title={nombreDelAmbito(activo)}
        className={`inline-flex min-h-9 min-w-0 max-w-full items-center gap-1.5 rounded-full border px-2.5 text-sm font-semibold ${
          abierta
            ? 'border-accent bg-accent text-accent-ink'
            : 'border-line-strong text-ink hover:bg-surface-3'
        }`}
      >
        <span className="truncate">{nombreDelRol(activo.rol)}</span>
        <span aria-hidden="true" className="text-xs">
          {abierta ? '▲' : '▼'}
        </span>
      </button>

      {abierta && (
        <>
          {/* Cierra al tocar afuera. Va detrás de la hoja y delante de todo lo
              demás, que es justo lo que atenúa el contenido. */}
          <button
            type="button"
            aria-label="Cerrar"
            onClick={() => abrir(false)}
            className={`fixed inset-0 z-10 cursor-default bg-velo backdrop-blur-sm ${
              arriba ? '' : 'top-11'
            }`}
          />
          <div
            className={`absolute inset-x-0 z-20 border-line bg-surface shadow-md ${
              arriba ? 'bottom-full mb-2 rounded-lg border' : 'top-11 border-b'
            }`}
          >
            <p className="px-5 pb-1 pt-2 text-label text-ink-muted">Entrar como</p>
            {roles.map((funcion) => {
              const esActivo = claveDelRol(funcion) === claveDelRol(activo)
              return (
                <button
                  key={claveDelRol(funcion)}
                  type="button"
                  onClick={() => {
                    elegir(funcion)
                    abrir(false)
                    navegar(inicioDelRol(funcion))
                  }}
                  className={`flex min-h-16 w-full items-center gap-3 px-5 text-left ${
                    esActivo ? 'bg-surface-3' : 'hover:bg-surface-2'
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-base font-semibold">
                      {nombreDelRol(funcion.rol)}
                    </span>
                    <span className="block text-label text-ink-muted">
                      {nombreDelAmbito(funcion)}
                    </span>
                  </span>
                  {esActivo && <span aria-hidden="true">✓</span>}
                </button>
              )
            })}
          </div>
        </>
      )}
    </>
  )
}
