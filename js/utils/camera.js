'use strict'

import * as mat4 from '../lib/glmatrix/mat4.js'
import * as vec3 from '../lib/glmatrix/vec3.js'
import * as quat from '../lib/glmatrix/quat.js'

import { deg2rad } from '../utils/utils.js'
import Input from '../input/input.js'

class BaseCamera 
{
    constructor( eye = [2.0, 0.5, -2.0], center = [0, 0, 0] )
    {
        // Create the view matrix
        this.eye     =   eye
        this.center  =   center

        this.forward =   null
        this.right   =   null
        this.up      =   null

        // Forward, Right, and Up are initialized based on Eye and Center
        this.updateViewSpaceVectors()
        this.view = mat4.lookAt(mat4.create(), this.eye, this.center, this.up)

        // Initialize the projection matrix
        this.projection = null
    }

    getProjectionMatrix( )
    {
        return this.projection
    }

    getViewMatrix( )
    {
        return this.view
    }

    getEye( )
    {
        return this.eye
    }

    /**
     * Update the Forward, Right, and Up vector according to changes in the 
     * camera position (Eye) or the center of focus (Center)
     */
    updateViewSpaceVectors( )
    {
        this.forward = vec3.normalize(vec3.create(), vec3.sub(vec3.create(), this.eye, this.center))
        this.right = vec3.normalize(vec3.create(), vec3.cross(vec3.create(), [0,1,0], this.forward))
        this.up = vec3.normalize(vec3.create(), vec3.cross(vec3.create(), this.forward, this.right))
    }

    /**
     * Update the camera view based on user input and the arcball viewing model
     * 
     * Supports the following interactions:
     * 1) Left Mouse Button - Rotate the view's center
     * 2) Middle Mouse Button or Space+Left Mouse Button - Pan the view relative view-space
     * 3) Right Mouse Button - Zoom towards or away from the view's center
     * 
     * @param {Number} delta_time The time in seconds since the last frame (floating point number)
     */
    update( delta_time )
    {
        let view_dirty = false

        // Control - Zoom
        if (Input.isMouseDown(2))
        {
            // Scale camera position
            let translation = vec3.scale(vec3.create(), this.forward, -Input.getMouseDy() * delta_time)
            this.eye = vec3.add(vec3.create(), this.eye, translation)

            // Set dirty flag to trigger view matrix updates
            view_dirty = true
        }

        // Control - Rotate
        if (Input.isMouseDown(0) && !Input.isKeyDown(' '))
        {
            // Rotate around xz plane around y
            this.eye = vec3.rotateY(vec3.create(), this.eye, this.center, deg2rad(-10 * Input.getMouseDx() * delta_time ))

            // Rotate around view-aligned rotation axis
            let rotation = mat4.fromRotation(mat4.create(), deg2rad(-10 * Input.getMouseDy() * delta_time ), this.right)
            this.eye = vec3.transformMat4(vec3.create(), this.eye, rotation)

            // Set dirty flag to trigger view matrix updates
            view_dirty = true
        }

        // Control - Pan
        if (Input.isMouseDown(1) || (Input.isMouseDown(0) && Input.isKeyDown(' ')))
        {
            // Create translation on two view-aligned axes
            let translation = vec3.add(
                vec3.create(), 
                vec3.scale(vec3.create(), this.right, -0.75 * Input.getMouseDx() * delta_time),
                vec3.scale(vec3.create(), this.up, 0.75 * Input.getMouseDy() * delta_time)
            )

            // Translate both eye and center in parallel
            this.eye = vec3.add(vec3.create(), this.eye, translation)
            this.center = vec3.add(vec3.create(), this.center, translation)

            view_dirty = true
        }

        // Update view matrix if needed
        if (view_dirty) 
        {
            // Update Forward, Right, and Up vectors
            this.updateViewSpaceVectors()
            this.view = mat4.lookAt(mat4.create(), this.eye, this.center, this.up)
        }

        return view_dirty
    }
}

class PerspectiveCamera extends BaseCamera
{
    constructor( eye = [2.0, 0.5, -2.0], center = [0, 0, 0], fovy = 60, aspect = 16/9, near = 0.01, far = 100.0 )
    {
        super( eye, center )

        // Create the projection matrix
        this.fovy = fovy
        this.aspect = aspect
        this.near = near
        this.far = far
        this.projection = mat4.perspective(mat4.create(), deg2rad(this.fovy), this.aspect, this.near, this.far)
    }
}

class OrthoCamera extends BaseCamera 
{
    constructor( eye = [2.0, 0.5, -2.0], center = [0, 0, 0], left = -1, right = 1, bottom = -1, top = 1, near = 0.01, far = 100.0 )
    {
        super( eye, center )
        this.projection = mat4.ortho(mat4.create(), left, right, bottom, top, near, far)
    }
}

export {
    PerspectiveCamera,
    OrthoCamera
}
