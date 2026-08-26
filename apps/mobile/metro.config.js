const { getDefaultConfig } = require('expo/metro-config')
const { withNativeWind } = require('nativewind/metro')

// NOTA: no se fija watchFolders/resolver.nodeModulesPaths/disableHierarchicalLookup
// a mano. Esa receta es la de "Antes de SDK 52" (ver la guia de monorepos de Expo);
// desde SDK 52, getDefaultConfig ya detecta el monorepo solo y calcula estos mismos
// valores (verificado: coincide con lo que se hubiera puesto a mano). Probado en
// este proyecto: forzar disableHierarchicalLookup = true rompe la resolucion de
// dependencias que quedan anidadas mas adentro del store aislado de Bun (por
// ejemplo "whatwg-fetch", una dependencia transitiva de @expo/metro-runtime);
// con el valor por defecto (false) esas dependencias sí se resuelven, y @gps/api
// (que sí vive en watchFolders porque es un paquete del workspace) también.
// unstable_enablePackageExports ya viene en true por defecto, que es lo que
// necesita @gps/api al exportar TypeScript sin compilar via "exports" en su
// package.json.
const config = getDefaultConfig(__dirname)

module.exports = withNativeWind(config, { input: './global.css' })
