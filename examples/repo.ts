// The address of the repo on GitHub, read from package.json: for the links that leave the site.

import packageJson from '../package.json?raw'

/** "https://github.com/<owner>/<repo>" */
export const REPO: string = JSON.parse(packageJson)
  .repository.url.replace(/^git\+/, '')
  .replace(/\.git$/, '')
