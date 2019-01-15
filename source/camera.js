var camera = {
	x: 0,
	y: 0,
	z: 0,
	s: 0, // shake value
	init: function (who) {
		this.x = -who.x;
		this.y = -300;
		this.z = -who.z - 100;
	},
	center: function (who) {
		this.x = this.x * 0.92 - who.x * 0.08;
		this.y = this.y * 0.92 - who.y * 0.08;
		this.z = this.z * 0.92 - who.z * 0.08;
	},
	shake: function (s) {
		if (s) {
			this.s = s;
			return;
		}
		this.s *= 0.9;
		this.x += this.s * (Math.random()-0.5);
		this.z += this.s * (Math.random()-0.5);
	}
};
