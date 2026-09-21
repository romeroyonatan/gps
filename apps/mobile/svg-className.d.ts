// `cssInterop` le enseña a `Path` a leer `className` (ver src/ui.tsx), pero eso
// pasa en tiempo de ejecución: el tipo hay que ensancharlo acá. El import vacío
// es lo que hace de este archivo un módulo, y sin eso `declare module` no
// ensancharía react-native-svg sino que lo reemplazaría.
import 'react-native-svg'

declare module 'react-native-svg' {
  interface PathProps {
    className?: string
  }
}
