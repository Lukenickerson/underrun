
var udef, // global undefined
	_math = Math,
	_temp,

	keys = {37: 0, 38: 0, 39: 0, 40: 0},
	key_up = 38, key_down = 40, key_left = 37, key_right = 39, key_shoot = 512,
	mouse_x = 0, mouse_y = 0,

	time_elapsed,
	time_last = performance.now(),
	
	level_width = 64,
	level_height = 64,
	level_data = new Uint8Array(level_width * level_height),

	cpus_total = 0,
	cpus_rebooted = 0,

	current_level = 0,
	entity_player,
	entities = [];

function next_level(callback) {
	if (current_level == 3) {
		game.entitiesToKill.push(entity_player);
		terminal_run_outro();
	} else {
		current_level++;
		load_level(current_level, callback);
	}
}

function load_level(id, callback) {
	random.seed(0xBADC0DE1 + id);
	game.loadImage('l'+id, function(){
		entities = [];
		renderer.clearVerts().clearLights();

		cpus_total = 0;
		cpus_rebooted = 0;

		_temp = game.doc.createElement('canvas');
		_temp.width = _temp.height = level_width; // assume square levels
		_temp = _temp.getContext('2d')
		_temp.drawImage(this, 0, 0);
		_temp =_temp.getImageData(0, 0, level_width, level_height).data;

		for (var y = 0, index = 0; y < level_height; y++) {
			for (var x = 0; x < level_width; x++, index++) {

				// reduce to 12 bit color to accurately match
				var colorKey = (
					((_temp[index*4]>>4) << 8) + 
					((_temp[index*4+1]>>4) << 4) + 
					(_temp[index*4+2]>>4)
				);

				if (colorKey !== 0) {
					var tile = level_data[index] = (
						colorKey === 0x888 // wall
								? random.int(0, 5) < 4 ? 8 : random.int(8, 17)
								: random.array([1,1,1,1,1,3,3,2,5,5,5,5,5,5,7,7,6]) // floor
					);

					if (tile > 7) { // walls
						// tall blocks for certain tiles
						var tileSites = tile - 1;
						var h = ~[8, 9, 17].indexOf(tileSites) ? 16 : 8;
						renderer.pushBlock(x * 8, y * 8, h, 4, tileSites);
					} else if (tile > 0) { // floor
						renderer.pushFloor(x * 8, y * 8, tile-1);

						// enemies and items
						if (random.int(0, 16 - (id * 2)) == 0) {
							new entity_spider_t(x*8, 0, y*8, 5, 27);
						}
						else if (random.int(0, 100) == 0) {
							new entity_health_t(x*8, 0, y*8, 5, 31);
						}
					}

					// cpu
					if (colorKey === 0x00f) {
						level_data[index] = 8;
						new entity_cpu_t(x*8, 0, y*8, 0, 18);
						cpus_total++;
					}

					// sentry
					if (colorKey === 0xf00) {
						new entity_sentry_t(x*8, 0, y*8, 5, 32);
					}

					// player start position (blue)
					if (colorKey === 0x0f0) {
						entity_player = new entity_player_t(x*8, 0, y*8, 5, 18);	
					}
				}
			}
		}

		// Remove all spiders that spawned close to the player start
		for (var i = 0; i < entities.length; i++) {
			var e = entities[i];
			if (
				e instanceof(entity_spider_t) &&
				_math.abs(e.x - entity_player.x) < 64 &&
				_math.abs(e.z - entity_player.z) < 64
			) {
				game.entitiesToKill.push(e);
			}
		}

		camera.init(entity_player);

		renderer.setLevelVerts(renderer.verts);

		terminal_show_notice(
			'SCANNING FOR OFFLINE SYSTEMS...___' +
			(cpus_total)+' SYSTEMS FOUND'
		);
		callback && callback();
	});
}

function reload_level() {
	load_level(current_level);
}

var game = {
	entitiesToKill: [],

	init: function (doc) {
		this.doc = doc;
		this.setupEvents(doc);
	},

	setupEvents: function (doc) {
		const keyConvert = {65: 37, 87: 38, 68: 39, 83: 40}; // convert AWDS to left up down right

		function preventDefault(ev) {
			ev.preventDefault();
		}

		doc.onkeydown = (ev) => {
			_temp = ev.keyCode;
			_temp = keyConvert[_temp] || _temp;
			if (keys[_temp] !== udef) {
				keys[_temp] = 1;
				preventDefault(ev);
			}
		};
		
		doc.onkeyup = (ev) => {
			_temp = ev.keyCode;
			_temp = keyConvert[_temp] || _temp;
			if (keys[_temp] !== udef) {
				keys[_temp] = 0;
				preventDefault(ev);
			}
		};
		
		doc.onmousemove = (ev) => {
			mouse_x = (ev.clientX / c.clientWidth) * c.width;
			mouse_y = (ev.clientY / c.clientHeight) * c.height;
		};
		
		doc.onmousedown = (ev) => {
			keys[key_shoot] = 1;
			preventDefault(ev);
		};
		
		doc.onmouseup = (ev) => {
			keys[key_shoot] = 0;
			preventDefault(ev);
		};
	},

	loadImage: function (name, callback) {
		_temp = new Image();
		_temp.src = 'm/' + name + '.png';
		_temp.onload = callback;
	},

	checkCollisions: function (e1, i, entities) {
		// check for collisions between entities - it's quadratic and nobody cares \o/
		for (var j = i + 1; j < entities.length; j++) {
			e2 = entities[j];
			if(!(
				e1.x >= e2.x + 9 ||
				e1.x + 9 <= e2.x ||
				e1.z >= e2.z + 9 ||
				e1.z + 9 <= e2.z
			)) {
				e1._check(e2);
				e2._check(e1);
			}
		}
	},

	tick: function () {
		var time_now = performance.now();
		time_elapsed = (time_now - time_last)/1000;
		time_last = time_now;

		renderer.prepareFrame();

		// update and render entities
		for (var i = 0, e1, e2; i < entities.length; i++) {
			e1 = entities[i];
			if (e1._dead) { continue; }
			e1._update();

			this.checkCollisions(e1, i, entities);

			e1._render();		
		}

		camera.center(entity_player);
		camera.shake();

		// health bar, render with plasma sprite
		for (var i = 0; i < entity_player.h; i++) {
			renderer.pushSprite(-camera.x - 50 + i * 4, 29-camera.y, -camera.z-30, 26);
		}

		renderer.endFrame();

		// remove dead entities
		entities = entities.filter((entity) => {
			return this.entitiesToKill.indexOf(entity) === -1;
		});
		this.entitiesToKill = [];

		requestAnimationFrame(() => { this.tick(); });
	}
};

game.init(document);
