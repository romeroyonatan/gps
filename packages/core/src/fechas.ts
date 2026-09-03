/** La fecha de calendario de un instante, segun el almanaque de quien lo mira.
 *
 *  Componentes locales y no toISOString: en UTC-3 el 1 de mayo a las 22:00
 *  seria el 2 de mayo en UTC.
 *
 *  Vive en core y no en un modulo porque la necesitan varios -personas para
 *  validar el ingreso, estructura para saber si un grupo estaba abierto un dia,
 *  afiliacion para el periodo- y los modulos no se pueden importar entre si.
 *  Es la misma razon que Marcas.
 *
 *  Ojo con el archivo: va en su propio subpath y NO en src/index.ts. El indice
 *  es plomeria de servidor y arrastra drizzle-orm por aplicarMigraciones, que
 *  importa `sql` como valor; las apps importan esta funcion, asi que sacarla
 *  por el indice se los meteria en el bundle -y Metro no hace tree-shaking-.
 *  Los tipos (Marcas) no tienen el problema: se borran al compilar. */
export function aFechaDeCalendario(instante: Date): string {
  const mes = `${instante.getMonth() + 1}`.padStart(2, '0')
  const dia = `${instante.getDate()}`.padStart(2, '0')
  return `${instante.getFullYear()}-${mes}-${dia}`
}
