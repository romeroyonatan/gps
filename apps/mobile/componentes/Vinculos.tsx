import { etiquetaDeEdades, ramaDelCatalogo, type Unidad } from '@gps/estructura/dominio'
import {
  ambitoDelCargo,
  type DatosDeCargo,
  TIPOS_DE_CARGO,
  type TipoDeCargo,
} from '@gps/personas/dominio'
import { Text, TextInput, View } from 'react-native'
import { CAMPO, Campo, Filtros } from '../src/ui'

export type UnidadAbierta = Pick<Unidad, 'id' | 'rama' | 'nombre' | 'sexo'>

/** Los cargos que una pantalla de grupo puede cargar: los de ámbito grupo y
 *  nada más. La gemela de `apps/web/src/pantallas/Vinculos.tsx`. */
export const CARGOS_DE_GRUPO = TIPOS_DE_CARGO.filter((tipo) => ambitoDelCargo(tipo.id) === 'grupo')

/** A qué unidad va. Sólo las unidades abiertas del grupo: la misma regla que
 *  corre el servidor con `estructura.obtenerGrupo`. */
export function Unidades(props: {
  unidades: readonly UnidadAbierta[]
  elegida: string | null
  onElegir: (unidadId: string) => void
  deshabilitado?: boolean
  problema?: string
  etiqueta?: string
}) {
  const opciones = props.unidades.map((unidad) => {
    const catalogo = ramaDelCatalogo(unidad.rama)
    return {
      id: unidad.id,
      etiqueta: catalogo ? `${unidad.nombre} ${etiquetaDeEdades(catalogo)}` : unidad.nombre,
    }
  })

  return (
    <Campo etiqueta={props.etiqueta ?? 'Unidad'} problema={props.problema}>
      <Filtros
        opciones={opciones}
        valor={props.elegida}
        deshabilitado={props.deshabilitado}
        onElegir={props.onElegir}
      />
    </Campo>
  )
}

/** Qué cargos tiene, con su fin de mandato opcional. Los usa el alta y el
 *  detalle de una persona.
 *
 *  `ocupados` son los que ya tiene vigentes: el detalle los saca de la lista
 *  porque ahí se quitan con la × de su `Etiqueta`. */
export function Cargos(props: {
  elegidos: readonly DatosDeCargo[]
  onCambiar: (cargos: readonly DatosDeCargo[]) => void
  ocupados?: readonly TipoDeCargo[]
  problema?: string
}) {
  const disponibles = CARGOS_DE_GRUPO.filter((tipo) => !props.ocupados?.includes(tipo.id))
  const elegido = (cargo: TipoDeCargo) => props.elegidos.find((uno) => uno.cargo === cargo)

  function alternar(cargo: TipoDeCargo) {
    props.onCambiar(
      elegido(cargo)
        ? props.elegidos.filter((uno) => uno.cargo !== cargo)
        : [...props.elegidos, { cargo, hasta: null }],
    )
  }

  return (
    <Campo etiqueta="Cargos" problema={props.problema}>
      <View className="gap-2">
        <Filtros
          opciones={disponibles.map((tipo) => ({ id: tipo.id, etiqueta: tipo.nombre }))}
          // Los cargos se combinan: se puede tener más de uno, así que van
          // todos los prendidos y no uno solo.
          valor={props.elegidos.map((uno) => uno.cargo)}
          onElegir={alternar}
        />
        {disponibles.map((tipo) => {
          const puesto = elegido(tipo.id)
          if (!puesto) return null
          return (
            <View key={tipo.id} className="gap-1">
              <Text className="text-label text-ink-muted">{tipo.nombre}</Text>
              <TextInput
                className={CAMPO}
                placeholder="hasta (aaaa-mm-dd), vacío si no tiene fin"
                keyboardType="numbers-and-punctuation"
                value={puesto.hasta ?? ''}
                onChangeText={(texto) =>
                  props.onCambiar(
                    props.elegidos.map((uno) =>
                      uno.cargo === tipo.id ? { ...uno, hasta: texto || null } : uno,
                    ),
                  )
                }
              />
            </View>
          )
        })}
      </View>
    </Campo>
  )
}
