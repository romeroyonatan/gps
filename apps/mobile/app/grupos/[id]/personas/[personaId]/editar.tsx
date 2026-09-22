import { ErrorDeApi, useEditarPersona } from '@gps/api'
import { type DatosDePersona, type Problema, validarPersona } from '@gps/personas/dominio'
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'
import { DatosPersonales } from '../../../../../componentes/DatosPersonales'
import { PantallaDePersona } from '../../../../../componentes/Persona'
import { Boton, Falla, Titulo } from '../../../../../src/ui'

export default function Pantalla() {
  const { id, personaId } = useLocalSearchParams<{ id: string; personaId: string }>()
  const editar = useEditarPersona()
  const [datos, setDatos] = useState<DatosDePersona | null>(null)
  const [problemas, setProblemas] = useState<readonly Problema[]>([])
  const hoy = new Date()

  const problemaDe = (campo: Problema['campo']) =>
    problemas.find((problema) => problema.campo === campo)?.mensaje

  return (
    <PantallaDePersona
      grupoId={id}
      personaId={personaId}
      volverA={`/grupos/${id}/personas/${personaId}`}
      volverTexto="Persona"
    >
      {(persona) => {
        // La primera vez el formulario arranca con lo que hay guardado.
        const valor: DatosDePersona = datos ?? {
          tipoDeDocumento: persona.tipoDeDocumento,
          numeroDeDocumento: persona.numeroDeDocumento,
          nombres: persona.nombres,
          apellidos: persona.apellidos,
          fechaDeNacimiento: persona.fechaDeNacimiento,
          domicilio: persona.domicilio,
          telefonoDeContacto: persona.telefonoDeContacto,
        }

        function enviar() {
          // La misma función pura que corre el servicio antes de guardar.
          const encontrados = validarPersona(valor, hoy)
          setProblemas(encontrados)
          if (encontrados.length > 0) return
          editar.mutate({ personaId: persona.id, datos: valor }, { onSuccess: () => router.back() })
        }

        return (
          <>
            <Titulo acompaña="Sólo los datos personales. La unidad y los cargos se cambian desde la persona.">
              Corregir datos
            </Titulo>

            <View className="mt-6 gap-5">
              <DatosPersonales datos={valor} onCambiar={setDatos} problemaDe={problemaDe} />

              {editar.isError && (
                <Falla>
                  {editar.error instanceof ErrorDeApi
                    ? editar.error.errores.join(' ')
                    : editar.error.message}
                </Falla>
              )}

              <Boton onPress={enviar} disabled={editar.isPending}>
                {editar.isPending ? 'Guardando…' : 'Guardar cambios'}
              </Boton>
            </View>
          </>
        )
      }}
    </PantallaDePersona>
  )
}
