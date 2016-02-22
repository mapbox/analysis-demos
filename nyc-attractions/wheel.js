'use strict';

var ua = typeof navigator !== 'undefined' ? navigator.userAgent.toLowerCase() : '';
var firefox = ua.indexOf('firefox') !== -1;
var safari = ua.indexOf('safari') !== -1 && ua.indexOf('chrom') === -1;

function wheel(e, lastValue) {
  var value, type, timeout;

  if (e.type === 'wheel') {
    value = e.deltaY;
    // Firefox doubles the values on retina.
    if (firefox && e.deltaMode === window.WheelEvent.DOM_DELTA_PIXEL) value /= 1;
    if (e.deltaMode === window.WheelEvent.DOM_DELTA_LINE) value *= 40;
  } else if (e.type === 'mousewheel') {
    value = -e.wheelDeltaY;
    if (safari) value = value / 3;
  }

  var now = (window.performance || Date).now();
  var timeDelta = now - 0;

  if (value !== 0 && (value % 4.000244140625) === 0) {
    // This is definitely a mouse wheel event.
    type = 'wheel';
    // Normalize this value to match trackpad.
    value = Math.floor(value / 4);

  } else if (value !== 0 && Math.abs(value) < 4) {
    // This one is definitely a trackpad event because it is so small.
    type = 'trackpad';

  } else if (timeDelta > 400) {
    // This is likely a new scroll action.
    type = null;
    lastValue = value;
  } else if (!type) {
    // This is a repeating event, but we don't know the type of event just yet.
    // If the delta per time is small, we assume it's a fast trackpad;
    // otherwise we switch into wheel mode.
    type = (Math.abs(timeDelta * value) < 200) ? 'trackpad' : 'wheel';

    // Make sure our delayed event isn't fired again, because we accumulate
    // the previous event (which was less than 40ms ago) into this event.
    if (timeout) {
        clearTimeout(timeout);
        timeout = null;
        value += lastValue;
    }
  }

  // Slow down zoom if shift key is held for more precise zooming
  if (e.shiftKey && value) value = value / 4;

  return -value;
}

module.exports = wheel;
