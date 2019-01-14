let random = (() => {
	const o = {
		high: null,
		low: null,
		int: function (min, max) {
			o.high = ((o.high << 16) + (o.high >> 16) + o.low) & 0xffffffff;
			o.low = (o.low + o.high) & 0xffffffff;
			var n = (o.high >>> 0) / 0xffffffff;
			return (min + n * (max-min+1))|0;
		},
		seed: function (seed) {
			o.high = seed || 0xBADC0FFE;
			o.low = seed ^ 0x49616E42;
		},
		array: function (arr) {
			return arr[o.int(0, arr.length-1)];
		}
	};
	return o;
})();
