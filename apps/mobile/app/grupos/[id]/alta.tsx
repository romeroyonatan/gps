import { useDistritos } from '@gps/api'
import { router, useLocalSearchParams } from 'expo-router'
import { ScrollView } from 'react-native'
import { AltaDePersona } from '../../../componentes/AltaDePersona'
import { Cargando, Titulo, Vacio, Volver } from '../../../src/ui'

/** El alta es una tarea que termina, así que tiene pantalla propia y no cuelga
 *  del padrón: al guardar, vuelve a la lista, que recién cargada es la
 *  confirmación de que salió bien. */
export default function Pantalla() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const arbol = useDistritos()
  const grupo = arbol.data?.distritos
    .flatMap((distrito) => distrito.grupos)
    .find((candidato) => candidato.id === id)

  return (
    <ScrollView className="flex-1 bg-surface" contentContainerClassName="px-4 pb-10">
      <Volver href={`/grupos/${id}/padron`}>Padrón</Volver>
      <Titulo acompaña="El alta registra la pertenencia desde una fecha. No afilia: la afiliación se cobra en la próxima declaración.">
        Alta de persona
      </Titulo>

      {arbol.isPending && <Cargando>Consultando el grupo…</Cargando>}
      {!grupo && !arbol.isPending && <Vacio>No hay ningún grupo abierto con esa dirección.</Vacio>}

      {grupo && (
        <AltaDePersona
          grupoId={id}
          unidadesAbiertas={grupo.unidades}
          alGuardar={() => router.back()}
        />
      )}
    </ScrollView>
  )
}
