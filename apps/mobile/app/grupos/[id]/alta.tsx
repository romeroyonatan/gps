import { useGrupo } from '@gps/api'
import { router, useLocalSearchParams } from 'expo-router'
import { AltaDePersona } from '../../../componentes/AltaDePersona'
import { Cargando, Marco, Titulo, Vacio, Volver } from '../../../src/ui'

/** El alta es una tarea que termina, así que tiene pantalla propia y no cuelga
 *  de la nómina: al guardar, vuelve a la lista, que recién cargada es la
 *  confirmación de que salió bien. */
export default function Pantalla() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { grupo, isPending } = useGrupo(id)

  return (
    <Marco keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      <Volver href={`/grupos/${id}/nomina`}>Nómina</Volver>
      <Titulo acompaña="El alta registra la pertenencia desde una fecha. No afilia: la afiliación se cobra en la próxima declaración.">
        Alta de persona
      </Titulo>

      {isPending && <Cargando>Consultando el grupo…</Cargando>}
      {!grupo && !isPending && <Vacio>No hay ningún grupo abierto con esa dirección.</Vacio>}

      {grupo && (
        <AltaDePersona
          grupoId={id}
          unidadesAbiertas={grupo.unidades}
          alGuardar={() => router.back()}
        />
      )}
    </Marco>
  )
}
