'use strict'

import { hex2rgb, deg2rad, loadExternalFile } from '../utils/utils.js'

import Quad from '../../assignment4.quad.js'
import FrameBufferObject from '../../assignment4.fbo.js'

import Cube from '../utils/cube.js'

import Input from '../input/input.js'
import * as mat4 from '../lib/glmatrix/mat4.js'
import * as vec3 from '../lib/glmatrix/vec3.js'
import * as quat from '../lib/glmatrix/quat.js'

import { OBJLoader } from '../utils/objloader.js'
import { Scene, SceneNode } from '../utils/scene.js'
import { RenderTexture } from '../utils/texture.js'
import { PerspectiveCamera } from '../utils/camera.js'
import { Light, AmbientLight, DirectionalLight, PointLight } from '../utils/light.js'

/**
 * @Class
 * WebGlApp that will call basic GL functions, manage a list of shapes, and take care of rendering them
 * 
 * This class will use the Shapes that you have implemented to store and render them
 */
class WebGlApp 
{
    /**
     * Initializes the app with a box, and the model, view, and projection matrices
     * 
     * @param {WebGL2RenderingContext} gl The webgl2 rendering context
     * @param {Map<String,Shader>} shader The shaders to be used to draw the object
     * @param {AppState} app_state The state of the UI
     */
    constructor( gl, shaders )
    {
        // Set GL flags
        this.setGlFlags( gl )

        // Store the shader(s)
        this.shaders = shaders // Collection of all shaders
        this.cube_shader   = this.shaders[0]
        this.light_shader  = this.shaders[1]
        this.shadow_shader = this.shaders[this.shaders.length - 2]
        this.quad_shader   = this.shaders[this.shaders.length - 1]

        // The main shader used for rendering
        this.active_shader = 2

        // Create a box instance and create a variable to track its rotation
        this.cube = new Cube( gl, this.cube_shader )

        // Declare a variable to hold a Scene
        // Scene files can be loaded through the UI (see below)
        this.scene = null

        // Create the view matrix
        this.camera = new PerspectiveCamera( )

        // Use the shader's setUniform4x4f function to pass the matrices
        for (let shader of this.shaders) {
            shader.use()
            shader.setUniform3f('u_eye', this.camera.getEye())
            shader.setUniform4x4f('u_v', this.camera.getViewMatrix())
            shader.setUniform4x4f('u_p', this.camera.getProjectionMatrix())
            shader.unuse()
        }

        // For simplicity, we only track the first point light and the first directional light
        this.first_directional_light = null
        this.first_point_light = null

        // Flags
        this.render_mode = 'normal'
        this.filter_mode = -1
    }

    openScene( gl, filename )
    {
        // reset light handlers
        this.first_directional_light = null
        this.first_point_light = null

        // loading the scene
        let scene_config = JSON.parse(loadExternalFile(`./scenes/${filename}`))
        this.scene = new Scene(scene_config, gl, this.light_shader)
        this.scene.setShader(gl, this.shaders[this.active_shader])

        // verify the scene contains at least one point light
        if (this.scene) {
            for (let node of this.scene.getNodes()) {
                if (node.type == 'light' && node.light instanceof DirectionalLight) {
                    if (!this.first_directional_light)
                        this.first_directional_light = node.light
                }
                if (node.type == 'light' && node.light instanceof PointLight) {
                    if (!this.first_point_light)
                        this.first_point_light = node.light
                }
            }
        }

        return this.scene
    }

    /**
     * Sets up GL flags
     * In this assignment we are drawing 3D data, so we need to enable the flag 
     * for depth testing. This will prevent from geometry that is occluded by other 
     * geometry from 'shining through' (i.e. being wrongly drawn on top of closer geomentry)
     * 
     * Look into gl.enable() and gl.DEPTH_TEST to learn about this topic
     * 
     * @param {WebGL2RenderingContext} gl The webgl2 rendering context
     */
    setGlFlags( gl )
    {
        gl.enable(gl.DEPTH_TEST) // Enable depth test
    }

    /**
     * Sets the viewport of the canvas to fill the whole available space so we draw to the whole canvas
     * 
     * @param {WebGL2RenderingContext} gl The webgl2 rendering context
     * @param {Number} width
     * @param {Number} height
     */
    setViewport( gl, width, height )
    {
        gl.viewport( 0, 0, width, height )
    }

    /**
     * Clears the canvas color
     * 
     * @param {WebGL2RenderingContext} gl The webgl2 rendering context
     */
    clearCanvas( gl )
    {
        gl.clearColor(...hex2rgb('#28282B'), 1.0)
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
    }

    /**
     * Updates components of this app
     * 
     * @param {WebGL2RenderingContext} gl The webgl2 rendering context
     * @param {AppState} app_state The state of the UI
     * @param {Number} delta_time The time in fractional seconds since the last frame
     */
    updateAppStates( gl, app_state, delta_time )
    {
        // Shader
        if (this.scene != null) {
            let old_active_shader = this.active_shader
            switch(app_state.getState('Shading')) {
                case 'Phong':
                    this.active_shader = 2
                    break
                case 'Textured':
                    this.active_shader = 3
                    break
                case 'Shadow':
                    this.active_shader = 2
                    break
            }
            if (old_active_shader != this.active_shader) {
                this.scene.setShader(gl, this.shaders[this.active_shader])
            }
        }

        // Rendering Mode
        this.filter_mode = app_state.getState('Select Filter')
        if (app_state.getState('Shading') == 'Shadow') {
            this.render_mode = 'shadowmap'
        }
        else if (this.filter_mode >= 0) {
            this.render_mode = 'pixel_filter'
        }
        else {
            this.render_mode = 'normal'
        }

        // Shader Debug
        switch(app_state.getState('Shading Debug')) {
            case 'Preview':
                this.fbo_preview = true
                break
            case 'Normals':
                this.shaders[this.active_shader].use()
                this.shaders[this.active_shader].setUniform1i('u_show_normals', 1)
                this.shaders[this.active_shader].unuse()
                break
            default:
                this.fbo_preview = false
                this.shaders[this.active_shader].use()
                this.shaders[this.active_shader].setUniform1i('u_show_normals', 0)
                this.shaders[this.active_shader].unuse()
                break
        }

        // Control
        switch(app_state.getState('Control')) {
            case 'Camera':
                if (this.camera.update(delta_time)) {
                    for (let shader of this.shaders) {
                        shader.use()
                        shader.setUniform3f('u_eye', this.camera.getEye())
                        shader.setUniform4x4f('u_v', this.camera.getViewMatrix())
                        shader.unuse()
                    }
                }
                break
            case 'Scene Node':
                // Only do this if a scene is loaded
                if (this.scene == null) break
                // Get the currently selected scene node from the UI
                let scene_node = this.scene.getNode( app_state.getState('Select Scene Node') )
                this.updateSceneNode( scene_node, delta_time )
                break
        }
    }

    /**
     * Update a SceneNode's local transformation
     * 
     * Supports the following interactions:
     * 1) Left Mouse Button - Rotate the node relative to the view along the Up and Right axes
     * 2) Middle Mouse Button or Space+Left Mouse Button - Translate the node relative to the view along the Up and Right axes
     * 3) Right Mouse Button - Scales the node around it's local center
     * 
     * @param {SceneNode} node The SceneNode to manipulate
     * @param {Number} delta_time The time in seconds since the last frame (floating point number)
     */
    updateSceneNode( node, delta_time )
    {
        let node_dirty = false

        let translation = mat4.create()
        let rotation = mat4.create()
        let scale = mat4.create()

        // Control - Scale
        if (Input.isMouseDown(2)) 
        {
            let factor = 1.0 + Input.getMouseDy() * delta_time
            scale = mat4.fromScaling(mat4.create(), [factor, factor, factor])
            node_dirty = true
        }

        let up = this.camera.up
        let right = this.camera.right

        // Control - Rotate
        if (Input.isMouseDown(0) && !Input.isKeyDown(' ')) 
        {
            let rotation_up = mat4.fromRotation(mat4.create(), deg2rad(10 * Input.getMouseDx() * delta_time), up)
            let rotation_right = mat4.fromRotation(mat4.create(), deg2rad(10 * Input.getMouseDy() * delta_time), right)

            rotation = mat4.multiply(mat4.create(), rotation_right, rotation_up)

            node_dirty = true
        }

        // Control - Translate
        if (Input.isMouseDown(1) || (Input.isMouseDown(0) && Input.isKeyDown(' ')))
        {
            translation = mat4.fromTranslation(mat4.create(),
                vec3.add(vec3.create(), 
                    vec3.scale(vec3.create(), right, 0.75 * Input.getMouseDx() * delta_time),
                    vec3.scale(vec3.create(), up, -0.75 * Input.getMouseDy() * delta_time)
                ))

            node_dirty = true
        }

        // Update node transformation if needed
        if (node_dirty) 
        {
            // Get the world rotation and scale of the node
            // Construct the inverse transformation of that matrix
            // We isolate the rotation and scale by setting the right column of the matrix to 0,0,0,1
            // If this is the root node, we set both matrices to identity
            let world_rotation_scale = mat4.clone(node.getWorldTransformation())
            let world_rotation_scale_inverse = null
            if (world_rotation_scale != null) {
                world_rotation_scale[12] = 0, world_rotation_scale[13] = 0, world_rotation_scale[14] = 0
                world_rotation_scale_inverse = mat4.invert(mat4.create(), world_rotation_scale)
            } else {
                world_rotation_scale = mat4.create()
                world_rotation_scale_inverse = mat4.create()
            }

            // Get the node's local transformation that we modify
            let transformation = node.getTransformation()

            // It's best to read this block from the bottom up
            // This is the order in which the transformations will take effect
            // Fourth, apply the scaling
            transformation = mat4.multiply(mat4.create(), transformation, scale)
            // Third, remove the full world rotation and scale to turn this back into a local matrix
            transformation = mat4.multiply(mat4.create(), transformation, world_rotation_scale_inverse)
            // Second, apply rotation and translation in world space alignment
            transformation = mat4.multiply(mat4.create(), transformation, translation)
            transformation = mat4.multiply(mat4.create(), transformation, rotation)
            // First, temporarily apply the full world rotation and scale to align the object in world space
            transformation = mat4.multiply(mat4.create(), transformation, world_rotation_scale)        

            // Update the node's transformation
            node.setTransformation(transformation)
        }
    }

    /**
     * Main render loop which sets up the active viewport (i.e. the area of the canvas we draw to)
     * clears the canvas with a background color and draws the scene
     * 
     * @param {WebGL2RenderingContext} gl The webgl2 rendering context
     * @param {Number} canvas_width The canvas width. Needed to set the viewport
     * @param {Number} canvas_height The canvas height. Needed to set the viewport
     */
    render( gl, canvas_width, canvas_height, preview )
    {
        this.setViewport( gl, canvas_width, canvas_height )
        this.clearCanvas( gl )

        if (this.scene) {
            this['renderpass_'+this.render_mode](gl, canvas_width, canvas_height)
        }

        // Render the box. This will use the MVP that was passed to the shader.
        this.cube.render( gl )

        // Preview FBO texture
        if (this.fbo_preview) {
            // for (let img of preview.getElementsByTagName("img")) {
            //     preview.removeChild(img)
            // }
            this.fbo.toHTMLImage( gl, preview )
            preview.style['visibility'] = 'visible'
        }
        else {
            preview.style['visibility'] = 'hidden'
        }
    }

}

export default WebGlApp
