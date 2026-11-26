// The examples, served so that a phone on the same Wi-Fi can open them with WebGPU: `npm run
// dev:phone`.
//
// A browser gives WebGPU only to pages on https or on localhost. `npm run dev` is on http: from
// the phone, at http://192.168.x.x:5173, there is no navigator.gpu, and every demo says "no WebGPU
// here". This script makes a certificate for this computer's addresses, signed by nobody (a
// self-signed certificate), keeps it in .cert/, which git ignores, and starts the same server on
// https. The phone warns that it does not know who signed it: in Safari, "Show Details", then
// "visit this website". Once is enough for each address.

import { execFileSync, spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { networkInterfaces } from 'node:os'

const root = new URL('..', import.meta.url)
const folder = new URL('.cert/', root)
const key = new URL('key.pem', folder)
const cert = new URL('cert.pem', folder)
const made = new URL('addresses.txt', folder) // the addresses the certificate was made for

// This computer's addresses on its networks: the phone opens one of them.
const addresses = Object.values(networkInterfaces())
  .flat()
  .filter((each) => each && each.family === 'IPv4' && !each.internal)
  .map((each) => each.address)
  .sort()

// A certificate names the addresses it is for: a new one when they change.
const wanted = addresses.join(' ')
if (!existsSync(cert) || !existsSync(made) || readFileSync(made, 'utf8') !== wanted) {
  mkdirSync(folder, { recursive: true })
  const config = new URL('openssl.cnf', folder)
  writeFileSync(
    config,
    [
      '[req]',
      'distinguished_name = name',
      'x509_extensions = extensions',
      'prompt = no',
      '[name]',
      'CN = FORCE dev server',
      '[extensions]',
      'basicConstraints = CA:FALSE',
      'keyUsage = digitalSignature, keyEncipherment',
      'extendedKeyUsage = serverAuth',
      `subjectAltName = DNS:localhost, IP:127.0.0.1${addresses.map((a) => `, IP:${a}`).join('')}`,
    ].join('\n'),
  )
  execFileSync(
    'openssl',
    // 397 days: more, and Safari refuses the certificate whatever the user says
    ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-sha256', '-days', '397'].concat([
      '-keyout',
      key.pathname,
      '-out',
      cert.pathname,
      '-config',
      config.pathname,
    ]),
    { stdio: 'ignore' },
  )
  writeFileSync(made, wanted)
}

// vite prints the addresses: the phone opens the one after "Network".
console.log('\nOn the phone, on the same Wi-Fi, open the address after "Network" below.')
console.log('The first time, accept the warning about the certificate.\n')

spawn('npx', ['vite', 'examples', '--host'], {
  stdio: 'inherit',
  env: { ...process.env, FORCE_HTTPS_KEY: key.pathname, FORCE_HTTPS_CERT: cert.pathname },
})
