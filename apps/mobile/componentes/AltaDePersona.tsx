import { ErrorDeApi, useCrearPersona } from '@gps/api'
import { aFechaDeCalendario } from '@gps/core/fechas'
import {
  CATEGORIAS,
  type Categoria,
  type DatosDeIngreso,
  type DatosDePersona,
  type Problema,
  validarIngreso,
  validarPersona,
} from '@gps/personas/dominio'
import { useState } from 'react'
import { TextInput, View } from 'react-native'
import { Boton, CAMPO, Campo, Falla, Filtros } from '../src/ui'
import { DatosPersonales } from './DatosPersonales'
import { Cargos, type UnidadAbierta, Unidades } from './Vinculos'

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
  unidadesAbiertas: readonly UnidadAbierta[]
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

  return (
    <View className="mt-6 gap-5">
      <DatosPersonales datos={datos} onCambiar={setDatos} problemaDe={problemaDe} />

      <Campo etiqueta="Categoría">
        <Filtros
          opciones={CATEGORIAS.map((una) => ({ id: una.id, etiqueta: una.nombre }))}
          valor={ingreso.categoria}
          onElegir={cambiarCategoria}
        />
      </Campo>

      <Unidades
        unidades={props.unidadesAbiertas}
        elegida={ingreso.unidadId}
        deshabilitado={ingreso.categoria === 'adherente'}
        onElegir={(unidadId: string) => setIngreso({ ...ingreso, unidadId })}
        problema={problemaDe('unidad')}
      />

      <Campo etiqueta="Ingresó el" problema={problemaDe('desde')}>
        <TextInput
          className={CAMPO}
          placeholder="aaaa-mm-dd"
          keyboardType="numbers-and-punctuation"
          value={ingreso.desde}
          onChangeText={(texto) => setIngreso({ ...ingreso, desde: texto })}
        />
      </Campo>

      <Cargos
        elegidos={ingreso.cargos}
        onCambiar={(cargos) => setIngreso({ ...ingreso, cargos })}
        problema={problemaDe('cargos')}
      />

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
