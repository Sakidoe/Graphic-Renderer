'use strict'

/**
 * The Texture class is used to store texture information and load image data
 * 
 */
class BaseTexture {

    constructor( gl )
    {
        this.texture = gl.createTexture()
    }

    bind( gl )
    {
        gl.bindTexture(gl.TEXTURE_2D, this.texture)
    }

    unbind( gl )
    {
        gl.bindTexture(gl.TEXTURE_2D, null)
    }

    getGlTexture() 
    {
        return this.texture
    }

    createTexture( gl, width, height, internal_format, src_format, src_type, pixel, flip_y ) 
    {
        this.bind(gl)

        // Set up texture flipping (see Book Ch7)
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, flip_y)

        // Set up texture data
        const level = 0
        const border = 0
        gl.texImage2D(gl.TEXTURE_2D, level, internal_format,
                      width, height, border, 
                      src_format, src_type, pixel)

        // Set up texture wrapping mode to repeat the texture when UVs exceed [(0,0),(1,1)]
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

        // Set up texture MIN/MAG filtering (nearest to start with)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)

        this.unbind(gl)
    }
}

class ImageTexture extends BaseTexture {

    constructor( filename, gl, flip_y = true )
    {
        // Setup a base texture object
        super(gl)

        // Store the filename
        this.filename = filename 

        // Load basic texture parameters
        const texture = this.texture
        const level = 0
        const internal_format = gl.RGBA
        const src_format = gl.RGBA
        const src_type = gl.UNSIGNED_BYTE
        
        // First fill the texture with some fallback data. This is needed since images
        // are loaded asynchronously and image data might not be immediately available.
        const pixel = new Uint8Array([0, 0, 255, 255])  // opaque blue
        super.createTexture(gl, 1, 1, internal_format, src_format, src_type, pixel, flip_y)

        // Create a new image to load image data from disk
        const image = new Image()
        image.onload = () => {
            // Bind the texture and upload image data to the texture
            gl.bindTexture(gl.TEXTURE_2D, texture)
            gl.texImage2D(gl.TEXTURE_2D, level, internal_format, src_format, src_type, image)

            // Generate mipmap from the full-size texture
            gl.generateMipmap(gl.TEXTURE_2D)

            // Set up texture wrapping mode to repeat the texture when UVs exceed [(0,0),(1,1)]
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT)

            // Set up texture MIN/MAG filtering
            // Use mipmapping and linear filterin
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST_MIPMAP_LINEAR)
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
        }

        // By setting the image's src parameter the image will start loading data from disk
        // When the data is available, image.onload will be called
        image.src = this.filename
    }

}

class RenderTexture extends BaseTexture {

    constructor( gl, internal_format = gl.RGBA, src_format = gl.RGBA, src_type = gl.UNSIGNED_BYTE )
    {
        // Setup a base texture object
        super(gl)

        // Store the texture parameters
        this.internal_format = internal_format
        this.src_format = src_format 
        this.src_type = src_type

        // Initialize size (following the example base class)
        this.width  = 0
        this.height = 0
    }

    resize( gl, width, height )
    {
        this.width  = width
        this.height = height
        super.createTexture( gl, width, height, this.internal_format, this.src_format, this.src_type, null, false )
    }

}

export {
    ImageTexture,
    RenderTexture
}
