/** Los perfiles que siembra el escenario demo. Sólo se muestran en ese
 *  entorno: afuera la ruta no existe y el servicio también la rechaza. */
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

function Boton(props: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={props.href}
      className="block rounded-lg border border-slate-300 bg-white px-4 py-3 text-center text-sm font-medium text-slate-900 hover:bg-slate-50 active:bg-slate-100"
    >
      {props.children}
    </a>
  )
}

export function Ingreso(props: { entorno: string }) {
  return (
    <section className="mt-10">
      <h2 className="text-lg font-medium text-slate-900">Entrá a GPS</h2>
      <p className="mt-1 text-sm text-slate-500">
        GPS no tiene contraseña propia: entrás con la cuenta que ya usás.
      </p>

      <div className="mt-6 grid gap-2">
        <Boton href={enlaceDeIngreso('google')}>Continuar con Google</Boton>
        <Boton href={enlaceDeIngreso('apple')}>Continuar con Apple</Boton>
      </div>

      {props.entorno === 'demo' && (
        <div className="mt-8">
          <h3 className="text-sm font-medium text-slate-900">Perfiles de demostración</h3>
          <p className="mt-1 text-xs text-slate-500">
            Cada uno abre una sesión de verdad, con los permisos que le dan sus cargos y equipos.
          </p>
          <div className="mt-3 grid gap-2">
            {PERFILES_DEMO.map((perfil) => (
              <Boton
                key={perfil.subject}
                href={enlaceDeIngreso('demo', `&perfil=${perfil.subject}`)}
              >
                <span className="block">{perfil.nombre}</span>
                <span className="mt-0.5 block text-xs font-normal text-slate-500">
                  {perfil.que}
                </span>
              </Boton>
            ))}
          </div>
        </div>
      )}

      <p className="mt-8 text-xs text-slate-400">
        Si todavía no tenés acceso, pedile el enlace de activación a la jefatura o a la Secretaría
        de tu grupo.
      </p>
    </section>
  )
}

/** El enlace que eleva al administrador: es otro viaje completo por el
 *  proveedor, no un botón que prenda una bandera. */
export function enlaceDeElevacion(proveedor: string, perfil?: string): string {
  const demo = perfil ? `&perfil=${encodeURIComponent(perfil)}` : ''
  return `/auth/${proveedor}/iniciar?intencion=elevar&destino=${encodeURIComponent(destinoActual())}${demo}`
}
