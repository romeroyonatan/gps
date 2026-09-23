import { aFechaDeCalendario } from '@gps/core/fechas'
import {
  calcularEdad,
  type DatosDePersona,
  type Problema,
  TIPOS_DE_DOCUMENTO,
  type TipoDeDocumento,
} from '@gps/personas/dominio'
import { type ReactNode, useState } from 'react'
import { CAMPO, Campo } from '../ui'

/** Los meses con nombre, no con número: evita el error de 03/04 contra 04/03.
 *  Del `Intl` del navegador y no de una lista escrita a mano —es exactamente
 *  para esto—; el día 1 de cada mes del 2000 es sólo el vehículo. */
const MESES = Array.from({ length: 12 }, (_, indice) => ({
  numero: String(indice + 1),
  nombre: new Intl.DateTimeFormat('es-AR', { month: 'long' }).format(new Date(2000, indice, 1)),
}))

const DIAS = Array.from({ length: 31 }, (_, indice) => String(indice + 1))

interface Partes {
  dia: string
  mes: string
  anio: string
}

/** aaaa-mm-dd partido en tres, para arrancar el formulario con lo que ya hay.
 *  Una fecha vacía o a medias deja los tres selects sin elegir. */
function enPartes(fecha: string): Partes {
  const [anio = '', mes = '', dia = ''] = fecha.split('-')
  if (!anio || !mes || !dia) return { dia: '', mes: '', anio: '' }
  return { dia: String(Number(dia)), mes: String(Number(mes)), anio }
}

/** La fecha de nacimiento, con tres selects nativos y no con un calendario.
 *
 *  Un nacimiento es un dato que la persona sabe de memoria: se elige, no se
 *  busca. Un calendario obliga a navegar meses hacia atrás para alguien
 *  nacido en 2013; esto son tres toques. Los años bajan desde el actual, así
 *  que un chico de 9 está a un par de líneas. La fecha de ingreso sí usa
 *  calendario: es una fecha cercana y ahí el calendario ayuda. */
function FechaDeNacimiento(props: { valor: Partes; onCambiar: (valor: Partes) => void }) {
  const anioActual = new Date().getFullYear()
  const anios = Array.from({ length: 101 }, (_, indice) => String(anioActual - indice))

  return (
    <div className="grid grid-cols-[76px_minmax(0,1fr)_96px] gap-2">
      <select
        aria-label="Día"
        className={`${CAMPO} h-13 tabular-nums`}
        value={props.valor.dia}
        onChange={(evento) => props.onCambiar({ ...props.valor, dia: evento.target.value })}
      >
        <option value="">Día</option>
        {DIAS.map((dia) => (
          <option key={dia} value={dia}>
            {dia}
          </option>
        ))}
      </select>
      <select
        aria-label="Mes"
        className={`${CAMPO} h-13`}
        value={props.valor.mes}
        onChange={(evento) => props.onCambiar({ ...props.valor, mes: evento.target.value })}
      >
        <option value="">Mes</option>
        {MESES.map((mes) => (
          <option key={mes.numero} value={mes.numero}>
            {mes.nombre}
          </option>
        ))}
      </select>
      <select
        aria-label="Año"
        className={`${CAMPO} h-13 tabular-nums`}
        value={props.valor.anio}
        onChange={(evento) => props.onCambiar({ ...props.valor, anio: evento.target.value })}
      >
        <option value="">Año</option>
        {anios.map((anio) => (
          <option key={anio} value={anio}>
            {anio}
          </option>
        ))}
      </select>
    </div>
  )
}

/** Los datos personales de alguien, en el mismo orden y con los mismos
 *  controles en el alta y en la corrección. Es una sola forma escrita una sola
 *  vez: si mañana se agrega un campo, entra en los dos lugares.
 *
 *  No trae botón ni sabe guardar: cada pantalla pone el suyo, porque una da de
 *  alta y la otra corrige. `children` se dibuja después de la fecha de
 *  nacimiento, que es donde el alta mete la unidad. */
export function DatosPersonales(props: {
  datos: DatosDePersona
  onCambiar: (datos: DatosDePersona) => void
  problemaDe: (campo: Problema['campo']) => string | undefined
  hoy: Date
  /** Que la fecha de nacimiento cambió: el alta lo usa para volver a sugerir
   *  la unidad por edad. */
  alCambiarLaFecha?: () => void
  children?: ReactNode
}) {
  const { datos, onCambiar, problemaDe } = props
  const [nacimiento, setNacimiento] = useState<Partes>(() => enPartes(datos.fechaDeNacimiento))
  const edad = datos.fechaDeNacimiento ? calcularEdad(datos.fechaDeNacimiento, props.hoy) : null

  function cambiarNacimiento(valor: Partes) {
    setNacimiento(valor)
    const completa = valor.dia && valor.mes && valor.anio
    onCambiar({
      ...datos,
      fechaDeNacimiento: completa
        ? `${valor.anio}-${valor.mes.padStart(2, '0')}-${valor.dia.padStart(2, '0')}`
        : '',
    })
    props.alCambiarLaFecha?.()
  }

  return (
    <>
      <Campo etiqueta="Apellidos" problema={problemaDe('apellidos')}>
        <input
          className={`${CAMPO} h-13`}
          value={datos.apellidos}
          onChange={(evento) => onCambiar({ ...datos, apellidos: evento.target.value })}
        />
      </Campo>

      <Campo etiqueta="Nombres" problema={problemaDe('nombres')}>
        <input
          className={`${CAMPO} h-13`}
          value={datos.nombres}
          onChange={(evento) => onCambiar({ ...datos, nombres: evento.target.value })}
        />
      </Campo>

      <div>
        <span className="text-sm font-semibold">Fecha de nacimiento</span>
        <div className="mt-2">
          <FechaDeNacimiento valor={nacimiento} onCambiar={cambiarNacimiento} />
        </div>
        <p className="mt-2 text-sm tabular-nums text-ink-muted">
          {edad === null
            ? 'Elegí día, mes y año.'
            : edad < 0
              ? 'Revisá la fecha: todavía no nació.'
              : `${edad} años cumplidos al ${aFechaDeCalendario(props.hoy)}`}
        </p>
        {problemaDe('fechaDeNacimiento') && (
          <p className="mt-1.5 text-sm text-danger">{problemaDe('fechaDeNacimiento')}</p>
        )}
      </div>

      {props.children}

      <div>
        <span className="text-sm font-semibold">Documento</span>
        <div className="mt-2 grid grid-cols-[110px_minmax(0,1fr)] gap-2">
          <select
            aria-label="Tipo de documento"
            className={`${CAMPO} h-13`}
            value={datos.tipoDeDocumento}
            onChange={(evento) =>
              onCambiar({ ...datos, tipoDeDocumento: evento.target.value as TipoDeDocumento })
            }
          >
            {TIPOS_DE_DOCUMENTO.map((tipo) => (
              <option key={tipo.id} value={tipo.id}>
                {tipo.nombre}
              </option>
            ))}
          </select>
          <input
            aria-label="Número de documento"
            className={`${CAMPO} h-13 tabular-nums`}
            value={datos.numeroDeDocumento}
            onChange={(evento) => onCambiar({ ...datos, numeroDeDocumento: evento.target.value })}
            inputMode="numeric"
            placeholder="44.512.663"
          />
        </div>
        {problemaDe('numeroDeDocumento') && (
          <p className="mt-1.5 text-sm text-danger">{problemaDe('numeroDeDocumento')}</p>
        )}
      </div>

      <Campo etiqueta="Domicilio" problema={problemaDe('domicilio')}>
        <input
          className={`${CAMPO} h-13`}
          value={datos.domicilio}
          onChange={(evento) => onCambiar({ ...datos, domicilio: evento.target.value })}
          autoComplete="street-address"
        />
      </Campo>

      <Campo
        etiqueta="Teléfono de contacto / emergencias"
        problema={problemaDe('telefonoDeContacto')}
      >
        <input
          type="tel"
          className={`${CAMPO} h-13`}
          value={datos.telefonoDeContacto}
          onChange={(evento) => onCambiar({ ...datos, telefonoDeContacto: evento.target.value })}
          autoComplete="tel"
        />
      </Campo>
    </>
  )
}
