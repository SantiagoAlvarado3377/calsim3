import { randomBytes } from 'node:crypto'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig(({ command }) => {
  if (command === 'build') return { base: './', plugins: [react()] }

  // Vite adds the nonce to the inline React refresh script during development.
  const nonce = randomBytes(16).toString('base64')
  return {
    base: './',
    html: { cspNonce: nonce },
    plugins: [react(), {
      name: 'calsim-development-csp',
      transformIndexHtml(html) {
        return html.replace("script-src 'self';", `script-src 'self' 'nonce-${nonce}';`)
      },
    }],
  }
})
