// The address book, step 2: where does each cell's part of the list begin? At the sum of the counts
// of all the cells before it, a prefix sum. With 3, 1, 0 and 2 particles the cells begin at rows
// 0, 3, 4 and 4. One thread cannot add up millions of cells in time, and many threads cannot each
// wait for the one before. So the cells are cut into blocks of 512, and the sum is made in three
// passes. This is the first: one thread per block adds up its 512 counts.

const BLOCK = 512u;

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read_write> control: array<atomic<u32>>; // see rebuild.wgsl
@group(0) @binding(2) var<storage, read> counts: array<u32>;
@group(0) @binding(3) var<storage, read_write> blocks: array<u32>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3u) {
  let cells = arrayLength(&counts);
  let first = id.x * BLOCK;
  if (id.x >= arrayLength(&blocks) || !rebuild()) {
    return;
  }
  var sum = 0u;
  for (var c = first; c < min(first + BLOCK, cells); c++) {
    sum += counts[c];
  }
  blocks[id.x] = sum;
}
