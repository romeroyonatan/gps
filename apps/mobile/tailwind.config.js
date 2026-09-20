const { colors, fontSize } = require('@gps/diseno/tailwind')

module.exports = {
  content: ['./app/**/*.{ts,tsx}', './componentes/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  darkMode: 'class',
  theme: { extend: { colors, fontSize } },
  plugins: [],
}
