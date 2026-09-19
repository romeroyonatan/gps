/** Con cuanta anticipacion pide la asociacion que se presente un permiso.
 *
 *  Es un catalogo y no una tabla por la misma razon que el calendario de
 *  afiliacion: cambia poquisimo y nadie lo consulta, asi que una tabla serian
 *  una migracion y una query para leer un numero.
 *
 *  El numero es provisorio: la asociacion todavia no lo confirmo. Por eso hoy
 *  solo avisa y no bloquea -ver avisoDeAnticipacion-: un numero inventado que
 *  impide presentar un permiso es peor que no tenerlo. */
export const DIAS_DE_ANTICIPACION = 15
