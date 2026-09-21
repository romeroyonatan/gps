import { Stack } from 'expo-router'

/** Las pantallas del grupo son una pila y no pestañas: el menú de tareas vive
 *  en la cáscara de la app —lo dibuja `app/_layout.tsx` para todo el rol, no
 *  sólo para estas cinco rutas—, así que acá no queda nada que declarar más
 *  que el apilado. */
export default function Layout() {
  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}
    />
  )
}
