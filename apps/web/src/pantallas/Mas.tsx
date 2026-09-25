import { useActor } from '@gps/api'
import { puedeAuditarGrupo } from '@gps/auditoria/dominio'
import { Link } from 'wouter'
import { CHEVRON, Icono, Titulo } from '../ui'

/** El quinto destino de la barra del teléfono: lo que no entra en cuatro. Es
 *  una pantalla y no una hoja, así que se comparte, se recarga y vuelve atrás
 *  como todas. En escritorio no hace falta: la columna tiene lugar para todo. */
export function Mas(props: { grupoId: string }) {
  const actor = useActor()
  const entradas = [
    {
      texto: 'Plantel',
      detalle: 'Jefatura y Secretaría del grupo',
      href: `/grupos/${props.grupoId}/plantel`,
    },
    ...(actor && puedeAuditarGrupo(actor, props.grupoId)
      ? [
          {
            texto: 'Auditoría',
            detalle: 'Quién cambió qué y cuándo',
            href: `/grupos/${props.grupoId}/auditoria`,
          },
        ]
      : []),
  ]

  return (
    <>
      <Titulo>Más</Titulo>
      <ul className="mt-5">
        {entradas.map((entrada) => (
          <li key={entrada.href} className="border-b border-line last:border-b-0">
            <Link
              href={entrada.href}
              className="flex min-h-14 items-center gap-3 py-2 active:bg-surface-3"
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-semibold">{entrada.texto}</span>
                <span className="text-label text-ink-muted">{entrada.detalle}</span>
              </span>
              <Icono trazos={CHEVRON} className="size-5 shrink-0 text-ink-faint" />
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}
