'use strict';

var EventEmitter = require('events').EventEmitter;

/**
 * @param {HTMLCanvasElement} container
 * @param {object} [options]
 * @param {object} [options.position] { x: 0, y: 0 }
 * @param {number} [options.radius] radius
 * @param {string} [options.fillRadius] background radius color
 * @param {string} [options.fill] background color
 * @param {number} [options.stroke] border color
 * @param {number} [options.strokeWidth] border width
 * @class
 */
var Circle = function(container, options) {
  options = options || {};

  this._radius = options.radius || 100;
  this._fillRadius = options.fillRadius || 'rgba(0,0,0,0.1)';
  this._fill = options.fill || 'rgba(0,0,0,0.1)';
  this._stroke = options.stroke || 'rgba(0,0,0,0.1)';
  this._strokeWidth = options.strokeWidth || 3;
  this._x = options.position ? options.position.x : 0;
  this._y = options.position ? options.position.y : 0;

  this._container = container;
  this._el = null;
  this._ev = new EventEmitter();

  bindHandlers(this);
};

function bindHandlers(context) {
  for (var i in context) {
    if (typeof context[i] === 'function' && i.indexOf('_on') === 0) {
      context[i] = context[i].bind(context);
    }
  }
}

/*
 * @param {Event} e
 * @returns {object}
 */
Circle.prototype._getCoordFromEvent = function(e) {
  var rect = this._container.getBoundingClientRect();
  e = e.touches ? e.touches[0] : e;
  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top
  };
};

Circle.prototype._onDown = function(e) {
  if (this._active) return;
  if (e.touches) {
    document.addEventListener('touchmove', this._onMove);
    document.addEventListener('touchend', this._onTouchEnd);
  } else {
    document.addEventListener('mousemove', this._onMove);
    document.addEventListener('mouseup', this._onMouseUp);
    document.addEventListener('keydown', this._onKeyDown);
  }

  this._active = false;
  this._startPixel = this._getCoordFromEvent(e);
  this.fire('start', {
    start: this._startPixel
  });
};

Circle.prototype._onKeyDown = function(e) {
  if (e.keyCode === 27) { // ESC
    this._active = false;
    this.clear();
  }
};

/**
 * Draws the circle on the document.
 */
Circle.prototype.draw = function() {
  if (!this._el) {
    this._el = document.createElement('div');
    this._el.style.backgroundColor = this._fill;
    this._el.style.borderStyle = 'solid';
    this._el.style.borderColor = this._stroke;
    this._el.style.borderWidth = this._strokeWidth + 'px';
    this._el.style.borderRadius = '50%';
    this._el.style.display = 'absolute';
    this._el.style.boxShadow = '0 0 0 ' + this._radius + 'px ' + this._fillRadius;
    this._el.style.top = 0;
    this._el.style.left = 0;
    this._el.style.width = '10px';
    this._el.style.height = '10px';
    var pos = 'translate(' + this._x + 'px,' + this._y + 'px)';
    this._el.style.transform = pos;
    this._el.style.WebkitTransform = pos;
    this._container.appendChild(this._el);
  }

  return this;
};

Circle.prototype._onMove = function(e) {
  if (!this._active) this._active = true;

  this._currentPixel = this._getCoordFromEvent(e);

  if (!this._el) this.draw();

  var x = this._currentPixel.x;
  var y = this._currentPixel.y;
  var pos = 'translate(' + x + 'px,' + y + 'px)';

  this._el.style.transform = pos;
  this._el.style.WebkitTransform = pos;

  this.fire('move', {
    start: this._startPixel,
    current: this._currentPixel
  });

  e.preventDefault();
};

Circle.prototype._onTouchEnd = function() {
  this._onUp();
  document.removeEventListener('touchmove', this._onMove);
  document.removeEventListener('touchend', this._onTouchEnd);
};

Circle.prototype._onMouseUp = function() {
  this._onUp();
  document.removeEventListener('mousemove', this._onMove);
  document.removeEventListener('mouseup', this._onMouseUp);
  document.removeEventListener('keydown', this._onKeyDown);
};

Circle.prototype._onUp = function() {
  if (!this._active) return;
  this._active = false;
  this.fire('result', {
    start: this._startPixel,
    end: this._currentPixel
  });
};

/**
 * Erases all the pixels on the canvas
 */
Circle.prototype.clear = function() {
  if (this._el) {
    this._el.parentElement.removeChild(this._el);
    this._el = null;
  }

  return this;
};

/**
 * Enable drawing interaction
 */
Circle.prototype.enable = function() {
  this._el.addEventListener('mousedown', this._onDown);
  this._el.addEventListener('touchstart', this._onDown);
  return this;
};

/**
 * Disable drawing interaction
 */
Circle.prototype.disable = function() {
  this._el.removeEventListener('mousedown', this._onDown);
  this._el.removeEventListener('touchstart', this._onDown);
  return this;
};

/**
 * @param {string} color
 */
Circle.prototype.setFill = function(color) {
  this._fill = color;
};

/**
 * @param {number} n radius
 */
Circle.prototype.setRadius = function(n) {
  this._radius = n;
};

/**
 * @param {string} color radius fill
 */
Circle.prototype.setRadiusFill = function(color) {
  this._fillRadius = color;
};

/**
 * @param {string} color stroke color
 */
Circle.prototype.setStroke = function(color) {
  this._stroke = color;
};

/**
 * @param {number} strokeWidth
 */
Circle.prototype.setStrokeWidth = function(n) {
  this._strokeWidth = n;
};

/**
 * Subscribe to events
 * @param {String} type name of event. Available events and the data passed into their respective event objects are:
 * @returns {Circle} this;
 */
Circle.prototype.on = function(type, fn) {
  this._ev.on(type, fn);
  return this;
};

/**
 * Fire an event
 * @param {String} type event name.
 * @param {Object} data event data to pass to the function subscribed.
 * @returns {Circle} this
 */
Circle.prototype.fire = function(type, data) {
  this._ev.emit(type, data);
  return this;
};

/**
 * Remove an event
 * @param {String} type Event name.
 * @param {Function} fn Function that should unsubscribe to the event emitted.
 * @returns {Circle} this
 */
Circle.prototype.off = function(type, fn) {
  this._ev.removeListener(type, fn);
  return this;
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Circle;
} else {
  window.Circle = Circle;
}
