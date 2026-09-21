import { useInvitacion } from '@gps/api'
import { BOTON_SECUNDARIO, Cargando, Falla, Nota, Titulo } from '../ui'

/** Por qué no sirve un enlace. Se explican los tres casos por separado porque
 *  para quien lo abrió son problemas distintos: uno vencido se vuelve a pedir,
 *  uno usado quiere decir que alguien ya entró con él. */
const PORQUE: Record<string, string> = {
  vencida: 'Este enlace venció o no existe. Pedí uno nuevo a quien te lo mandó.',
  usada: 'Este enlace ya se usó. Si no fuiste vos, avisá a la jefatura de tu grupo.',
  revocada: 'Este enlace fue anulado por quien lo emitió.',
}

/** La pantalla de un enlace de activación o de recuperación.
 *
 *  Muestra a quién le da acceso y en qué grupo **antes** de confirmar, que es
 *  lo que hace que un enlace reenviado por WhatsApp no termine en una cuenta
 *  ajena sin que nadie se dé cuenta. Recién al confirmar arranca el login del
 *  proveedor, que es cuando el enlace se consume.
 *
 *  El enlace es el secreto: quien lo tiene ya podría consumirlo, así que esta
 *  pantalla no pide sesión. */
export function Enlace(props: { tipo: 'activacion' | 'recuperacion'; secreto: string }) {
  const { data, isPending, error } = useInvitacion(props.secreto)
  const invitacion = data?.invitacion

  if (isPending) return <Cargando>Un momento…</Cargando>
  if (error) {
    return <Falla>No se pudo leer el enlace: {error.message}</Falla>
  }

  if (invitacion?.estado !== 'valida') {
    return <Nota>{PORQUE[invitacion?.estado ?? 'vencida'] ?? PORQUE.vencida}</Nota>
  }

  const recupera = invitacion.tipo === 'recuperacion'
  // El proveedor que se va a reemplazar es el que hay que volver a probar: si
  // se perdió el de Google, se entra con el de Google nuevo.
  const proveedor = invitacion.proveedorAReemplazar ?? 'google'

  return (
    <section>
      <Titulo>{recupera ? 'Recuperar el acceso' : 'Activar el acceso'}</Titulo>

      {/* Bloque gris en vez de tarjeta con sombra: agrupa igual y se ve igual
          en web y en React Native. */}
      <div className="mt-5 rounded-lg bg-surface-3 p-4">
        <p className="text-label text-ink-muted">Este enlace es para</p>
        <p className="mt-1 text-xl font-bold">{invitacion.persona}</p>
        {invitacion.grupo && <p className="mt-1 text-sm text-ink-muted">{invitacion.grupo}</p>}
      </div>

      <p className="mt-4 text-base text-ink-muted">
        {recupera
          ? 'Al continuar, la cuenta que uses queda vinculada a esa persona y se cierran todas ' +
            'las sesiones abiertas: vas a tener que entrar de nuevo en cada dispositivo.'
          : 'Al continuar, la cuenta que uses queda vinculada a esa persona.'}
      </p>
      <p className="mt-2 text-base text-ink-muted">
        Si no sos esa persona, cerrá esta página: el enlace se usa una sola vez.
      </p>

      <div className="mt-6 grid gap-2">
        {(recupera ? [proveedor] : ['google', 'apple']).map((cual) => (
          <a
            key={cual}
            href={`/auth/${cual}/iniciar?intencion=${props.tipo}&secreto=${encodeURIComponent(props.secreto)}`}
            className={`${BOTON_SECUNDARIO} min-h-12 text-base`}
          >
            Continuar con{' '}
            {cual === 'apple' ? 'Apple' : cual === 'demo' ? 'el perfil demo' : 'Google'}
          </a>
        ))}
      </div>
    </section>
  )
}
