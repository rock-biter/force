// Asks this browser one question: may a fragment shader that writes its own depth promise that the
// depth will only be farther (or only nearer) than the triangle's? With that promise the GPU can
// throw away a hidden pixel before running the shader, which it cannot do today for our spheres.
//
// WGSL writes the promise as a second word in the builtin: @builtin(frag_depth, greater). It is a
// "language feature" named fragment_depth: a browser that knows it lists the name in
// navigator.gpu.wgslLanguageFeatures. The page reads that list, then tries for real: it builds a
// pipeline with each shader and reports what the browser answers.

import { requestGPUDevice } from 'force-gpu'

/** The same fragment shader three times: no promise, only farther, only nearer. */
const MODES = [
  ['no promise', 'frag_depth'],
  ['only farther', 'frag_depth, greater'],
  ['only nearer', 'frag_depth, less'],
] as const

const shader = (builtin: string): string => /* wgsl */ `
@vertex
fn vertex(@builtin(vertex_index) index: u32) -> @builtin(position) vec4f {
  // One triangle that covers the screen, at depth 0.5.
  let corners = array(vec2f(-1, -1), vec2f(3, -1), vec2f(-1, 3));
  return vec4f(corners[index], 0.5, 1);
}

@fragment
fn fragment(@builtin(position) position: vec4f) -> @builtin(${builtin}) f32 {
  return position.z;
}
`

/** Builds a pipeline with the shader, and returns what went wrong, or '' when nothing did. */
async function attempt(device: GPUDevice, builtin: string): Promise<string> {
  device.pushErrorScope('validation')
  const module = device.createShaderModule({ code: shader(builtin) })
  device.createRenderPipeline({
    layout: 'auto',
    vertex: { module },
    fragment: { module, targets: [] },
    depthStencil: { format: 'depth32float', depthWriteEnabled: true, depthCompare: 'less' },
  })
  const error = await device.popErrorScope()
  // The compiler's own words say more than the pipeline's error: prefer them.
  const info = await module.getCompilationInfo()
  const said = info.messages.find((message) => message.type === 'error')
  if (said) return `line ${said.lineNum}: ${said.message}`
  return error ? error.message : ''
}

async function run(): Promise<string> {
  const features = navigator.gpu?.wgslLanguageFeatures
  const device = await requestGPUDevice()
  const lines = [
    navigator.userAgent,
    '',
    `Language features this browser lists: ${features ? [...features].sort().join(', ') || 'none' : 'no list at all'}`,
    `fragment_depth among them: ${features?.has('fragment_depth') ? 'YES' : 'NO'}`,
    '',
    'A pipeline built with each shader:',
  ]
  for (const [name, builtin] of MODES) {
    const wrong = await attempt(device, builtin)
    lines.push(
      `  @builtin(${builtin})  (${name}): ${wrong ? `REFUSED\n      ${wrong}` : 'accepted'}`,
    )
  }
  return lines.join('\n')
}

const output = document.querySelector('#output')
if (output) {
  run().then(
    (message) => {
      output.textContent = message
    },
    (error: unknown) => {
      output.textContent = `FAILED: ${error}`
    },
  )
}
