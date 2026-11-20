// One small buffer holds every flag and counter of the list of neighbours, so that no shader needs
// more than the 8 storage buffers WebGPU guarantees (maxStorageBuffersPerShaderStage):
//   control[0]  1 when JavaScript asks for a new list at this step
//   control[1]  1 when the GPU may decide by itself
//   control[2]  the largest move since the list was made, as the bits of an f32
//   control[3]  lists made so far
//   control[4]  neighbours that found no room in a list
//   control[5]  particles that found their cell full, and were left out of the grid
// The list must be made again when JavaScript asks, or, if the GPU decides by itself, when some
// particle has moved more than 0.4 of the margin: two particles that moved less than half of it
// each cannot have met without being in the list.
fn rebuild() -> bool {
  return atomicLoad(&control[0]) == 1u ||
    (atomicLoad(&control[1]) == 1u && bitcast<f32>(atomicLoad(&control[2])) > 0.4 * params.margin);
}
