const { colors, fontSize, variablesOscuras } = require('@gps/diseno/tailwind')

module.exports = {
  // `src/` va en la lista: ahí viven el ingreso, la barra de sesión y el
  // selector de rol, y una clase que Tailwind no lee no existe en la hoja.
  content: ['./app/**/*.{ts,tsx}', './componentes/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  darkMode: 'class',
  theme: { extend: { colors, fontSize } },
  // Ver `variablesOscuras`: sin esto el oscuro no se enciende en el teléfono.
  plugins: [variablesOscuras],
}
