import {
  useActor,
  useAsignarCargo,
  useGrupo,
  useIntegrarEquipo,
  useRevocarCargo,
  useRevocarIntegranteDeEquipo,
} from '@gps/api'
import { aFechaDeCalendario } from '@gps/core/fechas'
import {
  calcularEdad,
  type DatosDeCargo,
  estaVigente,
  nombreCompleto,
  nombreDelCargo,
  nombreDelTipo,
  paraMarcar,
  puedeAdministrarPlantelDeGrupo,
  puedeCambiarDeUnidad,
  TIPOS_DE_EQUIPO,
} from '@gps/personas/dominio'
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { Linking, Text, View } from 'react-native'
import { Dato, PantallaDePersona } from '../../../../../componentes/Persona'
import { Cargos } from '../../../../../componentes/Vinculos'
import {
  AccionAlMargen,
  BotonSecundario,
  Chip,
  ChipDeRama,
  Etiqueta,
  Falla,
  Nota,
  Seccion,
  Titulo,
} from '../../../../../src/ui'

const SECRETARIA = 'secretaria'

/** El `hasta` generado es opcional; el del dominio es `string | null` a secas.
 *  Se normaliza sólo en esta frontera. */
const vigente = (periodo: { desde: string; hasta?: string | null }, hoy: Date) =>
  estaVigente({ desde: periodo.desde, hasta: periodo.hasta ?? null }, hoy)

export default function Pantalla() {
  const { id, personaId } = useLocalSearchParams<{ id: string; personaId: string }>()
  const { grupo } = useGrupo(id)
  const actor = useActor()
  const asignar = useAsignarCargo()
  const revocarCargo = useRevocarCargo()
  const integrar = useIntegrarEquipo()
  const revocarEquipo = useRevocarIntegranteDeEquipo()
  const [agregando, agregar] = useState(false)
  const [nuevos, setNuevos] = useState<readonly DatosDeCargo[]>([])
  const [conSecretaria, setConSecretaria] = useState(false)

  const ahora = new Date()
  const hoy = aFechaDeCalendario(ahora)
  // La misma función pura que aplica el servidor: la pantalla no ofrece lo que
  // después se va a rechazar.
  const puede = actor !== null && puedeAdministrarPlantelDeGrupo(actor, id)

  return (
    <PantallaDePersona
      grupoId={id}
      personaId={personaId}
      volverA={`/grupos/${id}/nomina`}
      volverTexto="Nómina"
    >
      {(persona) => {
        const unidad = grupo?.unidades.find((una) => una.id === persona.pertenencia.unidadId)
        const cargos = persona.cargos.filter((cargo) => vigente(cargo, ahora))
        const equipos = persona.equipos.filter((equipo) => vigente(equipo, ahora))
        const secretaria = equipos.find((equipo) => equipo.tipo === SECRETARIA)
        const errores = [asignar.error, revocarCargo.error, integrar.error, revocarEquipo.error]

        async function guardarCargos() {
          for (const cargo of nuevos) {
            await asignar.mutateAsync({
              personaId: persona.id,
              cargo: cargo.cargo,
              ambitoId: id,
              desde: hoy,
              hasta: cargo.hasta,
            })
          }
          if (conSecretaria) {
            await integrar.mutateAsync({
              personaId: persona.id,
              tipo: SECRETARIA,
              ambitoId: id,
              desde: hoy,
            })
          }
          setNuevos([])
          setConSecretaria(false)
          agregar(false)
        }

        return (
          <>
            <Titulo>{nombreCompleto(persona)}</Titulo>
            <View className="mt-2 flex-row flex-wrap items-center gap-2">
              {unidad && <ChipDeRama rama={unidad.rama} />}
              <Chip>
                {persona.pertenencia.categoria === 'activo' ? 'Dirigente' : 'Beneficiario'}
              </Chip>
            </View>

            <Seccion
              titulo="Datos personales"
              enlace={
                puede
                  ? { texto: 'Editar', href: `/grupos/${id}/personas/${persona.id}/editar` }
                  : undefined
              }
            >
              <View className="mt-2">
                <Dato nombre="Documento">
                  {nombreDelTipo(persona.tipoDeDocumento)} {persona.numeroDeDocumento}
                </Dato>
                <Dato nombre="Nacimiento">
                  {persona.fechaDeNacimiento} · {calcularEdad(persona.fechaDeNacimiento, ahora)}{' '}
                  años
                </Dato>
                <Dato nombre="Domicilio">{persona.domicilio}</Dato>
                {/* Tocarlo llama: en el teléfono es el uso que tiene. La misma
                    fila que en la web, donde es un enlace `tel:`. */}
                <Dato
                  nombre="Teléfono"
                  onPress={() => {
                    void Linking.openURL(`tel:${paraMarcar(persona.telefonoDeContacto)}`)
                  }}
                >
                  {persona.telefonoDeContacto}
                </Dato>
              </View>
            </Seccion>

            <Seccion titulo="Pertenencia">
              <View className="mt-2">
                <Dato nombre="Unidad">{unidad ? unidad.nombre : 'Sin unidad'}</Dato>
                {/* "En la unidad" y no "en el grupo": un cambio de rama cierra
                    la pertenencia y abre otra. */}
                <Dato nombre="En la unidad desde">{persona.pertenencia.desde}</Dato>
              </View>
              {puede && puedeCambiarDeUnidad(persona.pertenencia) && (
                <View className="mt-3">
                  <BotonSecundario
                    onPress={() => router.push(`/grupos/${id}/personas/${persona.id}/rama`)}
                  >
                    Cambiar de rama
                  </BotonSecundario>
                </View>
              )}
              {puede && !puedeCambiarDeUnidad(persona.pertenencia) && (
                <Nota>
                  El pase de rama de un beneficiario es una ceremonia, y todavía no tiene pantalla.
                </Nota>
              )}
            </Seccion>

            <Seccion titulo="Cargos y equipos" cuantos={cargos.length + equipos.length}>
              <View className="mt-2 flex-row flex-wrap items-center gap-1.5">
                {cargos.map((cargo) => (
                  <Etiqueta
                    key={cargo.id}
                    onQuitar={puede ? () => revocarCargo.mutate({ cargoId: cargo.id }) : undefined}
                    quitando={revocarCargo.isPending}
                  >
                    {nombreDelCargo(cargo.cargo)}
                    {cargo.hasta ? ` · hasta ${cargo.hasta}` : ''}
                  </Etiqueta>
                ))}
                {equipos.map((equipo) => (
                  <Etiqueta
                    key={equipo.id}
                    onQuitar={
                      puede && equipo.tipo === SECRETARIA
                        ? () => revocarEquipo.mutate({ integranteId: equipo.id })
                        : undefined
                    }
                    quitando={revocarEquipo.isPending}
                  >
                    {TIPOS_DE_EQUIPO.find((uno) => uno.id === equipo.tipo)?.nombre ?? equipo.tipo}
                  </Etiqueta>
                ))}
                {cargos.length + equipos.length === 0 && (
                  <Text className="text-sm text-ink-muted">Sin cargos ni equipos.</Text>
                )}
              </View>

              {puede && !agregando && (
                <AccionAlMargen onPress={() => agregar(true)}>+ Agregar cargo</AccionAlMargen>
              )}

              {puede && agregando && (
                <View className="mt-3 gap-3 rounded-lg bg-surface-3 p-3.5">
                  <Cargos
                    elegidos={nuevos}
                    onCambiar={setNuevos}
                    ocupados={cargos.map((cargo) => cargo.cargo)}
                  />
                  {/* Un equipo no tiene mandato: integrarEquipo no recibe fecha
                      de fin, así que Secretaría va sin "hasta". */}
                  {!secretaria && (
                    <AccionAlMargen onPress={() => setConSecretaria(!conSecretaria)}>
                      {conSecretaria ? '✓ Secretaría' : '+ Secretaría'}
                    </AccionAlMargen>
                  )}
                  <BotonSecundario
                    onPress={guardarCargos}
                    disabled={asignar.isPending || integrar.isPending}
                  >
                    {asignar.isPending || integrar.isPending ? 'Guardando…' : 'Guardar cargos'}
                  </BotonSecundario>
                </View>
              )}

              {/* Cada cargo se asigna por separado: si uno falla, los anteriores
                  ya quedaron. El mensaje dice cuál. */}
              {errores.map(
                (problema) => problema && <Falla key={problema.message}>{problema.message}</Falla>,
              )}
            </Seccion>
          </>
        )
      }}
    </PantallaDePersona>
  )
}
