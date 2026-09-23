// apps/web/src/App.tsx

import {
  type ParticionDelCache,
  useActor,
  useCerrarSesion,
  useParticionDelCache,
  usePersonaActual,
  useVersion,
} from '@gps/api'
import type { Actor } from '@gps/core'
import { nombreCompleto } from '@gps/personas/dominio'
import { puedeVerTesoreriaDeLaDiocesis } from '@gps/tesoreria/dominio'
import { type ReactNode, useEffect, useRef } from 'react'
import { Link, Route, Switch, useLocation, useRoute } from 'wouter'
import { Afiliacion } from './pantallas/Afiliacion'
import { AltaDePersona } from './pantallas/AltaDePersona'
import {
  CambioDeRol,
  inicioDelRol,
  olvidarRolActivo,
  useNombreDelAmbito,
  useRolActivo,
} from './pantallas/CambioDeRol'
import { ConfiguracionDeCuotas } from './pantallas/ConfiguracionDeCuotas'
import { CuentaDeGrupo } from './pantallas/CuentaDeGrupo'
import { Enlace } from './pantallas/Enlace'
import { Estructura } from './pantallas/Estructura'
import { Grupo } from './pantallas/Grupo'
import { ElegirRol, Ingreso } from './pantallas/Ingreso'
import { ModoElevado } from './pantallas/ModoElevado'
import { Nomina } from './pantallas/Nomina'
import { NuevaCuota } from './pantallas/NuevaCuota'
import { NuevaSalida } from './pantallas/NuevaSalida'
import { CambioDeRama, EditarPersona, Persona } from './pantallas/Persona'
import { Plantel } from './pantallas/Plantel'
import { RegistrarPago } from './pantallas/RegistrarPago'
import { Reportes } from './pantallas/Reportes'
import { Salida } from './pantallas/Salida'
import { Salidas } from './pantallas/Salidas'
import { Tesoreria } from './pantallas/Tesoreria'
import { Icono } from './ui'

/** La salida. Vive en la cabecera y no en la hoja de roles porque quien tiene
 *  un solo rol no tiene hoja, y sin esto no tendría por dónde salir. */
function Salir(props: { personaId: string }) {
  const cerrar = useCerrarSesion()

  return (
    <button
      type="button"
      onClick={() => {
        // El rol elegido se olvida acá y no al entrar: es la decisión de esta
        // sesión, y la siguiente vuelve a preguntar.
        olvidarRolActivo(props.personaId)
        // Recarga después de cerrar: la cookie ya no está y todo lo que se
        // estaba mostrando era de la sesión anterior. Va en la promesa y no en
        // `onSuccess`: cerrar deja `personaActual` en nadie, esto se desmonta
        // con la cabecera, y react-query saltea los callbacks de `mutate` de un
        // observador sin oyentes.
        cerrar.mutateAsync().then(
          () => window.location.assign('/'),
          () => {},
        )
      }}
      disabled={cerrar.isPending}
      className="text-xs font-medium text-ink-muted hover:text-ink"
    >
      Salir
    </button>
  )
}

/** Una entrada del menú de tareas. `exacta` es para las raíces: sin eso, la
 *  raíz queda encendida en todas las pantallas que cuelgan de ella. */
interface Tarea {
  readonly texto: string
  readonly href: string
  readonly trazos: readonly string[]
  readonly exacta?: boolean
}

/** Las tareas del grupo, en el mismo orden en los dos lugares donde se
 *  dibujan: al costado en pantalla grande, abajo en el teléfono. Los iconos
 *  son de una sola pieza cada uno; no vale la pena una librería para cinco. */
const TAREAS = [
  {
    texto: 'Principal',
    a: (id: string) => `/grupos/${id}`,
    trazos: ['M3 10.5 12 3l9 7.5', 'M5.5 9.5V20h13V9.5'],
  },
  {
    texto: 'Nómina',
    a: (id: string) => `/grupos/${id}/nomina`,
    trazos: ['M9 6h11M9 12h11M9 18h11', 'M4.5 6h.01M4.5 12h.01M4.5 18h.01'],
  },
  {
    texto: 'Salidas',
    a: (id: string) => `/grupos/${id}/salidas`,
    trazos: ['M12 3.5 3 20.5h18L12 3.5Z', 'M12 11.5 7.5 20.5h9L12 11.5Z'],
  },
  {
    texto: 'Plantel',
    a: (id: string) => `/grupos/${id}/plantel`,
    trazos: [
      'M9.5 11.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z',
      'M2.5 20v-1a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v1',
      'M16.5 5.3a3.5 3.5 0 0 1 0 6.4M17 15.2a4 4 0 0 1 4.5 3.8V20',
    ],
  },
  {
    texto: 'Tesorería',
    a: (id: string) => `/tesoreria/grupos/${id}`,
    trazos: [
      'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z',
      'M12 6.5v11M14.6 9.6A2.7 2.7 0 0 0 12 8.2c-1.4 0-2.5.8-2.5 1.9s1.1 1.9 2.5 1.9 2.5.8 2.5 1.9-1.1 1.9-2.5 1.9a2.7 2.7 0 0 1-2.6-1.4',
    ],
  },
] as const

const tareasDelGrupo = (grupoId: string): readonly Tarea[] =>
  TAREAS.map((tarea) => ({
    texto: tarea.texto,
    href: tarea.a(grupoId),
    trazos: tarea.trazos,
    // "Principal" es la raíz del grupo: sin esto quedaría encendida en todas
    // las demás, que cuelgan de ella.
    exacta: tarea.texto === 'Principal',
  }))

/** Las tareas de Tesorería diocesana, que no manda sobre ningún grupo y por
 *  eso no tenía menú. La solapa "Pagos" del mockup no está: un pago se carga
 *  desde la cuenta del grupo al que se le imputa, y una lista suelta de todos
 *  los pagos no responde ninguna pregunta que alguien se haga. */
const TAREAS_DE_TESORERIA: readonly Tarea[] = [
  {
    texto: 'Deuda',
    href: '/tesoreria',
    exacta: true,
    trazos: [
      'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z',
      'M12 6.5v11M14.6 9.6A2.7 2.7 0 0 0 12 8.2c-1.4 0-2.5.8-2.5 1.9s1.1 1.9 2.5 1.9 2.5.8 2.5 1.9-1.1 1.9-2.5 1.9a2.7 2.7 0 0 1-2.6-1.4',
    ],
  },
  {
    texto: 'Reportes',
    href: '/tesoreria/reportes',
    trazos: ['M4 20h16', 'M7 20V12M12 20V5M17 20v-6'],
  },
  {
    texto: 'Cuotas',
    href: '/tesoreria/configuracion',
    trazos: ['M6.5 3h8L18 6.5V21h-11.5V3Z', 'M9.5 10h5M9.5 14h5M9.5 17.5h3'],
  },
]

/** El menú de tareas. Es uno solo con dos formas: columna al costado desde
 *  `md`, barra fija abajo en el teléfono —donde llega el pulgar—. Quién se lo
 *  lleva lo decide el rol activo: el grupo si manda sobre uno, Tesorería si
 *  mira la diócesis. */
function Tareas(props: { tareas: readonly Tarea[]; etiqueta: string; forma: 'columna' | 'barra' }) {
  const [donde] = useLocation()
  const tareas = props.tareas.map((tarea) => ({
    ...tarea,
    activa: tarea.exacta ? donde === tarea.href : donde.startsWith(tarea.href),
  }))

  if (props.forma === 'barra') {
    return (
      <nav
        aria-label={props.etiqueta}
        // `flex` y no `grid-cols-N`: la cantidad de tareas cambia con el rol y
        // Tailwind lee las clases del fuente, así que no se puede interpolar.
        className="dark fixed inset-x-0 bottom-0 z-20 flex bg-surface pb-[env(safe-area-inset-bottom)] text-ink md:hidden"
      >
        {tareas.map((tarea) => (
          <Link
            key={tarea.texto}
            href={tarea.href}
            aria-current={tarea.activa ? 'page' : undefined}
            className={`flex h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
              tarea.activa ? 'text-ink' : 'text-ink-muted'
            }`}
          >
            <Icono trazos={tarea.trazos} />
            {tarea.texto}
          </Link>
        ))}
      </nav>
    )
  }

  return (
    <nav aria-label={props.etiqueta} className="hidden md:block">
      <ul className="space-y-0.5">
        {tareas.map((tarea) => (
          <li key={tarea.texto}>
            <Link
              href={tarea.href}
              aria-current={tarea.activa ? 'page' : undefined}
              className={`flex h-11 items-center gap-2.5 rounded-lg px-3 text-sm font-medium ${
                tarea.activa ? 'bg-surface-3 text-ink' : 'text-ink-muted hover:bg-surface-2'
              }`}
            >
              <Icono trazos={tarea.trazos} />
              {tarea.texto}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}

function Rutas() {
  return (
    <Switch>
      <Route path="/" component={Estructura} />
      <Route path="/tesoreria/grupos/:id/pago">
        {(params) => <RegistrarPago grupoId={params.id} />}
      </Route>
      <Route path="/tesoreria/grupos/:id">
        {(params) => <CuentaDeGrupo grupoId={params.id} />}
      </Route>
      <Route path="/tesoreria/reportes" component={Reportes} />
      <Route path="/tesoreria/configuracion/nueva" component={NuevaCuota} />
      <Route path="/tesoreria/configuracion" component={ConfiguracionDeCuotas} />
      <Route path="/tesoreria" component={Tesoreria} />
      <Route path="/grupos/:id/afiliacion">{(params) => <Afiliacion grupoId={params.id} />}</Route>
      <Route path="/grupos/:id/nomina">{(params) => <Nomina grupoId={params.id} />}</Route>
      <Route path="/grupos/:id/personas/:personaId/editar">
        {(params) => <EditarPersona grupoId={params.id} personaId={params.personaId} />}
      </Route>
      <Route path="/grupos/:id/personas/:personaId/rama">
        {(params) => <CambioDeRama grupoId={params.id} personaId={params.personaId} />}
      </Route>
      <Route path="/grupos/:id/personas/:personaId">
        {(params) => <Persona grupoId={params.id} personaId={params.personaId} />}
      </Route>
      <Route path="/grupos/:id/alta">{(params) => <AltaDePersona grupoId={params.id} />}</Route>
      <Route path="/grupos/:id/salidas/nueva">
        {(params) => <NuevaSalida grupoId={params.id} />}
      </Route>
      <Route path="/grupos/:id/salidas/:permisoId">
        {(params) => <Salida grupoId={params.id} permisoId={params.permisoId} />}
      </Route>
      <Route path="/grupos/:id/salidas">{(params) => <Salidas grupoId={params.id} />}</Route>
      <Route path="/grupos/:id/plantel">{(params) => <Plantel grupoId={params.id} />}</Route>
      <Route path="/grupos/:id">{(params) => <Grupo id={params.id} />}</Route>
      <Route>
        <p className="mt-8 text-sm text-ink-muted">No hay nada en esta dirección.</p>
      </Route>
    </Switch>
  )
}

/** La cáscara de la app: la barra de 44px con la palabra-marca y el contenido
 *  centrado. `cabecera` es lo que va al lado de la marca; sólo hay algo que
 *  poner cuando hay sesión, y por eso la salida cuelga de lo mismo.
 *  `relative` es para que la hoja de roles cuelgue de la barra. */
function Cascara(props: {
  personaId?: string
  /** Cómo se llama quien tiene la sesión. Sólo lo usa el pie de la barra: en
   *  la cabecera del teléfono no hay ancho para el nombre y el ámbito. */
  nombre?: string
  cabecera?: ReactNode
  /** Lo mismo que `cabecera`, pero abriendo hacia arriba: cuelga del pie de la
   *  barra de tareas, donde no hay lugar para una hoja que baje. */
  pie?: ReactNode
  /** El menú del rol activo, si tiene uno: es lo que hace aparecer la barra
   *  de tareas, negra al costado y negra al pie. */
  menu?: { etiqueta: string; tareas: readonly Tarea[] }
  children: ReactNode
}) {
  return (
    <div className="min-h-dvh bg-surface font-sans text-base text-ink md:flex">
      {/* La barra de tareas es negra en las dos formas: `dark` le da vuelta los
          tokens adentro, así que lo que cuelga de ella -el conmutador de rol,
          la salida- se dibuja solo, sin una paleta aparte. */}
      {props.menu && (
        <aside className="dark sticky top-0 hidden h-dvh w-52 shrink-0 flex-col bg-surface px-3 py-4 text-ink md:flex">
          <span className="px-3 text-base font-extrabold tracking-[-0.02em]">GPS</span>
          <div className="mt-6 flex-1">
            <Tareas tareas={props.menu.tareas} etiqueta={props.menu.etiqueta} forma="columna" />
          </div>
          {/* De quién es la sesión abierta y sobre qué manda: en un aparato
              compartido las dos cosas se responden acá, no en un avatar. */}
          <div className="relative flex flex-col items-start gap-1 px-3">
            {props.nombre && (
              <span className="max-w-full text-sm font-semibold text-pretty">{props.nombre}</span>
            )}
            {props.pie}
            {props.personaId && (
              <span className="mt-2">
                <Salir personaId={props.personaId} />
              </span>
            )}
          </div>
        </aside>
      )}

      <div className="min-w-0 flex-1">
        <header
          className={`relative flex h-11 items-center gap-2.5 border-b border-line px-5 ${props.menu ? 'md:hidden' : ''}`}
        >
          <span className="shrink-0 text-base font-extrabold tracking-[-0.02em]">GPS</span>
          {props.cabecera ?? <span className="text-xs text-ink-muted">Gestión para Scouts</span>}
          {props.personaId && (
            <span className="ml-auto">
              <Salir personaId={props.personaId} />
            </span>
          )}
        </header>

        {/* En el teléfono la barra de tareas va fija abajo -ahí llega el
            pulgar-, y este hueco es su alto: sin él tapa la última fila. */}
        <main
          className={`mx-auto w-full max-w-[1180px] px-5 py-7 ${props.menu ? 'pb-24 md:pb-7' : ''}`}
        >
          {props.children}
        </main>
      </div>

      {props.menu && (
        <Tareas tareas={props.menu.tareas} etiqueta={props.menu.etiqueta} forma="barra" />
      )}
    </div>
  )
}

/** Lo que hay adentro de una sesión: primero con qué rol se entra, después la
 *  app. Es un componente aparte y no un `if` en App porque `useRolActivo`
 *  guarda la elección por persona, y un hook no puede esperar a que se sepa
 *  quién es: hasta que hay actor, esto no se monta. */
function ConSesion(props: {
  actor: Actor
  /** El nombre de pila, para saludar al elegir rol. */
  nombre: string | null
  /** Apellido y nombre, para el pie de la barra: de quién es esta sesión. Es
   *  la misma forma que usa el padrón en todas las listas. */
  quienEs: string | null
  entorno: string
}) {
  const personaId = props.actor.personaId
  const rol = useRolActivo(props.actor)
  const nombreDelAmbito = useNombreDelAmbito()
  const [donde, navegar] = useLocation()

  // Entrar cae en el inicio del rol activo, tenga uno solo o varios: la
  // jefatura de un grupo entra a su grupo, no al directorio de la diócesis.
  // Una sola vez, y sólo desde la portada: un enlace profundo compartido gana,
  // y volver a `/` a mano después es ir al directorio a propósito.
  const yaAterrizo = useRef(false)
  const activo = rol.activo
  useEffect(() => {
    if (yaAterrizo.current || !rol.elegido || !activo) return
    yaAterrizo.current = true
    const inicio = inicioDelRol(activo)
    if (donde === '/' && inicio !== '/') navegar(inicio, { replace: true })
  }, [rol.elegido, activo, donde, navegar])

  if (!rol.activo) {
    return (
      <Cascara personaId={personaId}>
        <p className="text-sm text-ink-muted">No tenés ninguna función vigente.</p>
      </Cascara>
    )
  }

  // Elegir rol todavía es entrar: la sesión existe pero la app no se dibujó.
  // Se pregunta antes y no después porque el rol define qué app se ve, y
  // dibujar una para cambiarla en el toque siguiente es dibujar la
  // equivocada. Con una sola función no se pregunta nada: se entra con ésa.
  if (!rol.elegido) {
    return (
      <ElegirRol
        nombre={props.nombre}
        roles={rol.roles}
        ambitoDe={nombreDelAmbito}
        elegir={(funcion) => {
          rol.elegir(funcion)
          navegar(inicioDelRol(funcion))
        }}
      />
    )
  }

  // El rol decide el menú: el grupo si manda sobre uno; si no, y si mira la
  // diócesis, el de Tesorería. Quien no tiene ninguno de los dos -el
  // comisionado- sigue sin barra, que es lo que había antes para todos.
  const grupoId = rol.activo.ambito.tipo === 'grupo' ? rol.activo.ambito.id : null
  const menu = grupoId
    ? { etiqueta: 'Tareas del grupo', tareas: tareasDelGrupo(grupoId) }
    : puedeVerTesoreriaDeLaDiocesis(props.actor)
      ? { etiqueta: 'Tareas de Tesorería', tareas: TAREAS_DE_TESORERIA }
      : undefined

  return (
    <Cascara
      personaId={personaId}
      cabecera={<CambioDeRol roles={rol.roles} activo={rol.activo} elegir={rol.elegir} />}
      pie={
        <CambioDeRol
          roles={rol.roles}
          activo={rol.activo}
          elegir={rol.elegir}
          hacia="arriba"
          envuelve
        />
      }
      nombre={props.quienEs ?? undefined}
      menu={menu}
    >
      <ModoElevado entorno={props.entorno} />
      <Rutas />
    </Cascara>
  )
}

export function App(props: { particion: ParticionDelCache }) {
  const version = useVersion()
  const sesion = usePersonaActual()
  useParticionDelCache(props.particion)
  const quien = sesion.data?.personaActual ?? null
  const actor = useActor()
  const entorno = version.data?.version.entorno ?? ''

  // Los enlaces de invitación van antes de la puerta: son justamente para
  // quien todavía no tiene sesión, y esperar a saber quién es sólo agrega una
  // pantalla en blanco.
  const [esActivacion, activacion] = useRoute('/activacion/:secreto')
  const [esRecuperacion, recuperacion] = useRoute('/recuperacion/:secreto')
  const enlace = esActivacion
    ? ({ tipo: 'activacion', secreto: activacion.secreto } as const)
    : esRecuperacion
      ? ({ tipo: 'recuperacion', secreto: recuperacion.secreto } as const)
      : null

  if (enlace) {
    return (
      <Cascara>
        <Enlace tipo={enlace.tipo} secreto={enlace.secreto} />
      </Cascara>
    )
  }

  // Mientras no se sepa quién es, no se dibuja ni el login ni las pantallas:
  // mostrar el login un instante a alguien que ya entró es peor que esperar.
  if (sesion.isPending) {
    return (
      <Cascara>
        <p className="text-sm text-ink-muted">Un momento…</p>
      </Cascara>
    )
  }

  // La puerta no lleva la cáscara: es una pantalla partida a sangre, sin barra
  // ni contenedor, así que sale antes en vez de pelearse con el max-width.
  if (!quien || !actor) return <Ingreso entorno={entorno} />

  // Apellido y nombre sólo cuando están los dos: "González, " a medias es
  // peor que el nombre de pila solo.
  const quienEs =
    quien.nombres && quien.apellidos
      ? nombreCompleto({ nombres: quien.nombres, apellidos: quien.apellidos })
      : (quien.nombres ?? null)

  return (
    <ConSesion actor={actor} nombre={quien.nombres ?? null} quienEs={quienEs} entorno={entorno} />
  )
}
