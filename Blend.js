Blend = {map : {}, fx : {}};
// todo hold more info in each cell and pass it to the effect functions ?
// todo use an iterator-like set of method to allow irregular grid types to be used
// todo build a binary map to provide an irregular grid type
// todo specify only 1 dim and compute the 2nd as data.length / dim
Blend.map.Grid2D = function(w, h, data) {
	if (w*h != data.length)
		throw "given dimensions doesn't match member count"

	return {
		data : data,
		width : w,
		height : h,
		addRow : function(row, i) {
			this.checkRowLength(row);
			i = ('undefined' == typeof i) ? this.height : Math.max(0, Math.min(i, this.height));
			Array.prototype.splice.apply(this.data, [i*this.width, 0].concat(row));
			this.height++;
			return this;
		},
		removeRow : function(i) {
			var row = Array.prototype.splice.apply(this.data, [i*this.width, this.width]);
			this.height--;
			return row;
		},

		addCol : function(col, i) {
			this.checkColLength(col);
			i = ('undefined' == typeof i) ? this.width : Math.max(0, Math.min(i, this.width));
			for (var j=this.height-1; j>=0; j--)
				this.data.splice(j*this.width+i, 0, col.pop());
			this.width++;
			return this;
		},
		removeCol : function(i) {
			col = [];
			for (var j=this.height-1; j>=0; j--)
				col.unshift(this.data.splice(j*this.width+i, 1).pop());
			this.width--;
			return col;
		},

		checkRowLength : function(row) {
			if (row.length != this.width)
				throw "row length doesn't match column number";
		},
		checkColLength : function(col) {
			if (col.length != this.height)
				throw "column length doesn't match row number";
		},

		get : function(i, j) {
			return this.data[i*this.width+j];
		},

		getAreaDims : function(surfaceWidth, surfaceHeight) {
			w = surfaceWidth / this.width;
			h = surfaceHeight / this.height;
			return [w, h];
		},
		
		toString : function() {
			repr = [];
			for (var i=0; i<this.height; i++)
				repr.push(this.data.slice(i*this.width, (i+1)*this.width).join(' '));
			return '[' + repr.join('\n ') + ']';
		}
	};
}

Blend.fx.desaturate = function(ctx, amount) {
	var pixels = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
	for (var i=0; i<pixels.data.length; i+=4) {
		var avg = (pixels.data[i] + pixels.data[i+1] + pixels.data[i+2]) * 1/3;
		pixels.data[i] += (avg - pixels.data[i]) * amount;
		pixels.data[i+1] += (avg - pixels.data[i+1]) * amount;
		pixels.data[i+2] += (avg - pixels.data[i+2]) * amount;
	}
	ctx.putImageData(pixels, 0, 0);
}
Blend.fx.invert = function(ctx, amount) {
	var pixels = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
	for (var i=0; i<pixels.data.length; i+=4) {
		pixels.data[i] = 255 - pixels.data[i];
		pixels.data[i+1] = 255 - pixels.data[i+1];
		pixels.data[i+2] = 255 - pixels.data[i+2];
	}
	ctx.putImageData(pixels, 0, 0);
}
Blend.fx.alpha = function(ctx, amount) {
	var pixels = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
	for (var i=0; i<pixels.data.length; i+=4)
		pixels.data[i+3] = (1-amount) * 255;
	ctx.putImageData(pixels, 0, 0);
}
Blend.fx.border = function(ctx, amount) {
	var w = ctx.canvas.width,
		h = ctx.canvas.height,
		thickness = 5;
	ctx.strokeStyle = '#FF2356';
	for (var i=0; i<thickness; i++)
		ctx.strokeRect(i, i, w-2*i, h-2*i);
}
Blend.fx.circleMask = function(ctx, amount) {
	var w = ctx.canvas.width,
		h = ctx.canvas.height;
	ctx.globalCompositeOperation = 'destination-in';
	ctx.fillStyle = 'rgba(255, 255, 255, 1)';
	ctx.beginPath();
	ctx.arc(w/2, h/2, Math.min(w, h)/2, 0, Math.PI*2, true);
	ctx.fill();
	ctx.globalCompositeOperation = 'destination-over';
	ctx.fillRect(0, 0, w, h);
}

Blend.create = function(img, map) {
	canvas = document.createElement('canvas');
	canvas.height = img.height;
	canvas.width = img.width;
	context = canvas.getContext('2d');
	context.drawImage(img, 0, 0);

	return {
		img : img,
		map : map,
		canvas : canvas,
		context : context,

		fx : function(effect) {
			function _fx(x, y, w, h, amount) {
				// var pixels = this.context.getImageData(x, y, Math.floor(w), Math.floor(h));
				// effect.call(this, pixels, amount, this.context);
				// this.context.putImageData(pixels, x, y);
				// console.log(x, y, w, h, amount);
				var tmpCanvas = document.createElement('canvas');
				tmpCanvas.width = w;
				tmpCanvas.height = h;
				var tmpContext = tmpCanvas.getContext('2d');
				tmpContext.drawImage(this.canvas, x, y, w, h, 0, 0, w, h);

				// var result = effect.call(this, x, y, w, h, amount, this.context);
				// if ('object' == typeof result && result.width && result.height && result.data)
				// 	this.context.putImageData(result, x, y);
				effect.call(this, tmpContext, amount);
				// this.context.drawImage(tmpCanvas, x, y);
				var tmpImageData = tmpContext.getImageData(0, 0, w, h);
				this.context.putImageData(tmpImageData, x, y);
			}

			var dims = this.map.getAreaDims(this.img.width, this.img.height),
				w = dims.shift(),
				h = dims.shift(),
				hFloat = Math.floor(h) != h,
				wFloat = Math.floor(w) != w;
			w = Math.floor(w);
			h = Math.floor(h);
			for (var i=0; i<this.map.height; i++) {
				for (var j=0; j<this.map.width; j++) {
					var x = j*w,
						y = i*h,
						amount = this.map.get(i, j);
					if (amount) {
						var wInc = (wFloat && 1 == this.map.width-j) ? 1 : 0,
						 	hInc = (hFloat && 1 == this.map.height-i) ? 1 : 0;
						_fx.call(this, x, y, w+wInc, h+hInc, amount);
					}
				}
			}
			// handle the last row of the pixels in case of non-round division
			// if (Math.floor(h) != h)
			// 	for (var j=0; j<this.map.width; j++) {
			// 		var x = j*w; y=this.img.height-1, amount=this.map.get(this.map.height-1, j);
			// 		if (amount)
			// 			_fx.call(this, x, y, w, 1, amount);
			// 	}
			// // handle the last column of the pixels in case of non-round division
			// if (Math.floor(w) != w)
			// 	for (var i=0; i<this.map.height; i++) {
			// 		var x = this.img.width-1; y=i*h, amount=this.map.get(i, this.map.width-1);
			// 		if (amount)
			// 			_fx.call(this, x, y, 1, h, amount);
			// 	}
			return this;
		},
		update : function() {
			this.img.src = this.canvas.toDataURL();
			return this;
		}
	};
}
