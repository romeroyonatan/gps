import type { RolConAmbito } from '@gps/core'
import { claveDelRol, nombreDelRol } from '@gps/personas/dominio'
import type { ReactNode } from 'react'

/** Los perfiles de una sola historia de permisos. El multi-rol no está acá:
 *  es el botón grande de arriba. Sólo se muestran en entorno demo: afuera la
 *  ruta no existe y el servicio también la rechaza. */
const PERFILES_DEMO = [
  { subject: 'jefatura', nombre: 'Jefatura de grupo', que: 'Administra su grupo y lee su cuenta' },
  { subject: 'secretaria', nombre: 'Secretaría', que: 'Lo mismo, desde el equipo del grupo' },
  { subject: 'tesoreria', nombre: 'Tesorería diocesana', que: 'La única que registra pagos' },
  {
    subject: 'comisionado',
    nombre: 'Comisionado de distrito',
    que: 'Firma los permisos de su distrito, no ve los grupos por dentro',
  },
  {
    subject: 'administrador',
    nombre: 'Administración',
    que: 'Entra sin alcance global: tiene que elevarse',
  },
] as const

/** A dónde volver después de entrar. Es la ruta donde estaba la persona, para
 *  que un enlace compartido no la deje en la portada después del login. El
 *  servidor igual sólo acepta rutas relativas. */
function destinoActual(): string {
  return `${window.location.pathname}${window.location.search}`
}

function enlaceDeIngreso(proveedor: string, extra = ''): string {
  return `/auth/${proveedor}/iniciar?destino=${encodeURIComponent(destinoActual())}${extra}`
}

/** La marca del proveedor es una letra en un cuadrado, no un logo: no se
 *  recibió el material de marca de Apple ni de Google y dibujarlo a mano sería
 *  inventarlo. Se reemplaza cuando lleguen los SVG oficiales. */
function Inicial(props: { letra: string; sobreNegro?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex size-5 items-center justify-center rounded-full text-label font-bold ${
        props.sobreNegro ? 'bg-ink-muted text-accent-ink' : 'bg-surface-3 text-ink-muted'
      }`}
    >
      {props.letra}
    </span>
  )
}

/** El botón de proveedor: 56px de alto, el objetivo táctil holgado que pide la
 *  guía para el teléfono. Apple va sólido porque es el primero. */
function Proveedor(props: { href: string; letra: string; solido?: boolean; children: string }) {
  return (
    <a
      href={props.href}
      className={`flex min-h-14 w-full items-center justify-center gap-2.5 rounded-lg text-base font-semibold ${
        props.solido
          ? 'bg-accent text-accent-ink hover:bg-accent-strong'
          : 'border border-line-strong text-ink hover:bg-surface-3'
      }`}
    >
      <Inicial letra={props.letra} sobreNegro={props.solido} />
      {props.children}
    </a>
  )
}

/** La carcasa de las dos pantallas del ingreso: la de los proveedores y la de
 *  elegir rol. Es una sola porque elegir rol sigue siendo entrar —la sesión
 *  existe pero la app todavía no se dibujó—, y cambiar de fondo en el medio
 *  haría parecer que algo falló.
 *
 *  A sangre y sin tarjeta: dos mitades, negra y blanca, sin filete ni margen
 *  entre ellas. A 375px la mitad negra no existe —ahí el que manda es el
 *  contenido— y la pantalla es blanca entera.
 *
 *  En escritorio la altura la fija el viewport y scrollea sólo la mitad
 *  blanca: la negra es un fondo, no contenido que se recorra. La derecha va
 *  alineada arriba y no centrada porque un contenedor flex centrado que además
 *  scrollea recorta el principio de su contenido. */
function Portada(props: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-surface font-sans text-base text-ink md:grid md:h-dvh md:grid-cols-2 md:overflow-hidden">
      <div className="hidden bg-accent text-accent-ink md:flex md:flex-col md:justify-between md:p-12">
        <p className="text-2xl font-bold">GPS</p>
        <div>
          <p className="max-w-[22ch] text-xl font-semibold">Gestión para Scouts</p>
          <p className="mt-2 max-w-[34ch] text-sm text-surface-3">
            Grupos, ramas, afiliaciones y salidas. El acceso es de dirigentes y del personal de la
            diócesis.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 px-6 py-10 md:overflow-y-auto md:p-12">
        {/* En el teléfono la marca va acá, en negro sobre blanco: la mitad
            oscura es una decisión de escritorio, no de la pantalla chica. */}
        <p className="text-3xl font-bold md:hidden">GPS</p>
        {props.children}
      </div>
    </div>
  )
}

export function Ingreso(props: { entorno: string }) {
  return (
    <Portada>
      <h2 className="text-2xl font-bold">Entrar</h2>
      {/* Sólo en escritorio, como en el mockup: en el teléfono no hay bajada,
            porque ahí la pantalla es la marca y el par de botones. */}
      <p className="hidden text-sm text-ink-muted md:block">
        Usá la misma cuenta con la que entrás en el teléfono.
      </p>

      {/* Apple primero: lo exige la App Store cuando hay ingreso social, y
            el orden se mantiene en escritorio para no mover el dedo de lugar. */}
      <div className="mt-2 grid gap-3">
        <Proveedor href={enlaceDeIngreso('apple')} letra="A" solido>
          Continuar con Apple
        </Proveedor>
        <Proveedor href={enlaceDeIngreso('google')} letra="G">
          Continuar con Google
        </Proveedor>
        {/* La persona de demostración tiene varias funciones encima, así que
              entra directo al conmutador de rol de la cabecera: es el camino
              que muestra el producto entero sin pedir cinco logins. */}
        {props.entorno === 'demo' && (
          <Proveedor href={enlaceDeIngreso('demo', '&perfil=demo')} letra="D">
            Iniciar sesión demo
          </Proveedor>
        )}
      </div>

      {props.entorno === 'demo' && (
        <div className="mt-4">
          <h3 className="text-label font-medium text-ink-muted">Una función por vez</h3>
          <p className="mt-1 text-xs text-ink-faint">
            Para mirar una historia de permisos sola, sin las otras encima. Cada uno abre una sesión
            de verdad, con lo que le dan sus cargos y equipos.
          </p>
          <div className="mt-3 grid gap-2">
            {PERFILES_DEMO.map((perfil) => (
              <a
                key={perfil.subject}
                href={enlaceDeIngreso('demo', `&perfil=${perfil.subject}`)}
                className="rounded-lg border border-line-strong px-4 py-3 hover:bg-surface-3"
              >
                <span className="block text-sm font-semibold">{perfil.nombre}</span>
                <span className="mt-0.5 block text-xs text-ink-muted">{perfil.que}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      <p className="mt-4 text-label text-ink-faint">
        Si todavía no tenés acceso, pedile el enlace de activación a la jefatura o a la Secretaría
        de tu grupo.
      </p>
    </Portada>
  )
}

/** Con qué rol entra quien tiene más de uno.
 *
 *  Va acá y no en un menú escondido: el rol define qué app se ve, así que
 *  preguntarlo después de dibujar una app sería dibujar la equivocada. Quien
 *  tiene un solo rol nunca llega a esta pantalla —entra directo con ése—, que
 *  es la otra mitad de la misma regla. */
export function ElegirRol(props: {
  nombre: string | null
  roles: readonly RolConAmbito[]
  ambitoDe: (funcion: RolConAmbito) => string
  elegir: (funcion: RolConAmbito) => void
}) {
  return (
    <Portada>
      <div className="mt-auto overflow-hidden rounded-lg border border-line-strong">
        <div className="border-b border-line px-4 py-3.5">
          <p className="text-lg font-semibold">{props.nombre ? `Hola, ${props.nombre}` : 'Hola'}</p>
          <p className="mt-0.5 text-sm text-ink-muted">
            Tenés {props.roles.length} roles. ¿Con cuál entrás?
          </p>
        </div>
        {props.roles.map((funcion) => (
          <button
            key={claveDelRol(funcion)}
            type="button"
            onClick={() => props.elegir(funcion)}
            className="flex min-h-16 w-full items-center gap-3 border-b border-line px-4 py-3 text-left hover:bg-surface-3"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-base font-semibold">{nombreDelRol(funcion.rol)}</span>
              <span className="block text-label text-ink-muted">{props.ambitoDe(funcion)}</span>
            </span>
            <span aria-hidden="true" className="flex-none text-ink-faint">
              ›
            </span>
          </button>
        ))}
        <p className="px-4 py-3 text-label text-ink-faint">
          Se puede cambiar después desde la cabecera.
        </p>
      </div>
    </Portada>
  )
}

/** El enlace que eleva al administrador: es otro viaje completo por el
 *  proveedor, no un botón que prenda una bandera. */
export function enlaceDeElevacion(proveedor: string, perfil?: string): string {
  const demo = perfil ? `&perfil=${encodeURIComponent(perfil)}` : ''
  return `/auth/${proveedor}/iniciar?intencion=elevar&destino=${encodeURIComponent(destinoActual())}${demo}`
}
