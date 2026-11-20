// The address book, step 4: one thread per block walks its 512 cells from the row where the block
// begins, and writes for each cell the row where its part ends. The next step fills each part from
// its end backward, which leaves in `ends` the row where it begins.

const BLOCK = 512u;

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read_write> control: array<atomic<u32>>; // see rebuild.wgsl
@group(0) @binding(2) var<storage, read> counts: array<u32>;
@group(0) @binding(3) var<storage, read> blocks: array<u32>;
@group(0) @binding(4) var<storage, read_write> ends: array<u32>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3u) {
  let cells = arrayLength(&counts);
  let first = id.x * BLOCK;
  if (id.x >= arrayLength(&blocks) || !rebuild()) {
    return;
  }
  var row = blocks[id.x];
  for (var c = first; c < min(first + BLOCK, cells); c++) {
    row += counts[c];
    ends[c] = row;
  }
}
