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
var Position = function(canvasEl) {
  this._el = canvasEl;
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
Position.prototype._getCoordFromEvent = function(e) {
  var rect = this._el.getBoundingClientRect();
  e = e.touches ? e.touches[0] : e;
  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top
  };
};

Position.prototype._onDown = function(e) {
  if (this._active) return;
  if (e.touches) {
    document.addEventListener('touchmove', this._onMove);
    document.addEventListener('touchend', this._onTouchEnd);
  } else {
    document.addEventListener('mousemove', this._onMove);
    document.addEventListener('mouseup', this._onMouseUp);
  }

  this._active = false;
  this._startPixel = this._getCoordFromEvent(e);
  this.fire('start', {
    start: this._startPixel
  });
};

Position.prototype._onMove = function(e) {
  if (!this._active) this._active = true;
  this._currentPixel = this._getCoordFromEvent(e);
  this.fire('move', {
    start: this._startPixel,
    current: this._currentPixel
  });
  e.preventDefault();
};

Position.prototype._onTouchEnd = function() {
  this._onUp();
  document.removeEventListener('touchmove', this._onMove);
  document.removeEventListener('touchend', this._onTouchEnd);
};

Position.prototype._onMouseUp = function() {
  this._onUp();
  document.removeEventListener('mousemove', this._onMove);
  document.removeEventListener('mouseup', this._onMouseUp);
  document.removeEventListener('keydown', this._onKeyDown);
};

Position.prototype._onUp = function() {
  if (!this._active) return;
  this._active = false;
  this.fire('result', {
    start: this._startPixel,
    end: this._currentPixel
  });
};

/**
 * Enable drawing interaction
 */
Position.prototype.enable = function() {
  this._el.addEventListener('mousedown', this._onDown);
  this._el.addEventListener('touchstart', this._onDown);
  return this;
};

/**
 * Disable drawing interaction
 */
Position.prototype.disable = function() {
  this._el.removeEventListener('mousedown', this._onDown);
  this._el.removeEventListener('touchstart', this._onDown);
  return this;
};

/**
 * Subscribe to events
 * @param {String} type name of event. Available events and the data passed into their respective event objects are:
 * @returns {Position} this;
 */
Position.prototype.on = function(type, fn) {
  this._ev.on(type, fn);
  return this;
};

/**
 * Fire an event
 * @param {String} type event name.
 * @param {Object} data event data to pass to the function subscribed.
 * @returns {Position} this
 */
Position.prototype.fire = function(type, data) {
  this._ev.emit(type, data);
  return this;
};

/**
 * Remove an event
 * @param {String} type Event name.
 * @param {Function} fn Function that should unsubscribe to the event emitted.
 * @returns {Position} this
 */
Position.prototype.off = function(type, fn) {
  this._ev.removeListener(type, fn);
  return this;
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Position;
} else {
  window.Position = Position;
}
