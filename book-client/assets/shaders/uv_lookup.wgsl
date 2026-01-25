// UV Lookup Shader
// Renders the page mesh with UV coordinates encoded as colors
// Used for tap detection on curved surfaces
//
// R channel = U coordinate (0.0 to 1.0)
// G channel = V coordinate (0.0 to 1.0)
// B channel = 1.0 (marks valid page pixels)
// A channel = 1.0

#import bevy_pbr::forward_io::VertexOutput

@fragment
fn fragment(in: VertexOutput) -> @location(0) vec4<f32> {
    // Encode UV as color
    // R = U, G = V, B = 1 (on page marker), A = 1
    return vec4<f32>(in.uv.x, in.uv.y, 1.0, 1.0);
}
