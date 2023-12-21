#version 300 es

// an attribute will receive data from a buffer
in vec3 a_position;
in vec3 a_normal;
in vec3 a_tangent;
in vec2 a_texture_coord;

// transformation matrices
uniform mat4x4 u_m;
uniform mat4x4 u_v;
uniform mat4x4 u_p;

// output to fragment stage
out mat3 o_tbn;
out vec3 o_vertex_position_world;
out vec2 o_texture_coord;

void main() {

    mat3 norm_matrix = transpose(inverse(mat3(u_m)));
    vec3 bitangent = normalize(norm_matrix * cross(a_normal, a_tangent));
    vec3 normal = normalize(norm_matrix * a_normal);
    vec3 tangent = normalize(norm_matrix * a_tangent);
    // Gram-Schmidt process to re-orthogonalize tangent
    tangent = normalize(tangent - normal * dot(normal, tangent));
    // Construct TBN matrix
    o_tbn = mat3(tangent, bitangent, normal);

    // transform a vertex from object space directly to screen space
    // the full chain of transformations is:
    // object space -{model}-> world space -{view}-> view space -{projection}-> clip space
    vec4 vertex_position_world = u_m * vec4(a_position, 1.0);
    o_vertex_position_world = vertex_position_world.xyz;

    // Forward vertex positions and texture coordinates to fragment stage
    o_texture_coord = a_texture_coord.xy;

    gl_Position = u_p * u_v * vertex_position_world;

}
