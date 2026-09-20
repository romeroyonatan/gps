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
import { type ReactNode, useEffect, useRef } from 'react'
import { Route, Switch, useLocation, useRoute } from 'wouter'
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
import { Plantel } from './pantallas/Plantel'
import { Salidas } from './pantallas/Salidas'
import { Tesoreria } from './pantallas/Tesoreria'

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
        // estaba mostrando era de la sesión anterior.
        cerrar.mutate(undefined, { onSuccess: () => window.location.assign('/') })
      }}
      disabled={cerrar.isPending}
      className="ml-auto text-xs font-medium text-ink-muted hover:text-ink"
    >
      Salir
    </button>
  )
}

function Rutas() {
  return (
    <Switch>
      <Route path="/" component={Estructura} />
      <Route path="/tesoreria/grupos/:id">
        {(params) => <CuentaDeGrupo grupoId={params.id} />}
      </Route>
      <Route path="/tesoreria/configuracion" component={ConfiguracionDeCuotas} />
      <Route path="/tesoreria" component={Tesoreria} />
      <Route path="/grupos/:id/afiliacion">{(params) => <Afiliacion grupoId={params.id} />}</Route>
      <Route path="/grupos/:id/alta">{(params) => <AltaDePersona grupoId={params.id} />}</Route>
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
function Cascara(props: { personaId?: string; cabecera?: ReactNode; children: ReactNode }) {
  const version = useVersion()

  return (
    <div className="min-h-dvh bg-surface font-sans text-base text-ink">
      <header className="relative flex h-11 items-center gap-2.5 border-b border-line px-5">
        <span className="shrink-0 text-base font-extrabold tracking-[-0.02em]">GPS</span>
        {props.cabecera ?? <span className="text-xs text-ink-muted">Gestión para Scouts</span>}
        {props.personaId && <Salir personaId={props.personaId} />}
      </header>

      <main className="mx-auto w-full max-w-[1180px] px-5 py-7">
        {props.children}

        {version.data && (
          <p className="mt-10 text-xs tabular-nums text-ink-faint">
            v{version.data.version.numero} · {version.data.version.entorno} ·{' '}
            {version.data.version.modulos.join(', ')}
          </p>
        )}
      </main>
    </div>
  )
}

/** Lo que hay adentro de una sesión: primero con qué rol se entra, después la
 *  app. Es un componente aparte y no un `if` en App porque `useRolActivo`
 *  guarda la elección por persona, y un hook no puede esperar a que se sepa
 *  quién es: hasta que hay actor, esto no se monta. */
function ConSesion(props: { actor: Actor; nombre: string | null; entorno: string }) {
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

  return (
    <Cascara
      personaId={personaId}
      cabecera={<CambioDeRol roles={rol.roles} activo={rol.activo} elegir={rol.elegir} />}
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

  return <ConSesion actor={actor} nombre={quien.nombres ?? null} entorno={entorno} />
}
