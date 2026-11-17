// The addresses of the repo on GitHub and of this site, read from package.json.

import packageJson from '../package.json?raw'

const about = JSON.parse(packageJson)

/** "https://github.com/<owner>/<repo>" */
export const REPO: string = about.repository.url.replace(/^git\+/, '').replace(/\.git$/, '')

/** Where the site is online: "https://<user>.github.io/force/". */
export const SITE: string = about.homepage
