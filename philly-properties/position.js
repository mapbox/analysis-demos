'use strict';

var EventEmitter = require('events').EventEmitter;

/**
 * @param {HTMLCanvasElement} canvas
 * @param {object} [options]
 * @param {number} [options.fill] box background color
 * @param {number} [options.stroke] box border color
 * @param {number} [options.strokeWidth] box border width
 * @class
 */
var Box = function(canvasEl, options) {
  options = options || {};

  this._fill = options.fill || 'rgba(0,0,0,0.1)';
  this._stroke = options.stroke || 'rgba(0,0,0,0.1)';
  this._strokeWidth = options.strokeWidth || 3;

  this._el = canvasEl;
  this._boxEl = null;

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
Box.prototype._getCoordFromEvent = function(e) {
  var rect = this._el.getBoundingClientRect();
  e = e.touches ? e.touches[0] : e;
  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top
  };
};

Box.prototype._onDown = function(e) {
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
};

Box.prototype._onKeyDown = function(e) {
  if (e.keyCode === 27) { // ESC
    this._active = false;
    this.clear();
  }
};

Box.prototype._onMove = function(e) {
  if (!this._active) this._active = true;

  this._currentPixel = this._getCoordFromEvent(e);

  if (!this._boxEl) {
    this._boxEl = document.createElement('div');
    this._boxEl.style.backgroundColor = this._fill;
    this._boxEl.style.borderStyle = 'solid';
    this._boxEl.style.borderColor = this._stroke;
    this._boxEl.style.borderWidth = this._strokeWidth + 'px';
    this._boxEl.style.display = 'absolute';
    this._boxEl.style.top = 0;
    this._boxEl.style.left = 0;
    this._el.appendChild(this._boxEl);
  }

  var minX = Math.min(this._startPixel.x, this._currentPixel.x),
  maxX = Math.max(this._startPixel.x, this._currentPixel.x),
  minY = Math.min(this._startPixel.y, this._currentPixel.y),
  maxY = Math.max(this._startPixel.y, this._currentPixel.y);

  var pos = 'translate(' + minX + 'px,' + minY + 'px)';

  this._boxEl.style.transform = pos;
  this._boxEl.style.WebkitTransform = pos;
  this._boxEl.style.width = (maxX - minX) + 'px';
  this._boxEl.style.height = (maxY - minY) + 'px';

  e.preventDefault();
};

Box.prototype._onTouchEnd = function() {
  this._onUp();
  document.removeEventListener('touchmove', this._onMove);
  document.removeEventListener('touchend', this._onTouchEnd);
};

Box.prototype._onMouseUp = function() {
  this._onUp();
  document.removeEventListener('mousemove', this._onMove);
  document.removeEventListener('mouseup', this._onMouseUp);
  document.removeEventListener('keydown', this._onKeyDown);
};

Box.prototype._onUp = function() {
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
Box.prototype.clear = function() {
  if (this._boxEl) {
    this._boxEl.parentElement.removeChild(this._boxEl);
    this._boxEl = null;
  }

  return this;
};

/**
 * Enable drawing interaction
 */
Box.prototype.enable = function() {
  this._el.addEventListener('mousedown', this._onDown);
  this._el.addEventListener('touchstart', this._onDown);
  return this;
};

/**
 * Disable drawing interaction
 */
Box.prototype.disable = function() {
  this._el.removeEventListener('mousedown', this._onDown);
  this._el.removeEventListener('touchstart', this._onDown);
  return this;
};

/**
 * @param {string} fill
 */
Box.prototype.setFill = function(color) {
  this._fill = color;
};

/**
 * @param {string} stroke
 */
Box.prototype.setStroke = function(color) {
  this._stroke = color;
};

/**
 * @param {number} strokeWidth
 */
Box.prototype.setStrokeWidth = function(n) {
  this._strokeWidth = n;
};

/**
 * Subscribe to events
 * @param {String} type name of event. Available events and the data passed into their respective event objects are:
 * @returns {Box} this;
 */
Box.prototype.on = function(type, fn) {
  this._ev.on(type, fn);
  return this;
};

/**
 * Fire an event
 * @param {String} type event name.
 * @param {Object} data event data to pass to the function subscribed.
 * @returns {Box} this
 */
Box.prototype.fire = function(type, data) {
  this._ev.emit(type, data);
  return this;
};

/**
 * Remove an event
 * @param {String} type Event name.
 * @param {Function} fn Function that should unsubscribe to the event emitted.
 * @returns {Box} this
 */
Box.prototype.off = function(type, fn) {
  this._ev.removeListener(type, fn);
  return this;
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Box;
} else {
  window.Box = Box;
}
