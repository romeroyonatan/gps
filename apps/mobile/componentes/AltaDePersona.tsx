import { ErrorDeApi, useCrearPersona } from '@gps/api'
import { aFechaDeCalendario } from '@gps/core/fechas'
import { etiquetaDeEdades, ramaDelCatalogo, type Unidad } from '@gps/estructura/dominio'
import {
  CATEGORIAS,
  type Categoria,
  type DatosDeIngreso,
  type DatosDePersona,
  type Problema,
  TIPOS_DE_CARGO,
  TIPOS_DE_DOCUMENTO,
  type TipoDeCargo,
  type TipoDeDocumento,
  validarIngreso,
  validarPersona,
} from '@gps/personas/dominio'
import { useState } from 'react'
import { Text, TextInput, View } from 'react-native'
import { Boton, CAMPO, Campo, Falla, Filtros } from '../src/ui'

const VACIO: DatosDePersona = {
  tipoDeDocumento: 'dni',
  numeroDeDocumento: '',
  nombres: '',
  apellidos: '',
  fechaDeNacimiento: '',
  domicilio: '',
  telefonoDeContacto: '',
}

export function AltaDePersona(props: {
  grupoId: string
  unidadesAbiertas: readonly Pick<Unidad, 'id' | 'rama' | 'nombre' | 'sexo'>[]
  /** Qué hacer cuando el alta salió bien. La pantalla vuelve al padrón: la
   *  lista recién cargada es la confirmación de que salió. */
  alGuardar?: () => void
}) {
  const alta = useCrearPersona()
  const hoy = new Date()
  const vacio = (): DatosDeIngreso => ({
    grupoId: props.grupoId,
    categoria: 'beneficiario',
    unidadId: props.unidadesAbiertas[0]?.id ?? null,
    desde: aFechaDeCalendario(hoy),
    cargos: [],
  })

  const [datos, setDatos] = useState<DatosDePersona>(VACIO)
  const [ingreso, setIngreso] = useState<DatosDeIngreso>(vacio)
  const [problemas, setProblemas] = useState<readonly Problema[]>([])

  const problemaDe = (campo: Problema['campo']) =>
    problemas.find((problema) => problema.campo === campo)?.mensaje

  const cargoElegido = (cargo: TipoDeCargo) =>
    ingreso.cargos.find((elegido) => elegido.cargo === cargo)

  function alternarCargo(cargo: TipoDeCargo) {
    setIngreso({
      ...ingreso,
      cargos: cargoElegido(cargo)
        ? ingreso.cargos.filter((elegido) => elegido.cargo !== cargo)
        : [...ingreso.cargos, { cargo, hasta: null }],
    })
  }

  function cambiarCategoria(categoria: Categoria) {
    // Un adherente no pertenece a ninguna unidad: limpiarla al cambiar evita que
    // el formulario quede en un estado que el dominio rechaza sin que se vea.
    setIngreso({
      ...ingreso,
      categoria,
      unidadId:
        categoria === 'adherente'
          ? null
          : (ingreso.unidadId ?? props.unidadesAbiertas[0]?.id ?? null),
    })
  }

  function enviar() {
    // Las mismas funciones puras que corre el servicio, y las mismas que corre
    // la web: una sola implementacion, que es el pago de que /dominio sea
    // isomorfo.
    const encontrados = [
      ...validarPersona(datos, hoy),
      ...validarIngreso(ingreso, props.unidadesAbiertas, hoy),
    ]
    setProblemas(encontrados)
    if (encontrados.length > 0) return
    alta.mutate(
      // El tipo generado del input quiere cargos mutable; el del dominio es
      // readonly a proposito, asi que se copia solo en esta frontera.
      { datos, ingreso: { ...ingreso, cargos: [...ingreso.cargos] } },
      {
        onSuccess: () => {
          setDatos(VACIO)
          setIngreso(vacio())
          props.alGuardar?.()
        },
      },
    )
  }

  const unidadesComoOpciones = props.unidadesAbiertas.map((unidad) => {
    const catalogo = ramaDelCatalogo(unidad.rama)
    return {
      id: unidad.id,
      etiqueta: catalogo ? `${unidad.nombre} ${etiquetaDeEdades(catalogo)}` : unidad.nombre,
    }
  })

  return (
    <View className="mt-6 gap-5">
      <Campo etiqueta="Tipo de documento">
        <Filtros
          opciones={TIPOS_DE_DOCUMENTO.map((uno) => ({ id: uno.id, etiqueta: uno.nombre }))}
          valor={datos.tipoDeDocumento}
          onElegir={(tipo: TipoDeDocumento) => setDatos({ ...datos, tipoDeDocumento: tipo })}
        />
      </Campo>

      <Campo etiqueta="Número" problema={problemaDe('numeroDeDocumento')}>
        <TextInput
          className={CAMPO}
          keyboardType="number-pad"
          value={datos.numeroDeDocumento}
          onChangeText={(texto) => setDatos({ ...datos, numeroDeDocumento: texto })}
        />
      </Campo>

      <Campo etiqueta="Apellidos" problema={problemaDe('apellidos')}>
        <TextInput
          className={CAMPO}
          value={datos.apellidos}
          onChangeText={(texto) => setDatos({ ...datos, apellidos: texto })}
        />
      </Campo>

      <Campo etiqueta="Nombres" problema={problemaDe('nombres')}>
        <TextInput
          className={CAMPO}
          value={datos.nombres}
          onChangeText={(texto) => setDatos({ ...datos, nombres: texto })}
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
          onChangeText={(texto) => setDatos({ ...datos, fechaDeNacimiento: texto })}
        />
      </Campo>

      <Campo etiqueta="Domicilio" problema={problemaDe('domicilio')}>
        <TextInput
          className={CAMPO}
          value={datos.domicilio}
          onChangeText={(domicilio) => setDatos({ ...datos, domicilio })}
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
          onChangeText={(telefonoDeContacto) => setDatos({ ...datos, telefonoDeContacto })}
          keyboardType="phone-pad"
          autoComplete="tel"
        />
      </Campo>

      <Campo etiqueta="Categoría">
        <Filtros
          opciones={CATEGORIAS.map((una) => ({ id: una.id, etiqueta: una.nombre }))}
          valor={ingreso.categoria}
          onElegir={cambiarCategoria}
        />
      </Campo>

      <Campo etiqueta="Unidad" problema={problemaDe('unidad')}>
        {/* Solo las unidades abiertas del grupo, y ninguna si es adherente: la
            misma regla que corre el servidor con estructura.obtenerGrupo. */}
        <Filtros
          opciones={unidadesComoOpciones}
          valor={ingreso.unidadId}
          deshabilitado={ingreso.categoria === 'adherente'}
          onElegir={(unidadId: string) => setIngreso({ ...ingreso, unidadId })}
        />
      </Campo>

      <Campo etiqueta="Ingresó el" problema={problemaDe('desde')}>
        <TextInput
          className={CAMPO}
          placeholder="aaaa-mm-dd"
          keyboardType="numbers-and-punctuation"
          value={ingreso.desde}
          onChangeText={(texto) => setIngreso({ ...ingreso, desde: texto })}
        />
      </Campo>

      <Campo etiqueta="Cargos" problema={problemaDe('cargos')}>
        <View className="gap-2">
          <Filtros
            opciones={TIPOS_DE_CARGO.map((tipo) => ({ id: tipo.id, etiqueta: tipo.nombre }))}
            // Los cargos se combinan: se puede tener más de uno, así que van
            // todos los prendidos y no uno solo.
            valor={ingreso.cargos.map((elegido) => elegido.cargo)}
            onElegir={alternarCargo}
          />
          {TIPOS_DE_CARGO.map((tipo) => {
            const elegido = cargoElegido(tipo.id)
            if (!elegido) return null
            return (
              <View key={tipo.id} className="gap-1">
                <Text className="text-label text-ink-muted">{tipo.nombre}</Text>
                <TextInput
                  className={CAMPO}
                  placeholder="hasta (aaaa-mm-dd), vacío si no tiene fin"
                  keyboardType="numbers-and-punctuation"
                  value={elegido.hasta ?? ''}
                  onChangeText={(texto) =>
                    setIngreso({
                      ...ingreso,
                      cargos: ingreso.cargos.map((otro) =>
                        otro.cargo === tipo.id ? { ...otro, hasta: texto || null } : otro,
                      ),
                    })
                  }
                />
              </View>
            )
          })}
        </View>
      </Campo>

      {alta.isError && (
        <Falla>
          {alta.error instanceof ErrorDeApi ? alta.error.errores.join(' ') : alta.error.message}
        </Falla>
      )}

      <Boton onPress={enviar} disabled={alta.isPending}>
        {alta.isPending ? 'Guardando…' : 'Guardar'}
      </Boton>
    </View>
  )
}
