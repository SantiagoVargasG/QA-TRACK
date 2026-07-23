import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import basicSsl from '@vitejs/plugin-basic-ssl'

// https://vite.dev/config/
export default defineConfig({
  // basicSsl genera un certificado autofirmado para desarrollo local: Google Chat reescribe
  // a https el link del botón "Abrir HU" de las cards, y Vite no servía HTTPS — sin esto
  // https://localhost:5173 no conectaba en absoluto (ver CLAUDE.md, sección de webhooks).
  plugins: [react(), tailwindcss(), basicSsl()],
  server: {
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
})
