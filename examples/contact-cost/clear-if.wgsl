// The list of neighbours, step b: empty the cells, only when the list is made again. A shader
// instead of clearBuffer(), because only the GPU knows whether it must.

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read_write> control: array<atomic<u32>>; // see rebuild.wgsl
@group(0) @binding(2) var<storage, read_write> counts: array<atomic<u32>>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3u) {
  if (id.x >= arrayLength(&counts) || !rebuild()) {
    return;
  }
  atomicStore(&counts[id.x], 0u);
}
