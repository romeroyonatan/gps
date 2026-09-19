// apps/web/src/main.tsx
import { almacenPorPersona, crearQueryClient, ProveedorDeApi, transporteHttp } from '@gps/api'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { del, get, set } from 'idb-keyval'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'

// IndexedDB, no localStorage: el cache va a crecer cuando lleguen los módulos reales.
// Partido por persona: ver almacenPorPersona.
const particion = almacenPorPersona({
  getItem: async (clave) => (await get(clave)) ?? null,
  setItem: async (clave, valor) => {
    await set(clave, valor)
  },
  removeItem: async (clave) => {
    await del(clave)
  },
})

const persister = createAsyncStoragePersister({ storage: particion.almacen, key: 'gps-cache' })

const raiz = document.getElementById('raiz')
if (!raiz) throw new Error('Falta el elemento #raiz en index.html')

createRoot(raiz).render(
  <StrictMode>
    <ProveedorDeApi
      transporte={transporteHttp('/graphql')}
      queryClient={crearQueryClient()}
      persister={persister}
    >
      <App particion={particion} />
    </ProveedorDeApi>
  </StrictMode>,
)
