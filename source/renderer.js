var
	gl = c.getContext('webgl') || c.getContext('experimental-webgl'),
	vertex_buffer,
	shader_program,

	texture_size = 1024,
	tile_size = 16,
	tile_fraction = tile_size / texture_size,
	px_nudge = 0.5 / texture_size,
	
	num_verts = 0,
	level_num_verts,

	num_lights = 0,

	camera_uniform;

var renderer = {
	bufferData: null,
	lightData: null,
	lightUniform: null,

	defaultOptions: {
		shaderAttributeVec: 'attribute vec',
		shaderVarying: 
			'precision highp float;' +
			'varying vec3 vl;' +
			'varying vec2 vuv;'
		,
		shaderUniform: 'uniform ',
		shaderConstMat4: "const mat4 ",
		maxLights: 16,
	},

	setBufferData: function(maxVerts) {
		maxVerts = maxVerts || (1024 * 64);
		this.bufferData = new Float32Array(maxVerts*8); // allow 64k verts, 8 properties per vert
	},
	setLightData: function(maxLights) {
		this.lightData = new Float32Array(maxLights * 7); // 32 lights, 7 properties per light
	},

	getVertextShader: function(options) {
		return (
			options.shaderVarying + 
			options.shaderAttributeVec + "3 p;" +
			options.shaderAttributeVec + "2 uv;" +
			options.shaderAttributeVec + "3 n;" +
			options.shaderUniform + "vec3 cam;" +
			options.shaderUniform + "float l[7*" + options.maxLights + "];" +
			options.shaderConstMat4 + "v=mat4(1,0,0,0,0,.707,.707,0,0,-.707,.707,0,0,-22.627,-22.627,1);" + // view
			options.shaderConstMat4 + "r=mat4(.977,0,0,0,0,1.303,0,0,0,0,-1,-1,0,0,-2,0);"+ // projection
			"void main(void){" +
				"vl=vec3(0.3,0.3,0.6);" + // ambient color
				"for(int i=0; i<" + options.maxLights + "; i++) {"+
					"vec3 lp=vec3(l[i*7],l[i*7+1],l[i*7+2]);" + // light position
					"vl+=vec3(l[i*7+3],l[i*7+4],l[i*7+5])" + // light color *
						"*max(dot(n,normalize(lp-p)),0.)" + // diffuse *
						"*(1./(l[i*7+6]*(" + // attentuation *
							"length(lp-p)" + // distance
						")));" + 
				"}" +
				"vuv=uv;" +
				"gl_Position=r*v*(vec4(p+cam,1.));" +
			"}"
		);
	},

	getFragmentShader: function(options) {
		return (
			options.shaderVarying + 
			options.shaderUniform + "sampler2D s;" +
			"void main(void){" +
				"vec4 t=texture2D(s,vuv);" +
				"if(t.a<.8)" + // 1) discard alpha
					"discard;" + 
				"if(t.r>0.95&&t.g>0.25&&t.b==0.0)" + // 2) red glowing spider eyes
					"gl_FragColor=t;" +
				"else{" +  // 3) calculate color with lights and fog
					"gl_FragColor=t*vec4(vl,1.);" +
					"gl_FragColor.rgb*=smoothstep(" +
						"112.,16.," + // fog far, near
						"gl_FragCoord.z/gl_FragCoord.w" + // fog depth
					");" +
				"}" +
				"gl_FragColor.rgb=floor(gl_FragColor.rgb*6.35)/6.35;" + // reduce colors to ~256
			"}"
		);	
	},

	init: function(options) {
		const r = this;
		options = Object.assign({}, r.defaultOptions, options);
		console.log(options);
		// Create shorthand WebGL function names
		// var webglShortFunctionNames = {};
		for (var name in gl) {
			if (gl[name].length != udef) {
				gl[name.match(/(^..|[A-Z]|\d.|v$)/g).join('')] = gl[name];
				// webglShortFunctionNames[name] = 'gl.'+name.match(/(^..|[A-Z]|\d.|v$)/g).join('');
			}
		}
		// console.log(JSON.stringify(webglShortFunctionNames, null, '\t'));

		r.setBufferData();
		r.maxLights = options.maxLights;
		r.setLightData(options.maxLights);
		vertex_buffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, vertex_buffer);
		gl.bufferData(gl.ARRAY_BUFFER, r.bufferData, gl.DYNAMIC_DRAW);

		shader_program = gl.createProgram();
		gl.attachShader(shader_program, compileShader(gl.VERTEX_SHADER, r.getVertextShader(options)));
		gl.attachShader(shader_program, compileShader(gl.FRAGMENT_SHADER, r.getFragmentShader(options)));
		gl.linkProgram(shader_program);
		gl.useProgram(shader_program);

		camera_uniform = gl.getUniformLocation(shader_program, "cam");
		r.lightUniform = gl.getUniformLocation(shader_program, "l");

		gl.enable(gl.DEPTH_TEST);
		gl.enable(gl.BLEND);
		gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
		gl.viewport(0,0,c.width,c.height);

		enableVertexAttrib('p', 3, 8, 0);
		enableVertexAttrib('uv', 2, 8, 3);
		enableVertexAttrib('n', 3, 8, 5);
	},

	bindImage: function (image) {
		var texture_2d = gl.TEXTURE_2D;
		gl.bindTexture(texture_2d, gl.createTexture());
		gl.texImage2D(texture_2d, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
		gl.texParameteri(texture_2d, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
		gl.texParameteri(texture_2d, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		gl.texParameteri(texture_2d, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(texture_2d, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	},

	pushLight: function(x, y, z, r, g, b, falloff) {
		const o = this;
		// Only push lights near to the camera
		var max_light_distance = (128 + 1/falloff); // cheap ass approximation
		if (
			num_lights < o.maxLights &&
			_math.abs(-x - camera.x) < max_light_distance &&
			_math.abs(-z - camera.z) < max_light_distance
		) {
			o.lightData.set([x, y, z, r, g, b, falloff], num_lights*7);
			num_lights++;
		}
	}
};

function renderer_prepare_frame() {
	const r = renderer;
	num_verts = level_num_verts;
	num_lights = 0;

	// reset all lights
	r.lightData.fill(1);
}

function renderer_end_frame() {
	const r = renderer;
	gl.uniform3f(camera_uniform, camera.x, camera.y - 10, camera.z - 30);
	gl.uniform1fv(r.lightUniform, r.lightData);

	gl.clearColor(0,0,0,1);
	gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);

	gl.bufferData(gl.ARRAY_BUFFER, r.bufferData, gl.DYNAMIC_DRAW);
	gl.drawArrays(gl.TRIANGLES, 0, num_verts);
};

function push_quad(x1, y1, z1, x2, y2, z2, x3, y3, z3, x4, y4, z4, nx, ny, nz, tile) {
	const r = renderer;
	var u = tile * tile_fraction + px_nudge;
	r.bufferData.set([
		x1, y1, z1, u, 0, nx, ny, nz,
		x2, y2, z2, u + tile_fraction - px_nudge, 0, nx, ny, nz,
		x3, y3, z3, u, 1, nx, ny, nz,
		x2, y2, z2, u + tile_fraction - px_nudge, 0, nx, ny, nz,
		x3, y3, z3, u, 1, nx, ny, nz,
		x4, y4, z4, u + tile_fraction - px_nudge, 1, nx, ny, nz
	], num_verts * 8);
	num_verts += 6;
};

function push_sprite(x, y, z, tile) {
	// Only push sprites near to the camera
	if (
		_math.abs(-x - camera.x) < 128 && 
		_math.abs(-z - camera.z) < 128
	) {
		var tilt = 3+(camera.z + z)/12; // tilt sprite when closer to camera
		push_quad(x, y + 6, z, x + 6, y + 6, z, x, y, z + tilt, x + 6, y, z + tilt, 0, 0, 1, tile);
	}
}

function push_floor(x, z, tile) {
	push_quad(x, 0, z, x + 8, 0, z, x, 0, z + 8, x + 8, 0, z + 8, 0,1,0, tile);
};

function push_block(x, z, tile_top, tile_sites) {
	// tall blocks for certain tiles
	var y = ~[8, 9, 17].indexOf(tile_sites) ? 16 : 8;

	push_quad(x, y, z, x + 8, y, z, x, y, z + 8, x + 8, y, z + 8, 0, 1, 0, tile_top); // top
	push_quad(x + 8, y, z, x + 8, y, z + 8, x + 8, 0, z, x + 8, 0, z + 8, 1, 0, 0, tile_sites); // right
	push_quad(x, y, z + 8, x + 8, y, z + 8, x, 0, z + 8, x + 8, 0, z + 8, 0, 0, 1, tile_sites); // front
	push_quad(x, y, z, x, y, z + 8, x, 0, z, x, 0, z + 8, -1, 0, 0, tile_sites); // left
};

function compileShader(shader_type, shader_source) {
	var shader = gl.createShader(shader_type);
	gl.shaderSource(shader, shader_source);
	gl.compileShader(shader);
	// console.log(gl.getShaderInfoLog(shader));
	return shader;
};

function enableVertexAttrib(attrib_name, count, vertex_size, offset) {
	var location = gl.getAttribLocation(shader_program, attrib_name);
	gl.enableVertexAttribArray(location);
	gl.vertexAttribPointer(location, count, gl.FLOAT, false, vertex_size * 4, offset * 4);
};
