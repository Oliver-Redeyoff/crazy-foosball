import * as ort from 'onnxruntime-web'

// Disable SharedArrayBuffer so no special HTTP headers are required
ort.env.wasm.numThreads = 1

let session: ort.InferenceSession | null = null
let _inferencing = false

export async function loadPolicy(modelUrl: string): Promise<void> {
  try {
    session = await ort.InferenceSession.create(modelUrl, {
      executionProviders: ['wasm'],
    })
    console.log('[ONNX] Policy loaded')
  } catch (e) {
    console.error('[ONNX] Failed to load policy:', e)
  }
}

export function policyReady(): boolean {
  return session !== null
}

export async function runPolicy(obs: Float32Array): Promise<Float32Array | null> {
  if (!session || _inferencing) return null
  _inferencing = true
  try {
    const tensor = new ort.Tensor('float32', obs, [1, obs.length])
    const outputs = await session.run({ obs: tensor })
    const actions = outputs['action'].data as Float32Array
    _inferencing = false
    return actions
  } catch (e) {
    console.error('[ONNX] Inference error:', e)
    _inferencing = false
    return null
  }
}
