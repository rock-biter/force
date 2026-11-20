// The address book, step 3: one thread alone walks the blocks, a few thousand, and replaces each
// block's sum with the sum of all the blocks before it: the row where the block begins.

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read_write> control: array<atomic<u32>>; // see rebuild.wgsl
@group(0) @binding(2) var<storage, read_write> blocks: array<u32>;

@compute @workgroup_size(1)
fn main(@builtin(global_invocation_id) id: vec3u) {
  if (id.x != 0u || !rebuild()) {
    return;
  }
  var before = 0u;
  for (var b = 0u; b < arrayLength(&blocks); b++) {
    let sum = blocks[b];
    blocks[b] = before;
    before += sum;
  }
}
