import {
  type DatosDePersona,
  type Problema,
  TIPOS_DE_DOCUMENTO,
  type TipoDeDocumento,
} from '@gps/personas/dominio'
import { TextInput } from 'react-native'
import { CAMPO, Campo, Filtros } from '../src/ui'

/** Los datos personales de alguien, en el mismo orden y con los mismos
 *  controles en el alta y en la corrección. Es la gemela de
 *  `apps/web/src/pantallas/DatosPersonales.tsx`: mismos campos, mismo orden,
 *  otro markup.
 *
 *  No trae botón ni sabe guardar: cada pantalla pone el suyo, porque una da de
 *  alta y la otra corrige. */
export function DatosPersonales(props: {
  datos: DatosDePersona
  onCambiar: (datos: DatosDePersona) => void
  problemaDe: (campo: Problema['campo']) => string | undefined
}) {
  const { datos, onCambiar, problemaDe } = props

  return (
    <>
      <Campo etiqueta="Tipo de documento">
        <Filtros
          opciones={TIPOS_DE_DOCUMENTO.map((uno) => ({ id: uno.id, etiqueta: uno.nombre }))}
          valor={datos.tipoDeDocumento}
          onElegir={(tipo: TipoDeDocumento) => onCambiar({ ...datos, tipoDeDocumento: tipo })}
        />
      </Campo>

      <Campo etiqueta="Número" problema={problemaDe('numeroDeDocumento')}>
        <TextInput
          className={CAMPO}
          keyboardType="number-pad"
          value={datos.numeroDeDocumento}
          onChangeText={(numeroDeDocumento) => onCambiar({ ...datos, numeroDeDocumento })}
        />
      </Campo>

      <Campo etiqueta="Apellidos" problema={problemaDe('apellidos')}>
        <TextInput
          className={CAMPO}
          value={datos.apellidos}
          onChangeText={(apellidos) => onCambiar({ ...datos, apellidos })}
        />
      </Campo>

      <Campo etiqueta="Nombres" problema={problemaDe('nombres')}>
        <TextInput
          className={CAMPO}
          value={datos.nombres}
          onChangeText={(nombres) => onCambiar({ ...datos, nombres })}
        />
      </Campo>

      {/* No hay <input type="date"> en React Native. El texto crudo alcanza
          porque validarPersona y validarIngreso rechazan lo que no sea una
          fecha real del almanaque: cambia la comodidad, no la garantia. */}
      <Campo etiqueta="Fecha de nacimiento" problema={problemaDe('fechaDeNacimiento')}>
        <TextInput
          className={CAMPO}
          placeholder="aaaa-mm-dd"
          keyboardType="numbers-and-punctuation"
          value={datos.fechaDeNacimiento}
          onChangeText={(fechaDeNacimiento) => onCambiar({ ...datos, fechaDeNacimiento })}
        />
      </Campo>

      <Campo etiqueta="Domicilio" problema={problemaDe('domicilio')}>
        <TextInput
          className={CAMPO}
          value={datos.domicilio}
          onChangeText={(domicilio) => onCambiar({ ...datos, domicilio })}
          autoComplete="street-address"
        />
      </Campo>

      <Campo
        etiqueta="Teléfono de contacto / emergencias"
        problema={problemaDe('telefonoDeContacto')}
      >
        <TextInput
          className={CAMPO}
          value={datos.telefonoDeContacto}
          onChangeText={(telefonoDeContacto) => onCambiar({ ...datos, telefonoDeContacto })}
          keyboardType="phone-pad"
          autoComplete="tel"
        />
      </Campo>
    </>
  )
}
