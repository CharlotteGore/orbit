/********************
*
*
* The ORBIT Framework
* By Charlotte Gore
* v0.2
*
* 18th October 2010
*
*/

(function (window, undefined) {
	
	var orbit = function (selector, args) {
			return new orbit.fn.init(selector, args);
		}
			
		version = "0.1";
		
		orbit.fn = orbit.prototype = {
			// Wrapper for the NW.Matcher, CSS 3 Selector engine.
			init : function(selector, args){
				this.elements = [];
				if (selector && (typeof selector === 'string')) {
					this.elements = NW.Dom.select(selector, args);
				}else{
					if(selector && selector.nodeType){ // is an element
						this.elements[0] = selector;
					}
				}
				return this;
			}
		};
		
		orbit.fn.init.prototype = orbit.fn; 
		
		orbit.extend = orbit.fn.extend = function() {
			// Based on code in jQuery
			var target = this, i = 0, length = arguments.length, options, name, src, copy;
		
			for ( ; i < length; i++ ) {
				// Only deal with non-null/undefined values
				if ( (options = arguments[ i ]) != null ) {
					// Extend the base object
					for ( name in options ) {
						src = target[ name ];
						copy = options[ name ];
		
						// Prevent never-ending loop
						if ( target === copy ) {
							continue;
						}
		
						// Recurse if we're merging object literal values or arrays
						if ( copy !== undefined ) {
							target[ name ] = copy;
						}
					}
				}
			}
		
			// Return the modified object
			return target;
		};
		
		
		/**********
		*
		* Very basic DOM Stuff. Very very incomplete.
		*
		*/
		orbit.fn.extend({
		
			// Iterate through each element in the orbit object
			each : function (fn)  { 
				var i = this.elements.length;
				while(i--){
					fn.call(this, this.elements[i]);
				}
				return this;
			},
			setStyle : function (property, value)  { // CSS Shortcut method
				this.each(function (el) {
					el.style[property] = value;
				});
				return this;
			},
			show : function ()  { // Simple Show
				var that = this;
				this.each(function (el) {
					that.setStyle('display', 'block');
				});
				return this;
			},
			hide : function ()  { // Simple Hide
				var that = this;
				this.each(function (el) {
					that.setStyle('display', 'block');
				});
				return this;
			},
			html : function (str)  { // Populates the contents of innerHTML
				this.each(function (el) {
					el.innerHTML = str;
				});
				return this;
			}
			
		});
		
		/***********
		*
		*
		* Measuring utilities. 
		*
		*/
		orbit.fn.extend({
		
			getCenter : function () {
				var dimensions = [], dimensionHelper;
				
				dimensionHelper = function (el){
					var x = 0, y = 0;
					x = Math.max(el.clientWidth, el.offsetWidth) / 2;
					y = Math.max(el.clientHeight, el.offsetHeigh) / 2;
					return {x : x, y : y};
				};
				
				this.each(function (el) {
					dimensions.push(dimensionHelper(el));
				});
				
				return dimensions;
				
			},
			getPosition : function () {
			
				var positions = [], positionHelper;
				
				positionHelper = function (el){
					var curleft = 0, curtop = 0;
					if (el.offsetParent) {
					do {
						curleft += el.offsetLeft;
						curtop += el.offsetTop;
					} while (el = el.offsetParent);
						return {x : curleft, y : curtop};
					}
				
				};
				
				this.each(function (el) {
					positions.push(positionHelper(el));
				});
				
				return positions;
			},
			getInnerPosition : function () {
				
				var positions = [], positionHelper;
				
				positionHelper = function (el){
					
					var curleft = 0, curtop = 0;
	
						curleft += el.offsetLeft;
						curtop += el.offsetTop;
						
						return {x : curleft, y : curtop};
					
				
				};
				this.each(function (el) {
					positions.push(positionHelper(el));
				});
				return positions;
			},
			getMouse : function ( evt ) {
				
				var pointerX =   function (event) {
					var docElement = document.documentElement,
					body = document.body || { scrollLeft: 0 };
	
					return event.pageX || (event.clientX +
					(docElement.scrollLeft || body.scrollLeft) -
					(docElement.clientLeft || 0));
				};
	
				var pointerY = function(event) {
				    var docElement = document.documentElement,
				    body = document.body || { scrollTop: 0 };
				
				    return  event.pageY || (event.clientY +
						(docElement.scrollTop || body.scrollTop) -
						(docElement.clientTop || 0));
				 };
				 return { x : pointerX(evt), y: pointerY(evt) };
			
			}
			
		});
		
		orbit.fn.extend({
		
			tween : function (o)  {
				
				if (!o) {
					return this;
				}
				var that = this, 
					timeoutID = -1,
					stopAnimation = false,
					tick = 40,
					callback = o.callback || function () {},
					delay = o.delay || tick, // Not yet implemeted
					loop = o.loop || false,
					steps = (o.duration / tick),
					duration = (o.duration / steps) || 5,
					startTime,
					elapsedTime,
					oldPercent,
					bezierPresets,
					animations,
					pathType,
					bezier,
					getValueByPercent,
	
					rgbHexToArray,
					stripUnits, 
					preCalcTransforms,
					timeCache = 0,
					getElapsedPercent,
					
					//Public Methods returned with the a
					
					start,
					stop,
					getRawValuesAtFrame,
					goToFrame,
					goToFrameAtTime,
					percent,
					step,
					startValues,
					endValues,
					i, 
					hideOverflow,
					absolutize,
					genericInitHandler,
					reverse=false;
					
		
				bezierPresets = {
					// Preset flattened bezier curves
					decelerate: function (startValue, endValue)  {	
						return {p1: endValue, p2: endValue, p3: endValue, p4: startValue};
					},
					accelerate: function (startValue, endValue)  { 
						
						return {p1: endValue, p2: startValue, p3: startValue, p4: startValue};
					},
					bubble: function (startValue, endValue)  { 
						
						return {p1: endValue, p2: endValue, p3: startValue, p4: startValue}; 
					},
					// linear returns false to prevent it being used
					// as a bezier curve. Is is tested in preCalcTransforms.
					linear: function (startValue, endValue)  {
						
						return 0;
					}
		
				};
				
				if(o.easing){
					switch(o.easing){
						case "in" :
							pathType = bezierPresets.accelerate;
							break;
						case "out" :
							pathType = bezierPresets.decelerate;
							break;
						case "both" :
							pathType = bezierPresets.bubble;
							break;
						case "none" :
							pathType = bezierPresets.linear;
							break;
						default:
							pathType = bezierPresets.decelerate;
					}
				}else{
					pathType = bezierPresets.decelerate;
				}
				
				rgbHexToArray = function (rgbHex) {
				/*
				 *
				 * Simple RGB Hex to Array converter
				 *
				 */
					var color = [];
					rgbHex = rgbHex.replace("#", "");
					if (rgbHex.length == 3) {
						color[0] = parseInt(rgbHex.substr(0, 1) + rgbHex.substr(0, 1), 16);
						color[1] = parseInt(rgbHex.substr(1, 1) + rgbHex.substr(1, 1), 16);
						color[2] = parseInt(rgbHex.substr(2, 1) + rgbHex.substr(2, 1), 16);
					} else {
						color[0] = parseInt(rgbHex.substr(0, 2), 16);
						color[1] = parseInt(rgbHex.substr(2, 2), 16);
						color[2] = parseInt(rgbHex.substr(4, 2), 16);
					}
					return color;
				};
				circlePointsPrecalc = function () {
				/*
				 *
				 * Using an origin (x/y) and a radius, pre-calculate a high resolution circular path
				 * from which a quick lookup can be used to get the position of an object at n degrees.
				 *
				 * In standard animations, the bezier paths contain the actual values to be applied
				 * to an element's properties. In orbit animations, the bezier path is used as a key 
				 * to this generated circular path. 
				 *
				 */
					
					var CIRCLE_RESOLUTION = 45,
					tx, ty, itx, ity,
					n, nl, j, k, p, o, step = Math.PI / (CIRCLE_RESOLUTION * 4),
					applyOffsetsToOrigin;
					//alert(CIRCLE_RESOLUTION);
					
					applyOffsetsToOrigin = function (x, y) {
						// HELPER: apply x and y offsets to the origin point, getting final position
						x = (animations[i].origin[0] + x);
						y = (animations[i].origin[1] - y);
							//el.style.top = (o.origin[1] - value.y) + o.units;
						return {x: x, y: y};
					};
					
					animations[i].circlePreCache = []; // Memoizer
					
					o = animations[i].circlePreCache;
					
					// Circle Resolution is the number of fractions in an 8th of a circle
					// so for 360 degrees, circle resolution must be 45
					for(n = 0,nl = CIRCLE_RESOLUTION;n <= nl;n+=1){
						
						p = (step * n); // get the fraction of the value of PI
						
						if(typeof animations[i].radius !== 'number'){
							tx = Math.round(animations[i].radius[0] * Math.sin(p)); // x offset
							ty = Math.round(animations[i].radius[1] * Math.cos(p)); // y offset
						}else{
							tx = Math.round(animations[i].radius * Math.sin(p)); // x offset
							ty = Math.round(animations[i].radius * Math.cos(p)); // y offset
						}
						
						
						itx = tx * -1; // x offset inverted
						ity = ty * -1; // y offset inverted
						
						// If the loop ended here, you'd have just one eigth of the offsets
						// necessary for a circular path. Calculating the full circle,
						// however, is unnecessary. The offsets for the other 7/8ths of the 
						// circle can be derived by inverting offsets and flipping the x and y offsets
						// depending on the 8th of the circle you're attempting to populate.
						
						// j is for 'clockwise' 8ths, counting from 0 to CIRCLE_RESOLUTION.
						j = n;
						// k is for 'anti-clockwise' 8ths, counting down from CIRCLE_RESOLUTION to 0
						k = nl - n;
				
						//North North East
						o[j] = applyOffsetsToOrigin(tx, ty); // For values 0-44
						
						k+=nl; // We increment k by CIRCLE_RESOLUTION for values 45-89
						o[k] = applyOffsetsToOrigin(ty, tx);
						
						j+=(nl * 2); // We increment j to cover values 90-135
						o[j] = applyOffsetsToOrigin(ty, itx);
	
						k+=(nl * 2);
						o[k] = applyOffsetsToOrigin(tx, ity);
	
						j+=(nl * 2);
						o[j] = applyOffsetsToOrigin(itx, ity);
	
						k+=(nl * 2);
						o[k] = applyOffsetsToOrigin(ity, itx);
	
						j+=(nl * 2);
						o[j] = applyOffsetsToOrigin(ity, tx);
	
						k+=(nl * 2);
						o[k] = applyOffsetsToOrigin(itx, ty);
	
						
					}
		
				};
				stripUnits = function (str) {
				/*
				 *
				 * Remove units from a string and apply them to the animation object,
				 * returning the raw number only.
				 *
				 */
					var matches;
					if (typeof str === 'number'){
						animations[i].units = "px"; // the default;
						return str;
					}else{
						matches = str.match(/^([0-9\.\-]+)(px|em|)$/);
						animations[i].units = matches[2] || "px";
						return parseFloat(matches[1]);
					}
				};
				
				genericInitHandler = function () {
				/*
				 *
				 * For most transforms, a simple single bezier path is enough. 
				 * This creates the necessary transforms object
				 *
				 */
					animations[i].transforms[0] = initTransform(animations[i].startValue, animations[i].endValue);
					/*
					// Hopefully redundant code.... 
					animations[i].transforms[0] = {};
					animations[i].transforms[0].startValue = stripUnits(animations[i].startValue);
					animations[i].transforms[0].endValue = stripUnits(animations[i].endValue);
					animations[i].transforms[0].curve = [];
					 */
				};
				
				initTransform = function (start, end){
				/*
				 *
				 * Creates a transform object, containing start value, end value and a path array
				 *
				 */
					return { startValue : stripUnits(start), endValue : stripUnits(end), path : []};
				};
				
				//pathType = bezierPresets[o.pathType] || bezierPresets.decelerate;
				
				animations = o.animations; // TO DO: Validate animations object here!!!!!
	
				hideOverflow = function (el) {
				/*
				 *
				 * HELPER: Set overflow to hidden. This probably shouldn't be done by the tween function. 
				 *
				 */
					that.setStyle("overflow", "hidden");
				};
				
				absolutize = function (el) {
				/*
				 *
				 * HELPER: Set position to absolute. WHY?? This probably shouldn't be done by the tween function. 
				 *
				 */
					that.setStyle("position", "absolute");
				};
				
				// Create an array of 
				
				
	
				i = animations.length; 
				while (i--){ // Iterate for each animation
				
					var ani = animations[i];
					
					//var rgbHashRegex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/
					//var singleValueRegex = /^([\d]+|[\d]+(em|px))$/
					//var doubleValueRegex = /^([0-9\.]+\s[0-9\.]+|[0-9\.]+(px|em)\s[0-9]+(px|em))$/
					
					if(ani.radius && ani.origin){								
						// Actually just a single path transform. Am starting to see a pattern here.
						ani.transforms = [];
						genericInitHandler();
						
						ani.isOrbit = true;
						//this.each(absolutize); // Okay, without this it doesn't move!!		
												
						circlePointsPrecalc();
						
						//knickers = ani.circlePreCache;
					
					}else if(ani.handle && typeof ani.handle.getRawValuesAtFrame === 'function'){
					
						// How do we optimise this for step? 
					
					}else{
				
						ani.transforms = []; // create an array to hold transforms.
						switch (ani.property){
							case "height":
							case "width":
								// Single path tween
								genericInitHandler();
								this.each(hideOverflow); // Is this really the time and the place for this?
								break;
							case "left":
							case "right":
							case "top":
							case "bottom":
							case "borderWidth":
								// Single path tween
								genericInitHandler();
								this.each(absolutize); // Is this really the time and the place for this?
								break;
							case "color":
							case "backgroundColor":
							case "borderColor":
								// Three path tweens
								startValues = rgbHexToArray(ani.startValue);
								endValues = rgbHexToArray(ani.endValue);
								for(var m = 0; m < 3; m+=1){
									
									ani.transforms[m] = initTransform(startValues[m], endValues[m]);
		
								}
								break;
							case "backgroundPosition":
							case "size":
							case "position":
							case "boxShadow":
								// Two path tweens
								startValues = ani.startValue.split(' ');
								endValues = ani.endValue.split(' ');
								for(m = 0; m < 2; m+=1){
									ani.transforms[m] = initTransform(startValues[m], endValues[m]);
								}
								//knickers = ani;
								this.each(absolutize);
								break;
							default:
								genericInitHandler();
								break;
							
						}
					
					}
					delete(ani.startValue); // Why? 
					delete(ani.endValue); // Why?
				}
				
				bezier = {
					// Bezier Mathemetics helper functions. See http://en.wikipedia.org/wiki/B%C3%A9zier_curve
					B1: function (t)  { 
						return (t * t * t); 
					},		
					B2: function (t)  { 
						return (3 * t * t * (1 - t)); 
					},		
					B3: function (t)  { 
						return (3 * t * (1 - t) * (1 - t)); 
					},		
					B4: function (t)  { 
						return ((1 - t) * (1 - t) * (1 - t)); 
					}
				};
				getValueByPercent = function (percent, bez)  {
				/******
				 *
				 * HELPER: Using bezier maths, get the computed value of a point at n percent along the path
				 *
				 */
	
					var value = 0, b = bezier;
					// Voodoo Bezier curve mathematics.
					value = bez.p1 * b.B1(percent) + bez.p2 * b.B2(percent) + bez.p3 * b.B3(percent) + bez.p4 * b.B4(percent);
					//return (Math.round(value * 1000) / 1000); // Round to 2 decimal places
					return value;
				};
				
				preCalcTransforms = function ()  {
				/******
				 *
				 * HELPER: This is the actual meat of the tweening functionality. With the start value,
				 * end value and pathType configured, calculate the value for each point on the path
				 *
				 */
					var /* startValue, endValue, */ bez, i, j, m, difference;
					
					generateBezierCurve = function(startValue, endValue){
					/*
					*
				 	* HELPER: Use the bezierPreset to calculate the points along the path
				 	*
					*/
						var temp = [];
						//knickers = [];
						var l;
						bez = pathType(startValue, endValue);
						if (!bez) {
							// linear curve - identical increments between start and end
							// along the curve.
							//knickers = 'not bez';
							difference = endValue - startValue;
							
							l = (steps + 1);
							while(l--){
								if(difference){
								temp[l] = startValue + (difference * l / steps);
								}else{
								temp[l] = startValue;
								}
								//knickers[l] = (startValue + difference * (l / 100) * 1.0);
								
							}
						} else {
							// get the calculated value of each point along the bezier curve
							//knickers = 'bez';
							j = (steps + 1);
							while(j--){
								temp[j] = getValueByPercent((j / steps), bez);
							}
							
						}
						//knickers = temp;
						return temp;
					};
					
					i = animations.length;
					while(i--){
						if(!animations[i].handle){
							m = animations[i].transforms.length;
							while(m--){
								//startValue = animations[i].transforms[m].startValue;
								//endValue = animations[i].transforms[m].endValue;
								animations[i].transforms[m].path = generateBezierCurve(
									animations[i].transforms[m].startValue, 
									animations[i].transforms[m].endValue);	
								//knickers = 	animations[i].transforms[m].startValue;
								if(animations[i].isOrbit){
									j = (steps + 1);
									var t = animations[i].transforms;
									animations[i].transforms[1] = {};
									animations[i].transforms[1].path = [];
									while(j--){
										var values = animations[i].circlePreCache[Math.round(t[0].path[j])];
										t[0].path[j] = values.x;
										t[1].path[j] = values.y;
									}
								}
									
							}
						}
					}
		
				};	
				
				getElapsedPercent = function ()  {
				/*
				 *
				 * HELPER: Using the start time and the duration, calculate what percent through the the 
				 * animation we currently are. 
				 *
				 */
					//var dateObj = new Date(),
					elapsedTime = (new Date()).getTime() - startTime;
					
					var percent = Math.round(elapsedTime / (duration));
					//that.each(function (el) {
					//		el.innerHTML = diff + "ms";
					//});
					if (percent > steps) {
						percent = steps;
					}
					return percent;
					
				};
				
				stop = function () {
				/*
				 *
				 * PUBLIC: Stop the animation
				 *
				 */
					stopAnimation = true;
					return this;
				};
				
				start = function ( o )  {
				/*
				 *
				 * PUBLIC: Start the animation
				 *
				 */
					var d;
					
					stopAnimation = false;
					
					if(o){
						if(o.syncWith){
							startTime = o.syncWith.getStartTime();
							
						}
					}else{
						d = new Date();
						startTime = d.getTime();
					}
					
					timeoutID = setTimeout(step, 0);
					return this;
				};
				
				getStartTime = function () {
				/*
				 *
				 * PUBLIC: Get the start time of the tween object
				 *
				 */
				 
					return startTime;
				};
				
				getRawValuesAtFrame = function (p){
				/*
				 *
				 * PUBLIC: This is not yet implemented. Returns the stored tween values without drawing.
				 * This is intended to allow the generation of sine waves, etc, although there may well
				 * be other advanced uses. 
				 *
				 */
				};
				
				goToFrame = function (p, elapsedTime) {
				/******
				 *
				 * PUBLIC: Instead of using tweens built in timer methods, goToFrame allows the animator or
				 * UI programmer to 
				 *
				 */
					percent = p;
					for (i = 0; i < animations.length; i += 1) {
	
						if(animations[i].handle && elapsedTime){
							animations[i].handle.goToFrameAtTime(elapsedTime);
						}else if(updateHandlers[animations[i].property]){
							updateHandlers[animations[i].property](animations[i]);
						}else{
							updateHandlers.generic(animations[i]);
						}
						
					}
					return this;
				};
				goToFrameAtTime = function ( elapsedTime ) {
				
					//
					
					elapsedTime = elapsedTime % (duration * steps);
					
					var percent = Math.round(elapsedTime / duration);
					
					this.goToFrame(percent, elapsedTime);
				
				
				};
				var updateHandlers = {
					// Helper object containing functions called by step();	
					// They're called like this as an optimisation.			
					opacity : function (o) {
	
						var value = o.transforms[0].path[percent];
						//if(o.cache===value){
							// Value not changed. Do nothing.
						//}else{
							//o.cache = value;
						that.each(function (el)  {
							el.style.opacity = value / 100;
							el.style.filter = "alpha(opacity="+value+")";
	
						});
						//}
					},
					generic : function (o) {
						// Generic 
						var value = o.transforms[0].path[percent];
						if(o.units=="px"){
							value = Math.round(value); // rounding px values is necessary for IE??? *CHECK!!!*
						}
						that.each(function (el) {
							el.style[o.property] = value + o.units;
						});
					},
					genericColor : function (o){
						var i,hash ="#",value;
						for(i = 0;i < 3;i += 1){
							value = (Math.round(o.transforms[i].path[percent])).toString(16);
							if(value.length === 1){
								value = "0" + value;
							}
							hash += value;
						}
						that.each(function (el) {
							el.style[o.property] = hash;
						});
					},
					position : function (o) {
						// Not yet implemented... should it be?
						var value = {};
						value.x = o.transforms[0].path[percent];
						value.y = o.transforms[1].path[percent];
						
						that.each(function (el) {
							//el.innerHTML = percent;
							el.style.left = value.x + o.units;
							el.style.top = value.y + o.units;
							
						});
					},
					size : function (o) {
						var value = {};
						value.x = o.transforms[0].path[percent];
						value.y = o.transforms[1].path[percent];
						that.each(function (el) {
							
							el.style.width = value.x + o.units;
							el.style.height = value.y + o.units;
							
						});
					},
					backgroundPosition : function (o) {
						var value = {};
						value.x = o.transforms[0].path[percent];
						value.y = o.transforms[1].path[percent];
						that.each(function (el) {
							
							el.style.backgroundPosition = value.x + o.units + " " + value.y + o.units;
							
						});
					},
					rotate : function (o) {
						var value = o.transforms[0].path[percent];
						//if(o.units=="px"){
						//	value = Math.round(value); // rounding px values is necessary for IE??? *CHECK!!!*
						//}
						that.each(function (el) {
							el.style["-webkit-transform"] = "rotate("+value+"deg)";
							el.style.MozTransform = "rotate("+value+"deg)";
						});
					},
					color : function (o) {
						// Generate a hash code for the color...
						this.genericColor(o);
					},
					backgroundColor : function (o) {
						// Generate a hash code for the color...
						this.genericColor(o);
					},
					borderColor : function (o) {
						this.genericColor(o);
					}
				};
			
				step = function ()  {
				/*
				*
				* Helper: The Step Function is called by the timers.
				*
				*
				*/
					var i;
					
					if(timeoutID!==-1){
						clearTimeout(timeoutID);
					}
					
					percent = getElapsedPercent();
					
					if(reverse){
						percent = steps - percent;
					}
								
					for (i = 0; i < animations.length; i += 1) {
	
						if(animations[i].handle){
							animations[i].handle.goToFrameAtTime(elapsedTime);
						}else if(updateHandlers[animations[i].property]){
							updateHandlers[animations[i].property](animations[i]);
						}else{
							updateHandlers.generic(animations[i]);
						}
						
					}
					
					if ((!reverse && percent >= steps) || (reverse && percent <= 0)) {
		
						if (!loop) {
							// Animation Finished
							if (callback) {
								callback();
							}
						} else {
							
							if (stopAnimation !== true) {
								
								if(loop==='reverse' && reverse===false){
									//alert('beep');
									reverse=true;
								}else{
									//alert('boop');
									reverse=false;
								}
								//knickers = reverse;
											
								//d = new Date();
								startTime = startTime + (duration * steps);
								//endTime = startTime + (duration * 100);	
								//knickers = startTime;
								timeoutID = setTimeout(step, tick);
							} else {
								if (callback) {
									callback();	
								}	
							}
						
						}
					
					} else {
					
						timeoutID = setTimeout(step, tick);
					}
					
				};
				
				// Precalculate the transformations. 
				preCalcTransforms(); 
	
				return {
					// The methods available to the animation handle
					start : start,
					stop: stop,
					getRawValuesAtFrame : getRawValuesAtFrame,
					goToFrame : goToFrame,
					goToFrameAtTime : goToFrameAtTime,
					getStartTime : getStartTime
				};
				
			}
		
		});

		

		window.orbit = window.$orb = orbit;

})(window);

(function(window){
orbit.fn.extend({
	/**************
	 *
	 * EVENTS: This is just a wrapper for NW.Events. 
	 *
	 */
	on : function (e, func) { // Basic click handler
		var that = this;
		//this.funcs = [];
		//this.funcs[e] = func;
		
		this.each(function (el) {
			NW.Event.appendListener(el, e, func, false);
			//el.addEventListener(e, that.handleEvent, false);
			//if(!el.events){
			//	el.events = {};
			//}
			//el.events[e] = [];
			//el.events[e].push(func);
		});
		return this;
	},
	unbind : function (e, func) {
		var that = this;
		this.each(function (el) {
			NW.Event.removeListener(el, e, func);
		});
		return this;
	}
	});
	
})(window)
