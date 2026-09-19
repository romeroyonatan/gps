import { useInvitacion } from '@gps/api'

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

  if (isPending) return <p className="mt-8 text-sm text-slate-500">Un momento…</p>
  if (error) {
    return (
      <p className="mt-8 rounded-lg bg-red-50 p-4 text-sm break-words text-red-800">
        No se pudo leer el enlace: {error.message}
      </p>
    )
  }

  if (invitacion?.estado !== 'valida') {
    return (
      <p className="mt-8 rounded-lg bg-slate-100 p-4 text-sm text-slate-700">
        {PORQUE[invitacion?.estado ?? 'vencida'] ?? PORQUE.vencida}
      </p>
    )
  }

  const recupera = invitacion.tipo === 'recuperacion'
  // El proveedor que se va a reemplazar es el que hay que volver a probar: si
  // se perdió el de Google, se entra con el de Google nuevo.
  const proveedor = invitacion.proveedorAReemplazar ?? 'google'

  return (
    <section className="mt-8">
      <h2 className="text-lg font-medium text-slate-900">
        {recupera ? 'Recuperar el acceso' : 'Activar el acceso'}
      </h2>

      <div className="mt-4 rounded-lg bg-white p-4">
        <p className="text-sm text-slate-500">Este enlace es para</p>
        <p className="mt-0.5 text-base font-medium text-slate-900">{invitacion.persona}</p>
        {invitacion.grupo && <p className="mt-1 text-sm text-slate-600">{invitacion.grupo}</p>}
      </div>

      <p className="mt-4 text-sm text-slate-600">
        {recupera
          ? 'Al continuar, la cuenta que uses queda vinculada a esa persona y se cierran todas ' +
            'las sesiones abiertas: vas a tener que entrar de nuevo en cada dispositivo.'
          : 'Al continuar, la cuenta que uses queda vinculada a esa persona.'}
      </p>
      <p className="mt-2 text-sm text-slate-600">
        Si no sos esa persona, cerrá esta página: el enlace se usa una sola vez.
      </p>

      <div className="mt-6 grid gap-2">
        {(recupera ? [proveedor] : ['google', 'apple']).map((cual) => (
          <a
            key={cual}
            href={`/auth/${cual}/iniciar?intencion=${props.tipo}&secreto=${encodeURIComponent(props.secreto)}`}
            className="block rounded-lg border border-slate-300 bg-white px-4 py-3 text-center text-sm font-medium text-slate-900 hover:bg-slate-50"
          >
            Continuar con{' '}
            {cual === 'apple' ? 'Apple' : cual === 'demo' ? 'el perfil demo' : 'Google'}
          </a>
        ))}
      </div>
    </section>
  )
}
