import { ErrorDeApi, useCambiarDeUnidad, useGrupo } from '@gps/api'
import { aFechaDeCalendario } from '@gps/core/fechas'
import { type Problema, validarCambioDeUnidad } from '@gps/personas/dominio'
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { TextInput, View } from 'react-native'
import { PantallaDePersona } from '../../../../../componentes/Persona'
import { Unidades } from '../../../../../componentes/Vinculos'
import { Boton, CAMPO, Campo, Falla, Titulo } from '../../../../../src/ui'

export default function Pantalla() {
  const { id, personaId } = useLocalSearchParams<{ id: string; personaId: string }>()
  const { grupo } = useGrupo(id)
  const cambiar = useCambiarDeUnidad()
  const ahora = new Date()
  const [unidadId, setUnidadId] = useState<string | null>(null)
  const [desde, setDesde] = useState(aFechaDeCalendario(ahora))
  const [problemas, setProblemas] = useState<readonly Problema[]>([])

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
        const unidades = grupo?.unidades ?? []
        const actual = unidades.find((una) => una.id === persona.pertenencia.unidadId)

        function enviar() {
          // El `unidadId` generado es opcional; el del dominio es
          // `string | null` a secas. Se normaliza sólo en esta frontera.
          const pertenencia = {
            ...persona.pertenencia,
            unidadId: persona.pertenencia.unidadId ?? null,
          }
          const encontrados = unidadId
            ? validarCambioDeUnidad(pertenencia, unidadId, desde, unidades, ahora)
            : [{ campo: 'unidad' as const, mensaje: 'Elegí la unidad a la que pasa.' }]
          setProblemas(encontrados)
          if (encontrados.length > 0 || !unidadId) return
          cambiar.mutate(
            { personaId: persona.id, unidadId, desde },
            { onSuccess: () => router.back() },
          )
        }

        return (
          <>
            <Titulo
              acompaña={`Hoy está en ${actual?.nombre ?? 'ninguna unidad'}, desde el ${persona.pertenencia.desde}. El cambio cierra esa pertenencia y abre una nueva: queda el historial.`}
            >
              Cambiar de rama
            </Titulo>

            <View className="mt-6 gap-5">
              <Unidades
                unidades={unidades}
                elegida={unidadId}
                onElegir={setUnidadId}
                problema={problemaDe('unidad')}
                etiqueta="Unidad nueva"
              />

              <Campo etiqueta="Desde" problema={problemaDe('desde')}>
                <TextInput
                  className={CAMPO}
                  placeholder="aaaa-mm-dd"
                  keyboardType="numbers-and-punctuation"
                  value={desde}
                  onChangeText={setDesde}
                />
              </Campo>

              {cambiar.isError && (
                <Falla>
                  {cambiar.error instanceof ErrorDeApi
                    ? cambiar.error.errores.join(' ')
                    : cambiar.error.message}
                </Falla>
              )}

              <Boton onPress={enviar} disabled={cambiar.isPending}>
                {cambiar.isPending ? 'Guardando…' : 'Pasar de rama'}
              </Boton>
            </View>
          </>
        )
      }}
    </PantallaDePersona>
  )
}
