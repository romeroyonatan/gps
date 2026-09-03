import { ErrorDeApi, useCrearPersona } from '@gps/api'
import { aFechaDeCalendario } from '@gps/core/fechas'
import { etiquetaDeEdades, type Rama, ramaDelCatalogo } from '@gps/estructura/dominio'
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
import { type ReactNode, useState } from 'react'
import { Pressable, Text, TextInput, View } from 'react-native'

const VACIO: DatosDePersona = {
  tipoDeDocumento: 'dni',
  numeroDeDocumento: '',
  nombres: '',
  apellidos: '',
  fechaDeNacimiento: '',
}

const CLASE_DE_INPUT = 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm'

function Campo(props: { etiqueta: string; problema?: string; children: ReactNode }) {
  return (
    <View>
      <Text className="text-xs font-medium text-slate-600">{props.etiqueta}</Text>
      <View className="mt-1">{props.children}</View>
      {props.problema && <Text className="mt-1 text-xs text-red-700">{props.problema}</Text>}
    </View>
  )
}

/** No hay <select> ni <checkbox> en React Native: una fila de Pressable que
 *  alternan estilo es el reemplazo para los cuatro catalogos de este formulario. */
function Opciones<T extends string>(props: {
  opciones: readonly { id: T; nombre: string }[]
  elegida: T | null
  onElegir: (id: T) => void
  deshabilitado?: boolean
}) {
  return (
    <View className="flex-row flex-wrap gap-1.5">
      {props.opciones.map((opcion) => {
        const activa = opcion.id === props.elegida
        return (
          <Pressable
            key={opcion.id}
            disabled={props.deshabilitado}
            onPress={() => props.onElegir(opcion.id)}
            className={`rounded-full px-3 py-1.5 ${activa ? 'bg-slate-900' : 'bg-slate-100'} ${
              props.deshabilitado ? 'opacity-40' : ''
            }`}
          >
            <Text className={`text-xs ${activa ? 'text-white' : 'text-slate-700'}`}>
              {opcion.nombre}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

export function AltaDePersona(props: { grupoId: string; ramasAbiertas: readonly Rama[] }) {
  const alta = useCrearPersona()
  const hoy = new Date()
  const vacio = (): DatosDeIngreso => ({
    grupoId: props.grupoId,
    categoria: 'beneficiario',
    rama: props.ramasAbiertas[0] ?? null,
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
    // Un adherente no pertenece a ninguna rama: limpiarla al cambiar evita que
    // el formulario quede en un estado que el dominio rechaza sin que se vea.
    setIngreso({
      ...ingreso,
      categoria,
      rama: categoria === 'adherente' ? null : (ingreso.rama ?? props.ramasAbiertas[0] ?? null),
    })
  }

  function enviar() {
    // Las mismas funciones puras que corre el servicio, y las mismas que corre
    // la web: una sola implementacion, que es el pago de que /dominio sea
    // isomorfo.
    const encontrados = [
      ...validarPersona(datos, hoy),
      ...validarIngreso(ingreso, props.ramasAbiertas, hoy),
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
        },
      },
    )
  }

  const ramasComoOpciones = props.ramasAbiertas.map((rama) => {
    const catalogo = ramaDelCatalogo(rama)
    return {
      id: rama,
      nombre: catalogo ? `${catalogo.nombre} ${etiquetaDeEdades(catalogo)}` : rama,
    }
  })

  return (
    <View className="mt-8 gap-3 rounded-lg bg-white p-4">
      <Text className="text-sm font-semibold text-slate-900">Agregar una persona</Text>

      <Campo etiqueta="Tipo de documento">
        <Opciones
          opciones={TIPOS_DE_DOCUMENTO}
          elegida={datos.tipoDeDocumento}
          onElegir={(tipo: TipoDeDocumento) => setDatos({ ...datos, tipoDeDocumento: tipo })}
        />
      </Campo>

      <Campo etiqueta="Número" problema={problemaDe('numeroDeDocumento')}>
        <TextInput
          className={CLASE_DE_INPUT}
          value={datos.numeroDeDocumento}
          onChangeText={(texto) => setDatos({ ...datos, numeroDeDocumento: texto })}
        />
      </Campo>

      <Campo etiqueta="Apellidos" problema={problemaDe('apellidos')}>
        <TextInput
          className={CLASE_DE_INPUT}
          value={datos.apellidos}
          onChangeText={(texto) => setDatos({ ...datos, apellidos: texto })}
        />
      </Campo>

      <Campo etiqueta="Nombres" problema={problemaDe('nombres')}>
        <TextInput
          className={CLASE_DE_INPUT}
          value={datos.nombres}
          onChangeText={(texto) => setDatos({ ...datos, nombres: texto })}
        />
      </Campo>

      {/* No hay <input type="date"> en React Native. El texto crudo alcanza
          porque validarPersona y validarIngreso rechazan lo que no sea una
          fecha real del almanaque: cambia la comodidad, no la garantia. */}
      <Campo etiqueta="Fecha de nacimiento" problema={problemaDe('fechaDeNacimiento')}>
        <TextInput
          className={CLASE_DE_INPUT}
          placeholder="aaaa-mm-dd"
          keyboardType="numbers-and-punctuation"
          value={datos.fechaDeNacimiento}
          onChangeText={(texto) => setDatos({ ...datos, fechaDeNacimiento: texto })}
        />
      </Campo>

      <Campo etiqueta="Categoría">
        <Opciones opciones={CATEGORIAS} elegida={ingreso.categoria} onElegir={cambiarCategoria} />
      </Campo>

      <Campo etiqueta="Rama" problema={problemaDe('rama')}>
        {/* Solo las ramas abiertas del grupo, y ninguna si es adherente: la
            misma regla que corre el servidor con estructura.obtenerGrupo. */}
        <Opciones
          opciones={ramasComoOpciones}
          elegida={ingreso.rama}
          deshabilitado={ingreso.categoria === 'adherente'}
          onElegir={(rama: Rama) => setIngreso({ ...ingreso, rama })}
        />
      </Campo>

      <Campo etiqueta="Ingresó el" problema={problemaDe('desde')}>
        <TextInput
          className={CLASE_DE_INPUT}
          placeholder="aaaa-mm-dd"
          keyboardType="numbers-and-punctuation"
          value={ingreso.desde}
          onChangeText={(texto) => setIngreso({ ...ingreso, desde: texto })}
        />
      </Campo>

      <Campo etiqueta="Cargos" problema={problemaDe('cargos')}>
        <View className="gap-2">
          {TIPOS_DE_CARGO.map((tipo) => {
            const elegido = cargoElegido(tipo.id)
            return (
              <View key={tipo.id} className="gap-1">
                <Pressable
                  onPress={() => alternarCargo(tipo.id)}
                  className={`self-start rounded-full px-3 py-1.5 ${
                    elegido ? 'bg-slate-900' : 'bg-slate-100'
                  }`}
                >
                  <Text className={`text-xs ${elegido ? 'text-white' : 'text-slate-700'}`}>
                    {tipo.nombre}
                  </Text>
                </Pressable>
                {elegido && (
                  <TextInput
                    className={CLASE_DE_INPUT}
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
                )}
              </View>
            )
          })}
        </View>
      </Campo>

      {alta.isError && (
        <View className="rounded-lg bg-red-50 p-3">
          <Text className="text-sm text-red-800">
            {alta.error instanceof ErrorDeApi ? alta.error.errores.join(' ') : alta.error.message}
          </Text>
        </View>
      )}

      <Pressable
        onPress={enviar}
        disabled={alta.isPending}
        className={`rounded-lg bg-slate-900 px-4 py-2 ${alta.isPending ? 'opacity-50' : ''}`}
      >
        <Text className="text-center text-sm font-medium text-white">
          {alta.isPending ? 'Guardando…' : 'Guardar'}
        </Text>
      </Pressable>
    </View>
  )
}
