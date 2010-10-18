/*
 * Copyright (C) 2005-2009 Diego Perini
 * All rights reserved.
 *
 * nwevents.js - Javascript Event Manager
 *
 * Author: Diego Perini <diego.perini at gmail com>
 * Version: 1.2.3
 * Created: 20051016
 * Release: 20091231
 *
 * License:
 *  http://javascript.nwbox.com/NWEvents/MIT-LICENSE
 * Download:
 *  http://javascript.nwbox.com/NWEvents/nwevents.js
 */

window.NW || (window.NW = {});

NW.Event = (function(global) {

  var version = 'nwevents-1.2.3',

  // default to DOM2
  USE_DOM2 = true,

  // event phases constants
  CAPTURING_PHASE = 1, AT_TARGET = 2, BUBBLING_PHASE = 3,

  // event collections and predefined DOM0 register
  Handlers = { }, Delegates = { }, Listeners = { }, Predefined = { },

  // initial script load context
  viewport = global, context = global.document, root = context.documentElement,

  EventCollection =
    function() {
      return {
        items: [],
        calls: [],
        parms: [],
        wraps: []
      };
    },

  /* ============================ FEATURE TESTING =========================== */

  // detect activation capabilities,
  // currently FF3, Opera and IE
  hasActive = 'activeElement' in context ?
    (function() {
      try {
        context.activeElement = null;
        return null === context.activeElement;
      } catch(e) {
        return false;
      }
    }) : true,

  // detect native methods
  isNative = (function() {
    var s = (global.open + '').replace(/open/g, '');
    return function(object, method) {
      var m = object ? object[method] : false, r = new RegExp(method, 'g');
      return !!(m && typeof m != 'string' && s === (m + '').replace(r, ''));
    };
  })(),

  // detect event model in use
  W3C_MODEL = root.addEventListener && root.removeEventListener ? true : false,
  MSIE_MODEL = root.attachEvent && root.detachEvent ? true : false,

  /* ============================ UTILITY METHODS =========================== */

  // get document from element
  getDocument =
    function(e) {
      return e.ownerDocument || e.document || e;
    },

  // get window from document
  getWindow = 'parentWindow' in top.document ?
    function(d) {
      return d.parentWindow || window;
    } : 'defaultView' in top.document && top === top.document.defaultView ?
    function(d) {
      return d.defaultView || window;
    } :
    function(d) {
      // fix for older Safari 2.0.x returning
      // [object AbstractView] instead of [window]
      if (window.frames.length === 0 && top.document === d) {
        return top;
      } else {
        for (var i in top.frames) {
          if (top.frames[i].document === d) {
            return top.frames[i];
          }
        }
      }
      return top;
    },

  // fix IE event properties to comply with w3c standards
  fixEvent =
    function(element, event, capture) {
      // needed for DOM0 events
      event || (event = getWindow(getDocument(element)).event);
      // bound element (listening the event)
      event.currentTarget = element;
      // fired element (triggering the event)
      event.target = event.srcElement || element;
      // add preventDefault and stopPropagation methods
      event.preventDefault = preventDefault;
      event.stopPropagation = stopPropagation;
      // bound and fired element are the same AT_TARGET
      event.eventPhase = capture ? CAPTURING_PHASE : BUBBLING_PHASE;
      // related element (routing of the event)
      event.relatedTarget =
        event[(event.target == event.fromElement ? 'to' : 'from') + 'Element'];
      // set time event was fixed
      event.timeStamp=+new Date();
      return event;
    },

  // prevent default action
  preventDefault =
    function() {
      this.returnValue = false;
    },

  // stop event propagation
  stopPropagation =
    function() {
      this.cancelBubble = true;
    },

  // block any further event processing
  stop =
    function(event) {
      if (event.preventDefault) {
        event.preventDefault();
      } else {
        event.returnValue = false;
      }
      if (event.stopPropagation) {
        event.stopPropagation();
      } else {
        event.cancelBubble = true;
      }
      return false;
    },

  // check collection for registered event,
  // match element, handler and capture
  isRegistered =
    function(registry, element, type, handler, capture) {
      var i, l, found = false;
      if (registry[type] && registry[type].items) {
        for (i = 0, l = registry[type].items.length; l > i; i++) {
          if (
            registry[type].items[i] === element &&
            registry[type].calls[i] === handler &&
            registry[type].parms[i] === capture) {
            found = i;
            break;
          }
        }
      }
      return found;
    },

  // list event handlers bound to
  // a given object for each type
  getRegistered =
    function(object, type, register) {
      var i, j, l, results = [ ];
      type || (type = '*');
      object || (object = '*');
      register || (register = Listeners);
      for (i in register) {
        if (type.indexOf(i) > -1 || type == '*') {
          for (j = 0, l = register[i].items.length; j < l; j++) {
            if (register[i].items[j] === object || object == '*') {
              results.push(register[i].calls[j]);
            }
          }
        }
      }
      return results;
    },

  // handle listeners chain for event type
  handleListeners =
    function(event) {
      var i, l, result = true,
        items, calls, parms, phase,
        type = event.type, valid;

      if (Listeners[type] && Listeners[type].items) {

        // cache eventPhase access
        phase = event.eventPhase;

        if (!event.propagated && FormActivationEvents[type]) {
          if (event.preventDefault) event.preventDefault();
          else event.returnValue = false;
          return true;
        }

        // only AT_TARGET event.target === event.currentTarget
        if (phase !== AT_TARGET && event.target === this) {
          phase = event.eventPhase = AT_TARGET;
        }

        // make a copy of the Listeners[type] array
        // since it can be modified run time by the
        // events deleting themselves or adding new
        items = Listeners[type].items.slice();
        calls = Listeners[type].calls.slice();
        parms = Listeners[type].parms.slice();

        // process chain in fifo order
        for (i = 0, l = items.length; l > i; i++) {
          valid = false;
          if (items[i] === this) {
            switch (phase) {
              case CAPTURING_PHASE:
                if (!event.propagated || parms[i] === true) {
                  valid = true;
                }
                break;
              case BUBBLING_PHASE:
                if (parms[i] === false) {
                  valid = true;
                }
                break;
              case AT_TARGET:
                if (!event.propagated || parms[i] === true) {
                  valid = true;
                }
                break;
              // Safari load events have eventPhase == 0
              default:
                valid = true;
                break;
            }
          }
          if (valid && (result = calls[i].call(this, event)) === false) break;
        }

      }

      return result;
    },

  // handle delegates chain for event type
  handleDelegates =
    function(event) {
      var i, l,
        items, calls, parms, target,
        result = true, type = event.type;

      if (Delegates[type] && Delegates[type].items) {

        // make a copy of the Delegates[type] array
        // since it can be modified run time by the
        // events deleting themselves or adding new
        items = Delegates[type].items.slice();
        calls = Delegates[type].calls.slice();
        parms = Delegates[type].parms.slice();

        // process chain in fifo order
        bubblingLoop:
        for (i = 0, l = items.length; l > i; i++) {
          // if event.target matches one of the registered elements and
          // if "this" element matches one of the registered delegates
          target = event.target;
          // bubble events up to parent nodes
          while (target && target != this) {
            if (NW.Dom.match(target, items[i])) {
              // execute registered function in element scope
              if (calls[i].call(target, event) === false) {
                result = false;
                break bubblingLoop;
              }
            }
            target = target.parentNode;
          }
        }

      }

      return result;
    },

  // append element handler to the registry
  // used by handlers, listeners, delegates
  appendItem =
    function(registry, element, type, handler, capture) {
      // registry is a reference to an EventCollection,
      // actually supported Handler, Listeners, Delegates
      registry[type] || (registry[type] = new EventCollection);
      // append handler to the registry
      registry[type].items.push(element);
      registry[type].calls.push(handler);
      registry[type].parms.push(capture);
    },

  // remove element handler from the registry
  // used by handlers, listeners, delegates
  removeItem =
    function(registry, type, key) {
      // remove handler from the registry
      registry[type].items.splice(key, 1);
      registry[type].calls.splice(key, 1);
      registry[type].parms.splice(key, 1);
    },

  // lazy definition for addEventListener / attachEvent
  appendEvent = W3C_MODEL && USE_DOM2 ?
    function(element, type, handler, capture) {
      // use DOM2 event registration
      element.addEventListener(type, handler, capture || false);
    } : MSIE_MODEL && USE_DOM2 ?
    function(element, type, handler, capture) {
      // use MSIE event registration
      var key = Handlers[type].wraps.push(function(event) {
        return handler.call(element, fixEvent(element, event, capture));
      });
      element.attachEvent('on' + type, Handlers[type].wraps[key - 1]);
    } :
    function(element, type, handler, capture) {
      Predefined['on' + type] = element['on' + type] || new Function();
      // use DOM0 event registration
      element['on' + type] = function(event) {
        var result;
        event || (event = fixEvent(this, event, capture));
        result = handler.call(this, event);
        Predefined['on' + type].call(this, event);
        return result;
      };
    },

  // lazy definition for removeEventListener / detachEvent
  removeEvent = W3C_MODEL && USE_DOM2 ?
    function(element, type, handler, capture) {
      // use DOM2 event registration
      element.removeEventListener(type, handler, capture || false);
    } : MSIE_MODEL && USE_DOM2 ?
    function(element, type, handler, capture, key) {
      // use MSIE event registration
      element.detachEvent('on' + type, handler);
      Handlers[type].wraps.splice(key, 1);
    } :
    function(element, type, handler, capture) {
      // use DOM0 event registration
      element['on' + type] = Predefined['on' + type];
      delete Predefined['on' + type];
    },

  // append an event handler
  appendHandler =
    function(element, type, handler, capture) {
      var i, k, l, types;
      if (typeof type == 'string') {
        types = type.split(' ');
        for (i = 0, l = types.length; i < l; i++) {
          k = isRegistered(Handlers, element, types[i], handler, capture);
          if (k === false) {
            appendItem(Handlers, element, types[i], handler, capture);
            appendEvent(element, types[i], handler, capture);
          }
        }
      } else {
        // a hash of "rules" containing type-handler pairs
        for (i in type) {
          appendHandler(element, i, type[i], capture);
        }
      }
      return this;
    },

  // remove an event handler
  removeHandler =
    function(element, type, handler, capture) {
      var i, k, l, types;
      if (typeof type == 'string') {
        types = type.split(' ');
        for (i = 0, l = types.length; i < l; i++) {
          k = isRegistered(Handlers, element, types[i], handler, capture);
          if (k !== false) {
            removeEvent(element, types[i], Handlers[types[i]].wraps[k], capture, k);
            removeItem(Handlers, types[i], k);
          }
        }
      } else {
        // a hash of "rules" containing type-handler pairs
        for (i in type) {
          removeHandler(element, i, type[i], capture);
        }
      }
      return this;
    },

  // append an event listener
  appendListener =
    function(element, type, handler, capture) {
      var i, k, l, types;
      if (typeof type == 'string') {
        types = type.split(' ');
        for (i = 0, l = types.length; i < l; i++) {
          k = isRegistered(Listeners, element, types[i], handler, capture);
          if (k === false) {
            appendItem(Listeners, element, types[i], handler, capture);
            if (getRegistered(element, types[i], Listeners).length === 1) {
              appendHandler(element, types[i], handleListeners, capture);
            }
          }
        }
      } else {
        // a hash of "rules" containing type-handler pairs
        for (i in type) {
          appendListener(element, i, type[i], capture);
        }
      }
      return this;
    },

  // remove an event listener
  removeListener =
    function(element, type, handler, capture) {
      var i, k, l, types;
      if (typeof type == 'string') {
        types = type.split(' ');
        for (i = 0, l = types.length; i < l; i++) {
          k = isRegistered(Listeners, element, types[i], handler, capture);
          if (k !== false) {
            if (getRegistered(element, types[i], Listeners).length === 1) {
              removeHandler(element, types[i], handleListeners, capture);
            }
            removeItem(Listeners, types[i], k);
          }
        }
      } else {
        // a hash of "rules" containing type-handler pairs
        for (i in type) {
          removeListener(element, i, type[i], capture);
        }
      }
      return this;
    },

  // append an event delegate
  appendDelegate =
    // with iframes pass a delegate parameter
    // "delegate" defaults to documentElement
    function(selector, type, handler, delegate) {
      var i, j, k, l, types;
      if (typeof selector == 'string') {
        types = type.split(' ');
        delegate = delegate || root;
        for (i = 0, l = types.length; i < l; i++) {
          k = isRegistered(Delegates, selector, types[i], handler, delegate);
          if (k === false) {
            appendItem(Delegates, selector, types[i], handler, delegate);
            if (Delegates[types[i]].items.length === 1) {
              appendListener(delegate, types[i], handleDelegates, true);
            }
          }
        }
      } else {
        // a hash of "rules" containing selector-event-handler
        for (i in selector) {
          if (typeof i == 'string') {
            for (j in selector[i]) {
              appendDelegate(i, j, selector[i][j]);
            }
          }
        }
      }
      return this;
    },

  // remove an event delegate
  removeDelegate =
    // with iframes pass a delegate parameter
    // "delegate" defaults to documentElement
    function(selector, type, handler, delegate) {
      var i, j, k, l, types;
      if (typeof type == 'string') {
        types = type.split(' ');
        delegate = delegate || root;
        for (i = 0, l = types.length; i < l; i++) {
          k = isRegistered(Delegates, selector, types[i], handler, delegate);
          if (k !== false) {
            if (Delegates[types[i]].items.length === 1) {
              removeListener(delegate, types[i], handleDelegates, true);
            }
            removeItem(Delegates, types[i], k);
          }
        }
      } else {
        // hash of "rules" containing selector-event-handler
        for (i in selector) {
          if (typeof i == 'string') {
            for (j in selector[i]) {
              removeDelegate(i, j, selector[i][j]);
            }
          }
        }
      }
      return this;
    },

  // programatically dispatch native or custom events
  dispatch = root.dispatchEvent ?
    // W3C event model
    function(element, type, capture) {
      var event, d = getDocument(element), w = getWindow(d);
      if (/mouse|click/.test(type)) {
        try {
          event = d.createEvent('MouseEvents');
          event.initMouseEvent(type, true, true, w, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
        } catch(e) {
          event = d.createEvent('HTMLEvents');
          event.initEvent(type, true, true);
        }
      } else if (/key(down|press|out)/.test(type)) {
        event = d.createEvent('KeyEvents');
        event.initKeyEvent(type, true, true, w, false, false, false, false, 0, 0);
      } else {
        event = d.createEvent('HTMLEvents');
        event.initEvent(type, true, true);
      }
      // dispatch event type to element
      return element.dispatchEvent(event);
    } : root.fireEvent ?
    // IE event model
    function(element, type, capture) {
      var event, d = getDocument(element);
      event = d.createEventObject();
      event.type = type;
      event.target = element;
      event.eventPhase = 0;
      event.currentTarget = element;
      event.cancelBubble= !!capture;
      event.returnValue= undefined;
      // fire event type on element
      return element.fireEvent('on' + type, fixEvent(element, event, capture));
    } :
    // try manual dispatch
    function(element, type, capture) {
      // (TODO)
    },

  /* =========================== EVENT PROPAGATION ========================== */

  //
  // known available activation events:
  //
  // Internet Explorer:
  //   focusin, focusout, activate, deactivate,
  //   beforeactivate, beforedeactivate
  //
  // FF/Opera/Safari/K:
  //   DOMActivate, DOMFocusIn, DOMFocusOut
  //
  // DOM0/1 and inline:
  //   focus, blur
  //
  // we use just a few of them to emulate the capturing
  // and bubbling phases of the focus and blur events
  // where not available or named/used differently
  //
  ActivationMap = {
    'blur': 'blur',
    'focus': 'focus',
/*
    'focusin': 'focus',
    'focusout': 'blur',
    'activate': 'focus',
    'deactivate': 'blur',
    'DOMFocusIn': 'focus',
    'DOMFocusOut': 'blur',
*/
    'beforeactivate': 'focus',
    'beforedeactivate': 'blur'
  },

  FormActivationEvents = {
    blur: 1,
    focus: 1,
    reset: 1,
    submit: 1,
    change: 1
  },

  FormAction = 'keydown mousedown',
  Activation = context.addEventListener ?
    'focus blur' : 'beforeactivate beforedeactivate',

  // create a synthetic event
  synthesize =
    function(element, type, capture) {
      return {
        type: type,
        target: element,
        bubbles: true,
        cancelable: true,
        currentTarget: element,
        relatedTarget: null,
        timeStamp: +new Date(),
        preventDefault: preventDefault,
        stopPropagation: stopPropagation,
        eventPhase: capture ? CAPTURING_PHASE : BUBBLING_PHASE
      };
    },

  // propagate events traversing the
  // ancestors path in both directions
  propagate =
    function(event) {
      var result = true, target = event.target, type = event.type;
      // execute the capturing phase
      result && (result = propagatePhase(target, type, true));
      // execute the bubbling phase
      result && (result = propagatePhase(target, type, false));
      // remove the trampoline event
      removeHandler(target, type, propagate, false);
      // submit/reset events relayed to parent forms
      if (target.form) { target = target.form; }
      // execute existing native methods if not overwritten
      result && isNative(target, type) && target[type]();
      // return flag
      return result;
    },

  // propagate event capturing or bubbling phase
  propagatePhase =
    function(element, type, capture) {
      var i, l,
        result = true,
        node = element, ancestors = [],
        event = synthesize(element, type, capture);
      // add synthetic flag
      event.propagated=true;
      // collect ancestors
      while(node.nodeType == 1) {
        ancestors.push(node);
        node = node.parentNode;
      }
      // capturing, reverse ancestors collection
      if (capture) ancestors.reverse();
      // execute registered handlers in fifo order
      for (i = 0, l = ancestors.length; l > i; i++) {
        // set currentTarget to current ancestor
        event.currentTarget = ancestors[i];
        // set eventPhase to the requested phase
        event.eventPhase = capture ? CAPTURING_PHASE : BUBBLING_PHASE;
        // execute listeners bound to this ancestor and set return value
        if (handleListeners.call(ancestors[i], event) === false || event.returnValue === false) {
          result = false;
          break;
        }
      }
      // remove synthetic flag
      delete event.propagated;
      return result;
    },

  // propagate activation events
  // captured/emulated activations
  // only applied to form elements
  propagateActivation =
    function(event) {
      var result = true, target = event.target;
      result && (result = propagatePhase(target, ActivationMap[event.type], true));
      result && (result = propagatePhase(target, ActivationMap[event.type], false));
      result || (event.preventDefault ? event.preventDefault() : (event.returnValue = false));
      return result;
    },

  // propagate form action events
  // mousedown and keydown events
  // only applied to form elements
  propagateFormAction =
    function(event) {
      var target = event.target, type = target.type;
      // handle activeElement on context document
      if (target != context.activeElement) {
        if (!hasActive && target.nodeType == 1) {
          context.activeElement = target;
          context.focusElement = null;
        }
      }
      // html form elements only
      if (type) {
        // handle focusElement on context document
        if (target != context.focusElement) {
          if (!hasActive) {
            context.focusElement = target;
          }
        }
        // keydown or mousedown on form elements
        if (/file|text|password/.test(type) &&
          event.keyCode == 13 && target.form) {
          type = 'submit';
          target = target.form;
        } else if (/select-(one|multi)/.test(type)) {
          type = 'change';
        } else if (/reset|submit/.test(type) && target.form) {
          target = target.form;
        } else {
          // action was on a form element but
          // no extra processing is necessary
          return;
        }
        appendHandler(target, type, propagate, false);
      }
    },

  // enable event propagation
  enablePropagation =
    function(context) {
      if (!context.forcedPropagation) {
        context.forcedPropagation = true;
        // deregistration on page unload
        appendHandler(getWindow(context), 'unload',
          function(event) {
            disablePropagation(context);
            // we are removing ourself here, so do it as last
            removeHandler(this, 'unload', arguments.callee, false);
          }, false);
        // register capturing keydown and mousedown event handlers
        appendHandler(context, FormAction, propagateFormAction, true);
        // register emulated capturing focus and blur event handlers
        appendHandler(context, Activation, propagateActivation, true);
      }
    },

  // disable event propagation
  disablePropagation =
    function(context) {
      if (context.forcedPropagation) {
        context.forcedPropagation = false;
        // deregister capturing keydown and mousedown event handlers
        removeHandler(context, FormAction, propagateFormAction, true);
        // deregister emulated capturing focus and blur event handlers
        removeHandler(context, Activation, propagateActivation, true);
      }
    },

  /* ========================== DOM CONTENT LOADED ========================== */

  //
  // available loading notification events:
  //
  // HTML5 + DOM2 FF/Opera/Safari/K:
  //   DOMContentLoaded, DOMFrameContentLoaded, onload
  //
  // MS Internet Explorer 6, 7 and 8:
  //   readyState, onreadystatchange, onload
  //
  // DOM0/1 and inline:
  //   onload
  //
  // we use a bad browser sniff just to find out the best
  // implementation/fallback for each of the old browsers
  // to support the standard HTML5 DOMContentLoaded event
  // http://www.whatwg.org/specs/web-apps/current-work/#the-end
  //

  isReady = false,

  readyHandlers = new EventCollection,

  onDOMReady =
    function(host, callback, scope) {
      if (isReady) {
        callback.call(scope);
      } else {
        var k = isRegistered(readyHandlers, host, 'ready', callback, null);
        if (k === false) {
          appendItem(readyHandlers, host, 'ready', callback, null);
        } else {
          throw new Error('NWEvents: duplicate ready handler for host: ' + host);
        }
      }
    },

  ready =
    function(host, callback, scope) {
      isReady = true;
      if (readyHandlers['ready'] && readyHandlers['ready'].items) {
        var i, length = readyHandlers['ready'].items.length;
        for (i = 0; length > i; ++i) {
          readyHandlers['ready'].calls[i].call(scope);
        }
      }
    },

  // Cross-browser wrapper for DOMContentLoaded
  // http://javascript.nwbox.com/ContentLoaded/ +
  // http://javascript.nwbox.com/IEContentLoaded/
  contentLoaded =
    function(host, callback, scope) {

      var done = false, size = 0,
        document = host.document,
        W3Type = 'DOMContentLoaded',
        MSType = 'onreadystatechange',
        root = document.documentElement;

      function init(event) {
        if (!done) {
          done = true;
          callback.call(scope, event);
        }
      }

      // W3C Event model
      if (document.addEventListener) {

        // browsers having native DOMContentLoaded
        function DOMContentLoaded(event) {
          document.removeEventListener(event.type, DOMContentLoaded, false);
          init(event);
        }
        document.addEventListener(W3Type, DOMContentLoaded, false);

        // onload fall back for older browsers
        host.addEventListener('load', DOMContentLoaded, false);

      // MSIE Event model (all versions)
      } else if (document.attachEvent) {

        function IEContentLoaded(event) {
          document.detachEvent(MSType, IEContentLoaded);
          function poll() {
            try {
              // throws errors until after ondocumentready
              root.doScroll('left');
              size = root.outerHTML.length;
              if (size * 1.03 < d.fileSize * 1) {
                return !done && setTimeout(poll, 50);
              }
            } catch (e) {
              return !done && setTimeout(poll, 50);
            }
            init({ type: 'poll' });
            return done;
          }
          poll();
        }
        document.attachEvent(MSType, IEContentLoaded);

        function IEReadyState(event) {
          if (document.readyState == 'complete') {
            document.detachEvent(MSType, IEReadyState);
            init(event);
          }
        }
        document.attachEvent(MSType, IEReadyState);
        document.attachEvent('load', IEReadyState);

      // fallback to last resort for older browsers
      } else {

        // from Simon Willison
        var oldonload = host.onload;
        host.onload = function (event) {
          init(event || host.event);
          if (typeof oldonload == 'function') {
            oldonload(event || host.event);
          }
        };

      }
    };

  // inititalize the activeElement
  // to a known cross-browser state
  if (!hasActive) {
    context.activeElement = root;
  }

  // initialize context propagation
  if (!context.forcedPropagation) {
    enablePropagation(context);
  }

  // initialize global ready event
  contentLoaded(global, ready);

  return {

    // controls the type of registration
    // for event listeners (DOM0 / DOM2)
    USE_DOM2: USE_DOM2,

    // exposed event methods

    stop: stop,

    dispatch: dispatch,

    onDOMReady: onDOMReady,

    contentLoaded: contentLoaded,

    getRegistered: getRegistered,

    appendHandler: appendHandler,

    removeHandler: removeHandler,

    appendListener: appendListener,

    removeListener: removeListener,

    appendDelegate: appendDelegate,

    removeDelegate: removeDelegate,

    // helpers and debugging functions

    enablePropagation: enablePropagation,

    disablePropagation: disablePropagation

  };

})(this);
/*
 * Copyright (C) 2007-2010 Diego Perini
 * All rights reserved.
 *
 * nwmatcher.js - A fast CSS selector engine and matcher
 *
 * Author: Diego Perini <diego.perini at gmail com>
 * Version: 1.2.2
 * Created: 20070722
 * Release: 20100407
 *
 * License:
 *  http://javascript.nwbox.com/NWMatcher/MIT-LICENSE
 * Download:
 *  http://javascript.nwbox.com/NWMatcher/nwmatcher.js
 */

(function(global) {

  var version = 'nwmatcher-1.2.2',

  // processing context
  doc = global.document,

  // context root element
  root = doc.documentElement,

  // persist last selector/matcher parsing data
  lastSlice = '',
  lastMatcher = '',
  lastSelector = '',
  isSingleMatch = false,
  isSingleSelect = false,

  // initialize selector/matcher loading context
  lastMatchContext = doc,
  lastSelectContext = doc,

  // http://www.w3.org/TR/css3-syntax/#characters
  // unicode/ISO 10646 characters 161 and higher
  // NOTE: Safari 2.0.x crashes with escaped (\\)
  // Unicode ranges in regular expressions so we
  // use a negated character range class instead
  encoding = '((?:[-\\w]|[^\\x00-\\xa0]|\\\\.)+)',

  // used to skip [ ] or ( ) groups in token tails
  skipgroup = '(?:\\[.*\\]|\\(.*\\))',

  // discard invalid chars found in passed selector
  reValidator = /^\s*(\*|[.:#](?:[a-zA-Z]|[^\x00-\xa0])+|[>+~a-zA-Z]|[^\x00-\xa0]|\[.*\]|\{.*\})/,

  // only five chars can occur in whitespace, they are:
  // \x20 \t \n \r \f, checks now uniformed in the code
  // http://www.w3.org/TR/css3-selectors/#selector-syntax
  reTrimSpaces = /^[\x20\t\n\r\f]+|[\x20\t\n\r\f]+$/g,

  // split comma groups, exclude commas in '' "" () []
  reSplitGroup = /([^,\\()[\]]+|\([^()]+\)|\(.*\)|\[(?:\[[^[\]]*\]|["'][^'"]*["']|[^'"[\]]+)+\]|\[.*\]|\\.)+/g,

  // split last, right most, selector group token
  reSplitToken = /([^ >+~,\\()[\]]+|\([^()]+\)|\(.*\)|\[[^[\]]+\]|\[.*\]|\\.)+/g,

  // for pseudos, ids and in excess whitespace removal
  reClassValue = /([-\w]+)/,
  reIdSelector = /\#([-\w]+)$/,
  reWhiteSpace = /[\x20\t\n\r\f]+/g,

  // match missing R/L context
  reLeftContext = /^\s*[>+~]+/,
  reRightContext = /[>+~]+\s*$/,

  /*----------------------------- UTILITY METHODS ----------------------------*/

  slice = Array.prototype.slice,

  // Safari 2 bug with innerText (gasp!)
  // used to strip tags from innerHTML
  stripTags = function(s) {
    return s.replace(/<\/?("[^\"]*"|'[^\']*'|[^>])+>/gi, '');
  },

  /*----------------------------- FEATURE TESTING ----------------------------*/

  // detect native methods
  isNative = (function() {
    var s = (global.open + '').replace(/open/g, '');
    return function(object, method) {
      var m = object ? object[method] : false, r = new RegExp(method, 'g');
      return !!(m && typeof m != 'string' && s === (m + '').replace(r, ''));
    };
  })(),

  // Safari 2 missing document.compatMode property
  // makes harder to detect Quirks vs. Strict mode
  isQuirks =
    function(document) {
      return typeof document.compatMode == 'string' ?
        document.compatMode.indexOf('CSS') < 0 :
        (function() {
          var div = document.createElement('div'),
            isStrict = div.style &&
              (div.style.width = 1) &&
              div.style.width != '1px';
          div = null;
          return !isStrict;
        })();
    },

  // XML is functional in W3C browsers
  isXML = 'xmlVersion' in doc ?
    function(document) {
      return !!document.xmlVersion ||
        (/xml$/).test(document.contentType) ||
        !(/html/i).test(document.documentElement.nodeName);
    } :
    function(document) {
      return document.firstChild.nodeType == 7 &&
        (/xml/i).test(document.firstChild.nodeName) ||
        !(/html/i).test(document.documentElement.nodeName);
    },

  // initialized with the loading context
  // and reset for each selection query
  isQuirksMode = isQuirks(doc),
  isXMLDocument = isXML(doc),

  // NATIVE_XXXXX true if method exist and is callable

  // detect if DOM methods are native in browsers
  NATIVE_FOCUS = isNative(doc, 'hasFocus'),
  NATIVE_QSAPI = isNative(doc, 'querySelector'),
  NATIVE_GEBID = isNative(doc, 'getElementById'),
  NATIVE_GEBTN = isNative(root, 'getElementsByTagName'),
  NATIVE_GEBCN = isNative(root, 'getElementsByClassName'),

  // detect native getAttribute/hasAttribute methods,
  // frameworks extend these to elements, but it seems
  // this does not work for XML namespaced attributes,
  // used to check both getAttribute/hasAttribute in IE
  NATIVE_HAS_ATTRIBUTE = isNative(root, 'hasAttribute'),

  // check if slice() can convert nodelist to array
  // see http://yura.thinkweb2.com/cft/
  NATIVE_SLICE_PROTO =
    (function() {
      var isBuggy = false, id = root.id;
      root.id = 'length';
      try {
        isBuggy = !!slice.call(doc.childNodes, 0)[0];
      } catch(e) { }
      root.id = id;
      return isBuggy;
    })(),

  // supports the new traversal API
  NATIVE_TRAVERSAL_API =
    'nextElementSibling' in root && 'previousElementSibling' in root,

  // BUGGY_XXXXX true if method is feature tested and has known bugs

  // detect buggy gEBID
  BUGGY_GEBID = NATIVE_GEBID ?
    (function() {
      var isBuggy = true, x = 'x' + String(+new Date),
        a = doc.createElementNS ? 'a' : '<a name="' + x + '">';
      (a = doc.createElement(a)).name = x;
      root.insertBefore(a, root.firstChild);
      isBuggy = !!doc.getElementById(x);
      root.removeChild(a);
      a = null;
      return isBuggy;
    })() :
    true,

  // detect IE gEBTN comment nodes bug
  BUGGY_GEBTN = NATIVE_GEBTN ?
    (function() {
      var isBuggy, div = doc.createElement('div');
      div.appendChild(doc.createComment(''));
      isBuggy = div.getElementsByTagName('*')[0];
      div.removeChild(div.firstChild);
      div = null;
      return !!isBuggy;
    })() :
    true,

  // detect Opera gEBCN second class and/or UTF8 bugs as well as Safari 3.2
  // caching class name results and not detecting when changed,
  // tests are based on the jQuery selector test suite
  BUGGY_GEBCN = NATIVE_GEBCN ?
    (function() {
      var isBuggy, div = doc.createElement('div'), test = '\u53f0\u5317';

      // Opera tests
      div.appendChild(doc.createElement('span')).
        setAttribute('class', test + 'abc ' + test);
      div.appendChild(doc.createElement('span')).
        setAttribute('class', 'x');

      // Opera tests
      isBuggy = !div.getElementsByClassName(test)[0];

      // Safari test
      div.lastChild.className = test;
      if (!isBuggy)
        isBuggy = div.getElementsByClassName(test).length !== 2;

      div.removeChild(div.firstChild);
      div.removeChild(div.firstChild);
      div = null;
      return isBuggy;
    })() :
    true,

  // detect IE bug with non-standard boolean attributes
  BUGGY_HAS_ATTRIBUTE = NATIVE_HAS_ATTRIBUTE ?
    (function() {
      var isBuggy, option = doc.createElement('option');
      option.setAttribute('selected', 'selected');
      isBuggy = !option.hasAttribute('selected');
      return isBuggy;
    })() :
    true,

  // detect Safari bug with selected option elements
  BUGGY_SELECTED =
    (function() {
      var isBuggy, select = doc.createElement('select');
      select.appendChild(doc.createElement('option'));
      isBuggy = !select.firstChild.selected;
      return isBuggy;
    })(),

  // check Seletor API implementations
  RE_BUGGY_QSAPI = NATIVE_QSAPI ?
    (function() {
      var pattern = [ ], div = doc.createElement('div'), input;

      // WebKit is correct with className case insensitivity (when no DOCTYPE)
      // obsolete bug https://bugs.webkit.org/show_bug.cgi?id=19047
      // so the bug is in all other browsers code now :-)
      // http://www.whatwg.org/specs/web-apps/current-work/#selectors

      // Safari 3.2 QSA doesn't work with mixedcase on quirksmode
      // must test the attribute selector '[class~=xxx]'
      // before '.xXx' or the bug may not present itself
      div.appendChild(doc.createElement('p')).setAttribute('class', 'xXx');
      div.appendChild(doc.createElement('p')).setAttribute('class', 'xxx');
      if (isQuirks(doc) &&
        (div.querySelectorAll('[class~=xxx]').length != 2 ||
        div.querySelectorAll('.xXx').length != 2)) {
        pattern.push('(?:\\[[\\x20\\t\\n\\r\\f]*class\\b|\\.' + encoding + ')');
      }
      div.removeChild(div.firstChild);
      div.removeChild(div.firstChild);

      // :enabled :disabled bugs with hidden fields (Firefox 3.5 QSA bug)
      // http://www.w3.org/TR/html5/interactive-elements.html#selector-enabled
      // IE8 throws error with these pseudos
      (input = doc.createElement('input')).setAttribute('type', 'hidden');
      div.appendChild(input);
      try {
        div.querySelectorAll(':enabled').length === 1 &&
          pattern.push(':enabled', ':disabled');
      } catch(e) { }
      div.removeChild(div.firstChild);

      // :checked bugs whith checkbox fields (Opera 10beta3 bug)
      (input = doc.createElement('input')).setAttribute('type', 'hidden');
      div.appendChild(input);
      input.setAttribute('checked', 'checked');
      try {
        div.querySelectorAll(':checked').length !== 1 &&
          pattern.push(':checked');
      } catch(e) { }
      div.removeChild(div.firstChild);

      // :link bugs with hyperlinks matching (Firefox/Safari)
      div.appendChild(doc.createElement('a')).setAttribute('href', 'x');
      div.querySelectorAll(':link').length !== 1 && pattern.push(':link');
      div.removeChild(div.firstChild);

      pattern.push(':target', ':selected', ':contains');

      // avoid following selectors for IE QSA
      if (BUGGY_HAS_ATTRIBUTE) {
        pattern.push(
          // IE fails reading empty values for ^= $= operators
          '\\[\\s*.*\\^\\=',
          '\\[\\s*.*\\$\\=',
          // IE fails reading original values for input/textarea
          '\\[\\s*value',
          // IE fails reading original boolean value for controls
          '\\[\\s*ismap',
          '\\[\\s*checked',
          '\\[\\s*disabled',
          '\\[\\s*multiple',
          '\\[\\s*readonly',
          '\\[\\s*selected');
      }

      div = null;
      return pattern.length ?
        new RegExp(pattern.join('|')) :
        { 'test': function() { return false; } };
    })() :
    true,

  // matches simple id, tag & class selectors
  RE_SIMPLE_SELECTOR = new RegExp('^(?:\\*|[.#]?' + encoding + ')$'),
  RE_SIMPLE_SELECTOR_QSA = new RegExp(
    !(BUGGY_GEBTN && BUGGY_GEBCN) ?
      '^(?:\\*|[.#]?' + encoding + ')$' :
      '^#?' + encoding + '$'),

  /*----------------------------- LOOKUP OBJECTS -----------------------------*/

  LINK_NODES = { 'a': 1, 'A': 1, 'area': 1, 'AREA': 1, 'link': 1, 'LINK': 1 },

  QSA_NODE_TYPES = { '9': 1, '11': 1 },

  // boolean attributes should return attribute name instead of true/false
  ATTR_BOOLEAN = {
    checked: 1, disabled: 1, ismap: 1, multiple: 1, readonly: 1, selected: 1
  },

  // attribute referencing URI data values need special treatment in IE
  ATTR_URIDATA = {
    'action': 2, 'cite': 2, 'codebase': 2, 'data': 2, 'href': 2,
    'longdesc': 2, 'lowsrc': 2, 'src': 2, 'usemap': 2
  },

  // HTML 5 draft specifications
  // http://www.whatwg.org/specs/web-apps/current-work/#selectors
  HTML_TABLE = {
    // class attribute must be treated case-insensitive in HTML quirks mode
    // initialized by default to Standard Mode (case-sensitive),
    // set dynamically by the attribute resolver
    'class': 0,
    'accept': 1, 'accept-charset': 1, 'align': 1, 'alink': 1, 'axis': 1,
    'bgcolor': 1, 'charset': 1, 'checked': 1, 'clear': 1, 'codetype': 1, 'color': 1,
    'compact': 1, 'declare': 1, 'defer': 1, 'dir': 1, 'direction': 1, 'disabled': 1,
    'enctype': 1, 'face': 1, 'frame': 1, 'hreflang': 1, 'http-equiv': 1, 'lang': 1,
    'language': 1, 'link': 1, 'media': 1, 'method': 1, 'multiple': 1, 'nohref': 1,
    'noresize': 1, 'noshade': 1, 'nowrap': 1, 'readonly': 1, 'rel': 1, 'rev': 1,
    'rules': 1, 'scope': 1, 'scrolling': 1, 'selected': 1, 'shape': 1, 'target': 1,
    'text': 1, 'type': 1, 'valign': 1, 'valuetype': 1, 'vlink': 1
  },

  // the following attributes must be treated case-insensitive in XHTML mode
  // Niels Leenheer http://rakaz.nl/item/css_selector_bugs_case_sensitivity
  XHTML_TABLE = {
    'accept': 1, 'accept-charset': 1, 'alink': 1, 'axis': 1,
    'bgcolor': 1, 'charset': 1, 'codetype': 1, 'color': 1,
    'enctype': 1, 'face': 1, 'hreflang': 1, 'http-equiv': 1,
    'lang': 1, 'language': 1, 'link': 1, 'media': 1, 'rel': 1,
    'rev': 1, 'target': 1, 'text': 1, 'type': 1, 'vlink': 1
  },

  /*-------------------------- REGULAR EXPRESSIONS ---------------------------*/

  // placeholder to add functionalities
  Selectors = {
    // as a simple example this will check
    // for chars not in standard ascii table
    //
    // 'mySpecialSelector': {
    //  'Expression': /\u0080-\uffff/,
    //  'Callback': mySelectorCallback
    // }
    //
    // 'mySelectorCallback' will be invoked
    // only after passing all other standard
    // checks and only if none of them worked
  },

  // attribute operators
  Operators = {
     '=': "n=='%m'",
    '^=': "n.indexOf('%m')==0",
    '*=': "n.indexOf('%m')>-1",
    '|=': "(n+'-').indexOf('%m-')==0",
    '~=': "(' '+n+' ').indexOf(' %m ')>-1",
    '$=': "n.substr(n.length-'%m'.length)=='%m'"
  },

  TAGS = "(?:^|[>+~\\x20\\t\\n\\r\\f])",

  // optimization expressions
  Optimize = {
    ID: new RegExp("#" + encoding + "|" + skipgroup),
    TAG: new RegExp(TAGS + encoding + "|" + skipgroup),
    CLASS: new RegExp("\\." + encoding + "|" + skipgroup),
    NAME: /\[\s*name\s*=\s*((["']*)([^'"()]*?)\2)?\s*\]/
  },

  // precompiled Regular Expressions
  Patterns = {
    // element attribute matcher
    attribute: /^\[[\x20\t\n\r\f]*([-\w\\]*:?(?:[-\w\\])+)[\x20\t\n\r\f]*(?:([~*^$|!]?=)[\x20\t\n\r\f]*(["']*)([^'"()]*?)\3)?[\x20\t\n\r\f]*\](.*)/,
    // structural pseudo-classes
    spseudos: /^\:(root|empty|nth)?-?(first|last|only)?-?(child)?-?(of-type)?(?:\(([^\x29]*)\))?(.*)/,
    // uistates + dynamic + negation pseudo-classes
    dpseudos: /^\:([\w]+|[^\x00-\xa0]+)(?:\((["']*)(.*?(\(.*\))?[^'"()]*?)\2\))?(.*)/,
    // E > F
    children: /^[\x20\t\n\r\f]*\>[\x20\t\n\r\f]*(.*)/,
    // E + F
    adjacent: /^[\x20\t\n\r\f]*\+[\x20\t\n\r\f]*(.*)/,
    // E ~ F
    relative: /^[\x20\t\n\r\f]*\~[\x20\t\n\r\f]*(.*)/,
    // E F
    ancestor: /^[\x20\t\n\r\f]+(.*)/,
    // all
    universal: /^\*(.*)/,
    // id
    id: new RegExp("^#" + encoding + "(.*)"),
    // tag
    tagName: new RegExp("^" + encoding + "(.*)"),
    // class
    className: new RegExp("^\\." + encoding + "(.*)")
  },

  // current CSS3 grouping of Pseudo-Classes
  // they allow implementing extensions
  // and improve error notifications;
  // the assigned value represent current spec status:
  // 3 = CSS3, 2 = CSS2, '?' = maybe implemented
  CSS3PseudoClasses = {
    Structural: {
      'root': 3, 'empty': 3,
      'first-child': 3, 'last-child': 3, 'only-child': 3,
      'first-of-type': 3, 'last-of-type': 3, 'only-of-type': 3,
      'first-child-of-type': 3, 'last-child-of-type': 3, 'only-child-of-type': 3,
      'nth-child': 3, 'nth-last-child': 3, 'nth-of-type': 3, 'nth-last-of-type': 3
      // (the 4rd line is not in W3C CSS specs but is an accepted alias of 3nd line)
    },

    // originally separated in different pseudo-classes
    // we have grouped them to optimize a bit size+speed
    // all are going through the same code path (switch)
    Others: {
      // UIElementStates (grouped to optimize)
      'checked': 3, 'disabled': 3, 'enabled': 3, 'selected': 2, 'indeterminate': '?',
      // Dynamic pseudo classes
      'active': 3, 'focus': 3, 'hover': 3, 'link': 3, 'visited': 3,
      // Target, Language and Negated pseudo classes
      'target': 3, 'lang': 3, 'not': 3,
      // http://www.w3.org/TR/2001/CR-css3-selectors-20011113/#content-selectors
      'contains': '?'
    }
  },

  /*------------------------------ DOM METHODS -------------------------------*/

  // concat elements to data
  concatList =
    function(data, elements) {
      var i = -1, element;
      if (data.length === 0 && Array.slice)
        return Array.slice(elements);
      while ((element = elements[++i]))
        data[data.length] = element;
      return data;
    },

  // concat elements to data and callback
  concatCall =
    function(data, elements, callback) {
      var i = -1, element;
      while ((element = elements[++i]))
        callback(data[data.length] = element);
      return data;
    },

  // element by id (raw)
  byIdRaw =
    function(id, elements) {
      var i = -1, element = null;
      while ((element = elements[++i])) {
        if (element.getAttribute('id') == id) {
          break;
        }
      }
      return element;
    },

  // element by id
  // @return element reference or null
  byId = !BUGGY_GEBID ?
    function(id, from) {
      from || (from = doc);
      id = id.replace(/\\/g, '');
      if (isXMLDocument || from.nodeType != 9) {
        return byIdRaw(id, from.getElementsByTagName('*'));
      }
      return from.getElementById(id);
    } :
    function(id, from) {
      var element = null;
      from || (from = doc);
      id = id.replace(/\\/g, '');
      if (isXMLDocument || from.nodeType != 9) {
        return byIdRaw(id, from.getElementsByTagName('*'));
      }
      if ((element = from.getElementById(id)) &&
        element.name == id && from.getElementsByName) {
        return byIdRaw(id, from.getElementsByName(id));
      }
      return element;
    },

  // elements by tag
  // @return array
  byTag = !BUGGY_GEBTN && NATIVE_SLICE_PROTO ?
    function(tag, from) {
      return slice.call((from || doc).getElementsByTagName(tag), 0);
    } :
    function(tag, from) {
      var i = -1, data = [ ],
        element, elements = (from || doc).getElementsByTagName(tag);
      if (tag == '*') {
        var j = -1;
        while ((element = elements[++i])) {
          if (element.nodeName > '@')
            data[++j] = element;
        }
      } else {
        while ((element = elements[++i])) {
          data[i] = element;
        }
      }
      return data;
    },

  // elements by name
  // @return array
  byName =
    function(name, from) {
      return select('[name="' + name.replace(/\\/g, '') + '"]', from || doc);
    },

  // elements by class
  // @return array
  byClass = !BUGGY_GEBCN && NATIVE_SLICE_PROTO ?
    function(className, from) {
      return slice.call((from || doc).getElementsByClassName(className.replace(/\\/g, '')), 0);
    } :
    function(className, from) {
      from || (from = doc);
      var i = -1, j = i,
        data = [ ], element,
        host = from.ownerDocument || from,
        elements = from.getElementsByTagName('*'),
        quirks = isQuirks(host), xml = isXML(host),
        n = quirks ? className.toLowerCase() : className;
      className = ' ' + n.replace(/\\/g, '') + ' ';
      while ((element = elements[++i])) {
        n = xml ? element.getAttribute('class') : element.className;
        if (n && n.length && (' ' + (quirks ? n.toLowerCase() : n).
          replace(reWhiteSpace, ' ') + ' ').indexOf(className) > -1) {
          data[++j] = element;
        }
      }
      return data;
    },

  // check if an element is a descendant of container
  contains = 'compareDocumentPosition' in root ?
    function(container, element) {
      return (container.compareDocumentPosition(element) & 16) == 16;
    } : 'contains' in root ?
    function(container, element) {
      return container !== element && container.contains(element);
    } :
    function(container, element) {
      while ((element = element.parentNode)) {
        if (element === container) return true;
      }
      return false;
    },

  // children position by nodeType
  // @return number
  getIndexesByNodeType =
    function(element) {
      var i = 0, indexes,
        id = element[CSS_INDEX] || (element[CSS_INDEX] = ++CSS_ID);
      if (!indexesByNodeType[id]) {
        indexes = { };
        element = element.firstChild;
        while (element) {
          if (element.nodeName > '@') {
            indexes[element[CSS_INDEX] || (element[CSS_INDEX] = ++CSS_ID)] = ++i;
          }
          element = element.nextSibling;
        }
        indexes.length = i;
        indexesByNodeType[id] = indexes;
      }
      return indexesByNodeType[id];
    },

  // children position by nodeName
  // @return number
  getIndexesByNodeName =
    function(element, name) {
      var i = 0, indexes,
        id = element[CSS_INDEX] || (element[CSS_INDEX] = ++CSS_ID);
      if (!indexesByNodeName[id] || !indexesByNodeName[id][name]) {
        indexes = { };
        element = element.firstChild;
        while (element) {
          if (element.nodeName.toUpperCase() == name) {
            indexes[element[CSS_INDEX] || (element[CSS_INDEX] = ++CSS_ID)] = ++i;
          }
          element = element.nextSibling;
        }
        indexes.length = i;
        indexesByNodeName[id] ||
          (indexesByNodeName[id] = { });
        indexesByNodeName[id][name] = indexes;
      }
      return indexesByNodeName[id];
    },

  // attribute value
  // @return string
  getAttribute = NATIVE_HAS_ATTRIBUTE ?
    function(node, attribute) {
      return node.getAttribute(attribute) || '';
    } :
    function(node, attribute) {
      attribute = attribute.toLowerCase();
      if (typeof node.form !== 'undefined') {
        switch(attribute) {
          case 'value':
            if (node.defaultValue) return node.defaultValue || '';
            break;
          case 'checked':
            return node.defaultChecked && attribute;
          case 'selected':
            return node.defaultSelected && attribute;
          default:
            break;
        }
      }
      return (
        // specific URI data attributes (parameter 2 to fix IE bug)
        ATTR_URIDATA[attribute] ? node.getAttribute(attribute, 2) || '' :
        // boolean attributes should return name instead of true/false
        ATTR_BOOLEAN[attribute] ? node.getAttribute(attribute) ? attribute : '' :
          ((node = node.getAttributeNode(attribute)) && node.value) || '');
    },

  // attribute presence
  // @return boolean
  hasAttribute = !BUGGY_HAS_ATTRIBUTE ?
    function(node, attribute) {
      return node.hasAttribute(attribute);
    } : NATIVE_HAS_ATTRIBUTE ?
    function(node, attribute) {
      return !!node.getAttribute(attribute);
    } :
    function(node, attribute) {
      // need to get at AttributeNode first on IE
      node = node.getAttributeNode(attribute);
      // use both "specified" & "nodeValue" properties
      return !!(node && (node.specified || node.nodeValue));
    },

  // check node emptyness
  isEmpty =
    function(node) {
      node = node.firstChild;
      while (node) {
        if (node.nodeType == 3 || node.nodeName > '@') return false;
        node = node.nextSibling;
      }
      return true;
    },

  // check if element matches the :link pseudo
  // @return boolean
  isLink =
    function(element) {
      return hasAttribute(element,'href') && LINK_NODES[element.nodeName];
    },

  /*------------------------------- DEBUGGING --------------------------------*/

  // compile selectors to ad-hoc functions resolvers
  // @selector string
  // @mode boolean
  // false = select resolvers
  // true = match resolvers
  compile =
    function(selector, mode) {
      return compileGroup(selector, '', mode || false);
    },

  configure =
    function(options) {
      for (var i in options) {
        if (i == 'VERBOSITY') {
          VERBOSITY = !!options[i];
        } else if (i == 'SIMPLENOT') {
          SIMPLENOT = !!options[i];
        } else if (i == 'USE_QSAPI') {
          USE_QSAPI = !!options[i] && NATIVE_QSAPI;
        }
      }
    },

  // a way to control user notification
  emit =
    function(message) {
      if (VERBOSITY) {
        var console = global.console;
        if (console && console.log) {
          console.log(message);
        } else {
          if (/exception/i.test(message)) {
            global.status = message;
            global.defaultStatus = message;
          } else {
            global.status += message;
          }
        }
      }
    },

  // by default enable complex selectors nested
  // in :not() pseudo-classes, contrary to specs
  SIMPLENOT = false,

  // enable engine errors/warnings notifications
  VERBOSITY = false,

  // controls selecting internal or QSAPI engines
  USE_QSAPI = NATIVE_QSAPI,

  /*---------------------------- COMPILER METHODS ----------------------------*/

  // do not change this, it is searched & replaced
  // in multiple places to build compiled functions
  ACCEPT_NODE = 'f&&f(c[k]);r[r.length]=c[k];continue main;',

  // checks if nodeName comparisons need to be uppercased
  TO_UPPER_CASE = typeof doc.createElementNS == 'function' ?
    '.toUpperCase()' : '',

  // use the textContent or innerText property to check CSS3 :contains
  // Safari 2 have a bug with innerText and hidden content, so we need
  // to use an internal stripTags and the innerHTML property
  CONTAINS_TEXT =
    'textContent' in root ?
    'e.textContent' :
    (function() {
      var div = doc.createElement('div'), p;
      div.appendChild(p = doc.createElement('p'));
      p.appendChild(doc.createTextNode('p'));
      div.style.display = 'none';
      return div.innerText ?
        'e.innerText' :
        's.stripTags(e.innerHTML)';
    })(),

  // compile a comma separated group of selector
  // @mode boolean true for select, false for match
  // return a compiled function
  compileGroup =
    function(selector, source, mode) {
      var i = -1, seen = { }, parts, token;
      if ((parts = selector.match(reSplitGroup))) {
        // for each selector in the group
        while ((token = parts[++i])) {
          token = token.replace(reTrimSpaces, '');
          // avoid repeating the same token in comma separated group (p, p)
          if (!seen[token]) {
            seen[token] = true;
            source += i > 0 ? (mode ? 'e=c[k];': 'e=k;') : '';
            source += compileSelector(token, mode ? ACCEPT_NODE : 'f&&f(k);return true;');
          }
        }
      }
      if (mode) {
        // for select method
        return new Function('c,s,r,d,h,g,f',
          'var N,n,x=0,k=-1,e;main:while(e=c[++k]){' + source + '}return r;');
      } else {
        // for match method
        return new Function('e,s,r,d,h,g,f',
          'var N,n,x=0,k=e;' + source + 'return false;');
      }
    },

  // compile a CSS3 string selector into ad-hoc javascript matching function
  // @return string (to be compiled)
  compileSelector =
    function(selector, source) {

      var i, a, b, n, k, expr, match, result, status, test, type;

      k = 0;

      while (selector) {

        // *** Universal selector
        // * match all (empty block, do not remove)
        if ((match = selector.match(Patterns.universal))) {
          // do nothing, handled in the compiler where
          // BUGGY_GEBTN return comment nodes (ex: IE)
          true;
        }

        // *** ID selector
        // #Foo Id case sensitive
        else if ((match = selector.match(Patterns.id))) {
          // document can contain conflicting elements (id/name)
          // prototype selector unit need this method to recover bad HTML forms
          source = 'if(' + (isXMLDocument ?
            's.getAttribute(e,"id")' :
            '(e.submit?s.getAttribute(e,"id"):e.id)') +
            '=="' + match[1] + '"' +
            '){' + source + '}';
        }

        // *** Type selector
        // Foo Tag (case insensitive)
        else if ((match = selector.match(Patterns.tagName))) {
          // both tagName and nodeName properties may be upper/lower case
          // depending on their creation NAMESPACE in createElementNS()
          source = 'if(e.nodeName' + (isXMLDocument ?
            '=="' + match[1] + '"' : TO_UPPER_CASE +
            '=="' + match[1].toUpperCase() + '"') +
            '){' + source + '}';
        }

        // *** Class selector
        // .Foo Class (case sensitive)
        else if ((match = selector.match(Patterns.className))) {
          // W3C CSS3 specs: element whose "class" attribute has been assigned a
          // list of whitespace-separated values, see section 6.4 Class selectors
          // and notes at the bottom; explicitly non-normative in this specification.
          source = 'if((n=' + (isXMLDocument ?
            's.getAttribute(e,"class")' : 'e.className') +
            ')&&(" "+' + (isQuirksMode ? 'n.toLowerCase()' : 'n') +
            '.replace(' + reWhiteSpace +'," ")+" ").indexOf(" ' +
            (isQuirksMode ? match[1].toLowerCase() : match[1]) + ' ")>-1' +
            '){' + source + '}';
        }

        // *** Attribute selector
        // [attr] [attr=value] [attr="value"] [attr='value'] and !=, *=, ~=, |=, ^=, $=
        // case sensitivity is treated differently depending on the document type (see map)
        else if ((match = selector.match(Patterns.attribute))) {
          // xml namespaced attribute ?
          expr = match[1].split(':');
          expr = expr.length == 2 ? expr[1] : expr[0] + '';

          // replace Operators parameter if needed
          if (match[2] && match[4] && (type = Operators[match[2]])) {
            // case treatment depends on document
            HTML_TABLE['class'] = isQuirksMode ? 1 : 0;
            // replace escaped values and HTML entities
            match[4] = match[4].replace(/\\([0-9a-f]{2,2})/, '\\x$1');
            test = (isXMLDocument ? XHTML_TABLE : HTML_TABLE)[expr.toLowerCase()];
            type = type.replace(/\%m/g, test ? match[4].toLowerCase() : match[4]);
          } else {
            test = false;
            // handle empty values
            type = match[2] == '=' ? 'n==""' : 'false';
          }

          // build expression for has/getAttribute
          expr = 'n=s.' + (match[2] ? 'get' : 'has') +
            'Attribute(e,"' + match[1] + '")' +
            (test ? '.toLowerCase();' : ';');

          source = expr + 'if(' + (match[2] ? type : 'n') + '){' + source + '}';
        }

        // *** Adjacent sibling combinator
        // E + F (F adiacent sibling of E)
        else if ((match = selector.match(Patterns.adjacent))) {
          k++;
          source = NATIVE_TRAVERSAL_API ?
            'var N' + k + '=e;if(e&&(e=e.previousElementSibling)){' + source + '}e=N' + k + ';' :
            'var N' + k + '=e;while(e&&(e=e.previousSibling)){if(e.nodeName>"@"){' + source + 'break;}}e=N' + k + ';';
        }

        // *** General sibling combinator
        // E ~ F (F relative sibling of E)
        else if ((match = selector.match(Patterns.relative))) {
          k++;
          source = NATIVE_TRAVERSAL_API ?
            ('var N' + k + '=e;e=e.parentNode.firstElementChild;' +
            'while(e&&e!=N' + k + '){' + source + 'e=e.nextElementSibling;}e=N' + k + ';') :
            ('var N' + k + '=e;e=e.parentNode.firstChild;' +
            'while(e&&e!=N' + k + '){if(e.nodeName>"@"){' + source + '}e=e.nextSibling;}e=N' + k + ';');
        }

        // *** Child combinator
        // E > F (F children of E)
        else if ((match = selector.match(Patterns.children))) {
          k++;
          source = 'var N' + k + '=e;if(e&&e!==h&&e!==g&&(e=e.parentNode)){' + source + '}e=N' + k + ';';
        }

        // *** Descendant combinator
        // E F (E ancestor of F)
        else if ((match = selector.match(Patterns.ancestor))) {
          k++;
          source = 'var N' + k + '=e;while(e&&e!==h&&e!==g&&(e=e.parentNode)){' + source + '}e=N' + k + ';';
        }

        // *** Structural pseudo-classes
        // :root, :empty,
        // :first-child, :last-child, :only-child,
        // :first-of-type, :last-of-type, :only-of-type,
        // :nth-child(), :nth-last-child(), :nth-of-type(), :nth-last-of-type()
        else if ((match = selector.match(Patterns.spseudos)) &&
          CSS3PseudoClasses.Structural[selector.match(reClassValue)[0]]) {

          switch (match[1]) {
            case 'root':
              // element root of the document
              source = 'if(e===h){' + source + '}';
              break;

            case 'empty':
              // element that has no children
              source = 'if(s.isEmpty(e)){' + source + '}';
              break;

            default:
              if (match[1] && match[5]) {
                if (match[5] == 'n') {
                  source = 'if(e!==h){' + source + '}';
                  break;
                } else if (match[5] == 'even') {
                  a = 2;
                  b = 0;
                } else if (match[5] == 'odd') {
                  a = 2;
                  b = 1;
                } else {
                  // assumes correct "an+b" format, "b" before "a" to keep "n" values
                  b = ((n = match[5].match(/(-?\d{1,})$/)) ? parseInt(n[1], 10) : 0);
                  a = ((n = match[5].match(/(-?\d{0,})n/)) ? parseInt(n[1], 10) : 0);
                  if (n && n[1] == '-') a = -1;
                }

                // executed after the count is computed
                type = match[4] ? 'n[N]' : 'n';
                expr = match[2] == 'last' && b >= 0 ? type + '.length-(' + (b - 1) + ')' : b;

                // shortcut check for of-type selectors
                type = type + '[e.' + CSS_INDEX + ']';

                // build test expression out of structural pseudo (an+b) parameters
                // see here: http://www.w3.org/TR/css3-selectors/#nth-child-pseudo
                test =  b < 1 && a > 1 ? '(' + type + '-(' + expr + '))%' + a + '==0' : a > +1 ?
                  (match[2] == 'last') ? '(' + type + '-(' + expr + '))%' + a + '==0' :
                  type + '>=' + expr + '&&(' + type + '-(' + expr + '))%' + a + '==0' : a < -1 ?
                  (match[2] == 'last') ? '(' + type + '-(' + expr + '))%' + a + '==0' :
                  type + '<=' + expr + '&&(' + type + '-(' + expr + '))%' + a + '==0' : a=== 0 ?
                  type + '==' + expr : a == -1 ? type + '<=' + expr : type + '>=' + expr;

                // 4 cases: 1 (nth) x 4 (child, of-type, last-child, last-of-type)
                source =
                  (match[4] ? 'N=e.nodeName' + TO_UPPER_CASE + ';' : '') +
                  'if(e!==h){' +
                    'n=s.getIndexesBy' + (match[4] ? 'NodeName' : 'NodeType') +
                    '(e.parentNode' + (match[4] ? ',N' : '') + ');' +
                    'if(' + test + '){' + source + '}' +
                  '}';

              } else {
                // 6 cases: 3 (first, last, only) x 1 (child) x 2 (-of-type)
                a = match[2] == 'first' ? 'previous' : 'next';
                n = match[2] == 'only' ? 'previous' : 'next';
                b = match[2] == 'first' || match[2] == 'last';

                type = match[4] ? '&&n.nodeName!=e.nodeName' : '&&n.nodeName<"@"';

                source = 'if(e!==h){' +
                  ( 'n=e;while((n=n.' + a + 'Sibling)' + type + ');if(!n){' + (b ? source :
                    'n=e;while((n=n.' + n + 'Sibling)' + type + ');if(!n){' + source + '}') + '}' ) + '}';
              }
              break;
          }
        }

        // *** negation, user action and target pseudo-classes
        // *** UI element states and dynamic pseudo-classes
        // CSS3 :not, :checked, :enabled, :disabled, :target
        // CSS3 :active, :hover, :focus
        // CSS3 :link, :visited
        else if ((match = selector.match(Patterns.dpseudos)) &&
          CSS3PseudoClasses.Others[selector.match(reClassValue)[0]]) {

          switch (match[1]) {
            // CSS3 negation pseudo-class
            case 'not':
              // compile nested selectors, DO NOT pass the callback parameter
              // SIMPLENOT allow disabling complex selectors nested
              // in :not() pseudo-classes, breaks some test units
              expr = match[3].replace(reTrimSpaces, '');
              if (SIMPLENOT && (expr.indexOf(':') > 0 || expr.indexOf('[') > 0)) source = '';
              else {
                if ('compatMode' in doc) {
                  source = 'N=' + compileGroup(expr, '', false) + '(e,s,r,d,h,g);if(!N){' + source + '}';
                } else {
                  source = 'if(!s.match(e, "' + expr.replace(/\x22/g, '\\"') + '"),r,d,h,g){' + source +'}';
                }
              }
              break;

            // CSS3 UI element states
            case 'checked':
              // only radio buttons, check boxes and option elements
              source = 'if(((typeof e.form!=="undefined"&&(/radio|checkbox/i).test(e.type))||/option/i.test(e.nodeName))&&(e.checked||e.selected)){' + source + '}';
              break;
            case 'enabled':
              // does not consider hidden input fields
              source = 'if(((typeof e.form!=="undefined"&&!(/hidden/i).test(e.type))||s.isLink(e))&&!e.disabled){' + source + '}';
              break;
            case 'disabled':
              // does not consider hidden input fields
              source = 'if(((typeof e.form!=="undefined"&&!(/hidden/i).test(e.type))||s.isLink(e))&&e.disabled){' + source + '}';
              break;

            // CSS3 lang pseudo-class
            case 'lang':
              test = '';
              if (match[3]) test = match[3].substr(0, 2) + '-';
              source = 'do{(n=e.lang||"").toLowerCase();' +
                'if((n==""&&h.lang=="' + match[3].toLowerCase() + '")||' +
                '(n&&(n=="' + match[3].toLowerCase() +
                '"||n.substr(0,3)=="' + test.toLowerCase() + '")))' +
                '{' + source + 'break;}}while((e=e.parentNode)&&e!==g);';
              break;

            // CSS3 target pseudo-class
            case 'target':
              n = doc.location ? doc.location.hash : '';
              if (n) {
                source = 'if(e.id=="' + n.slice(1) + '"){' + source + '}';
              }
              break;

            // CSS3 dynamic pseudo-classes
            case 'link':
              source = 'if(s.isLink(e)&&!e.visited){' + source + '}';
              break;
            case 'visited':
              source = 'if(s.isLink(e)&&e.visited){' + source + '}';
              break;

            // CSS3 user action pseudo-classes IE & FF3 have native support
            // these capabilities may be emulated by some event managers
            case 'active':
              if (isXMLDocument) break;
              source = 'if(e===d.activeElement){' + source + '}';
              break;
            case 'hover':
              if (isXMLDocument) break;
              source = 'if(e===d.hoverElement){' + source + '}';
              break;
            case 'focus':
              if (isXMLDocument) break;
              source = NATIVE_FOCUS ?
                'if(e===d.activeElement&&d.hasFocus()&&(e.type||e.href)){' + source + '}' :
                'if(e===d.activeElement&&(e.type||e.href)){' + source + '}';
              break;

            // CSS2 :contains and :selected pseudo-classes
            // not currently part of CSS3 drafts
            case 'contains':
              source = 'if(' + CONTAINS_TEXT + '.indexOf("' + match[3] + '")>-1){' + source + '}';
              break;
            case 'selected':
              // fix Safari selectedIndex property bug
              expr = BUGGY_SELECTED ? '||(n=e.parentNode)&&n.options[n.selectedIndex]===e' : '';
              source = 'if(e.nodeName=="OPTION"&&(e.selected' + expr + ')){' + source + '}';
              break;

            default:
              break;
          }
        } else {

          // this is where external extensions are
          // invoked if expressions match selectors
          expr = false;
          status = true;

          for (expr in Selectors) {
            if ((match = selector.match(Selectors[expr].Expression))) {
              result = Selectors[expr].Callback(match, source);
              source = result.source;
              status = result.status;
              if (status) break;
            }
          }

          // if an extension fails to parse the selector
          // it must return a false boolean in "status"
          if (!status) {
            // log error but continue execution, don't throw real exceptions
            // because blocking following processes maybe is not a good idea
            emit('DOMException: unknown pseudo selector "' + selector + '"');
            return '';
          }

          if (!expr) {
            // see above, log error but continue execution
            emit('DOMException: unknown token in selector "' + selector + '"');
            return '';
          }

        }

        // ensure "match" is not null or empty since
        // we do not throw real DOMExceptions above
        selector = match && match[match.length - 1];
      }

      return source;
    },

  /*----------------------------- QUERY METHODS ------------------------------*/

  // match element with selector
  // @return boolean
  match =
    function(element, selector, from, callback) {

      var resolver, parts, hasChanged;

      // make sure an element node was passed
      if (!(element && element.nodeType == 1 && element.nodeName > '@')) {
        emit('DOMException: Passed element is not a DOM ELEMENT_NODE !');
        return false;
      }

      if (from && !contains(from, element)) return false;

      // ensure context is set
      from || (from = doc);

      // extract context if changed
      if (lastMatchContext != from) {
        // save passed context
        lastMatchContext = from;
        // reference element ownerDocument and document root (HTML)
        root = (doc = element.ownerDocument || element).documentElement;
        isQuirksMode = isQuirks(doc);
        isXMLDocument = isXML(doc);
      }

      if (hasChanged = lastMatcher != selector) {
        // process valid selector strings
        if (selector && reValidator.test(selector)) {
          // save passed selector
          lastMatcher = selector;
          selector = selector.replace(reTrimSpaces, '');
          isSingleMatch = (parts = selector.match(reSplitGroup)).length < 2;
        } else {
          emit('DOMException: "' + selector + '" is not a valid CSS selector.');
          return false;
        }
      }

      // compile XML resolver if necessary
      if (isXMLDocument && !(resolver = XMLMatchers[selector])) {

        if (isSingleMatch) {
          resolver =
            new Function('e,s,r,d,h,g,f',
              'var N,n,x=0,k=e;' +
              compileSelector(selector, 'f&&f(k);return true;') +
              'return false;');
        } else {
          resolver = compileGroup(selector, '', false);
        }
        XMLMatchers[selector] = resolver;

      }

      // compile HTML resolver if necessary
      else if (!(resolver = HTMLMatchers[selector])) {

        if (isSingleMatch) {
          resolver =
            new Function('e,s,r,d,h,g,f',
              'var N,n,x=0,k=e;' +
              compileSelector(selector, 'f&&f(k);return true;') +
              'return false;');
        } else {
          resolver = compileGroup(selector, '', false);
        }
        HTMLMatchers[selector] = resolver;

      }

      // reinitialize indexes
      indexesByNodeType = { };
      indexesByNodeName = { };

      return resolver(element, snap, [ ], doc, root, from || doc, callback);
    },

  native_api =
    function(selector, from, callback) {
      var elements;
      switch (selector.charAt(0)) {
        case '#':
          var element;
          if ((element = byId(selector.slice(1), from))) {
            callback && callback(element);
            return [ element ];
          }
          return [ ];
        case '.':
          elements = byClass(selector.slice(1), from);
          break;
        default:
          elements = byTag(selector, from);
          break;
      }
      return callback ?
        concatCall([ ], elements, callback) :
        elements;
    },

  // select elements matching selector
  // using new Query Selector API
  // @return array
  select_qsa =
    function(selector, from, callback) {

      if (RE_SIMPLE_SELECTOR_QSA.test(selector)) {
        return native_api(selector, from || doc, callback);
      }

      if (USE_QSAPI && !RE_BUGGY_QSAPI.test(selector) &&
        (!from || QSA_NODE_TYPES[from.nodeType])) {

        try {
          var elements = (from || doc).querySelectorAll(selector);
        } catch(e) { }

        if (elements) {
          switch (elements.length) {
            case 0:
              return [ ];
            case 1:
              element = elements.item(0);
              callback && callback(element);
              return [ element ];
            default:
              return callback ?
                concatCall([ ], elements, callback) :
                NATIVE_SLICE_PROTO ?
                  slice.call(elements) :
                  concatList([ ], elements);
          }
        }
      }

      // fall back to NWMatcher select
      return client_api(selector, from, callback);
    },

  // select elements matching selector
  // using cross-browser client API
  // @return array
  client_api =
    function(selector, from, callback) {

      if (RE_SIMPLE_SELECTOR.test(selector)) {
        return native_api(selector, from || doc, callback);
      }

      var i, element, elements, parts, token,
        resolver, hasChanged;

      // add left context if missing
      if (reLeftContext.test(selector)) {
        selector = !from ? '*' + selector :
          from.id ? '#' + from.id + selector :
            selector;
      }

      // add right context if missing
      if (reRightContext.test(selector)) {
        selector = selector + '*';
      }

      // ensure context is set
      from || (from = doc);

      // extract context if changed
      if (lastSelectContext != from) {
        // save passed context
        lastSelectContext = from;
        // reference context ownerDocument and document root (HTML)
        root = (doc = from.ownerDocument || from).documentElement;
        isQuirksMode = isQuirks(doc);
        isXMLDocument = isXML(doc);
      }

      if (hasChanged = lastSelector != selector) {
        // process valid selector strings
        if (reValidator.test(selector)) {
          // save passed selector
          lastSelector = selector;
          selector = selector.replace(reTrimSpaces, '');
          isSingleSelect = (parts = selector.match(reSplitGroup)).length < 2;
        } else {
          emit('DOMException: "' + selector + '" is not a valid CSS selector.');
          return [ ];
        }
      }

      // pre-filtering pass allow to scale proportionally with big DOM trees

      // commas separators are treated sequentially to maintain order
      if (isSingleSelect) {

        if (hasChanged) {
          // get right most selector token
          parts = selector.match(reSplitToken);
          token = parts[parts.length - 1];

          // only last slice before :not rules
          lastSlice = token.split(':not')[0];
        }

        // ID optimization RTL, to reduce number of elements to visit
        if ((parts = lastSlice.match(Optimize.ID)) && (token = parts[1])) {
          if ((element = byId(token, from))) {
            if (match(element, selector)) {
              callback && callback(element);
              return [ element ];
            }
          }
          return [ ];
        }

        // ID optimization LTR, to reduce selection context searches
        else if ((parts = selector.match(Optimize.ID)) && (token = parts[1])) {
          if ((element = byId(token, doc))) {
            if (/[>+~]/.test(selector)) {
              from = element.parentNode;
            } else {
              selector = selector.replace('#' + token, '*');
              from = element;
            }
          } else return [ ];
        }

        if (NATIVE_GEBCN) {
          // RTL optimization for browsers with GEBCN, CLASS first TAG second
          if ((parts = lastSlice.match(Optimize.CLASS)) && (token = parts[1])) {
            if ((elements = byClass(token, from)).length === 0) { return [ ]; }
          } else if ((parts = lastSlice.match(Optimize.TAG)) && (token = parts[1])) {
            if ((elements = byTag(token, from)).length === 0) { return [ ]; }
          }
        } else {
          // RTL optimization for browser without GEBCN, TAG first CLASS second
          if ((parts = lastSlice.match(Optimize.TAG)) && (token = parts[1])) {
            if ((elements = from.getElementsByTagName(token)).length === 0) { return [ ]; }
          } else if ((parts = lastSlice.match(Optimize.CLASS)) && (token = parts[1])) {
            if ((elements = byClass(token, from)).length === 0) { return [ ]; }
          }
        }

      }

      if (!elements) {
        elements = byTag('*', from);
      }
      // end of prefiltering pass

      if (isXMLDocument && !(resolver = XMLResolvers[selector])) {

        if (isSingleSelect) {
          resolver =
            new Function('c,s,r,d,h,g,f',
              'var N,n,x=0,k=-1,e;main:while(e=c[++k]){' +
              compileSelector(selector, ACCEPT_NODE) +
              '}return r;');
        } else {
          resolver = compileGroup(selector, '', true);
        }
        XMLResolvers[selector] = resolver;

      }

      // compile the selector if necessary
      else if (!(resolver = HTMLResolvers[selector])) {

        if (isSingleSelect) {
          resolver =
            new Function('c,s,r,d,h,g,f',
              'var N,n,x=0,k=-1,e;main:while(e=c[++k]){' +
              compileSelector(selector, ACCEPT_NODE) +
              '}return r;');
        } else {
          resolver = compileGroup(selector, '', true);
        }
        HTMLResolvers[selector] = resolver;

      }

      // reinitialize indexes
      indexesByNodeType = { };
      indexesByNodeName = { };

      return resolver(elements, snap, [ ], doc, root, from, callback);
    },

  // use the new native Selector API if available,
  // if missing, use the cross-browser client api
  // @return array
  select = NATIVE_QSAPI ?
    select_qsa :
    client_api,

  /*-------------------------------- STORAGE ---------------------------------*/

  // CSS_ID expando on elements,
  // used to keep child indexes
  // during a selection session
  CSS_ID = 1,

  CSS_INDEX = 'uniqueID' in root ? 'uniqueID' : 'CSS_ID',

  // ordinal position by nodeType or nodeName
  indexesByNodeType = { },
  indexesByNodeName = { },

  // compiled select functions returning collections
  // keep each resolver type in different storages
  XMLResolvers = { },
  HTMLResolvers = { },

  // compiled match functions returning booleans
  HTMLMatchers = { },

  // used to pass methods to compiled functions
  snap = {

    // element indexing methods (nodeType/nodeName)
    getIndexesByNodeType: getIndexesByNodeType,
    getIndexesByNodeName: getIndexesByNodeName,

    // element inspection methods
    getAttribute: getAttribute,
    hasAttribute: hasAttribute,

    // element selection methods
    byClass: byClass,
    byName: byName,
    byTag: byTag,
    byId: byId,

    // helper/check methods
    stripTags: stripTags,
    isEmpty: isEmpty,
    isLink: isLink,

    // selection/matching
    select: select,
    match: match
  };

  /*------------------------------- PUBLIC API -------------------------------*/

  global.NW || (global.NW = { });

  NW.Dom = {

    // retrieve element by id attr
    byId: byId,

    // retrieve elements by tag name
    byTag: byTag,

    // retrieve elements by name attr
    byName: byName,

    // retrieve elements by class name
    byClass: byClass,

    // read the value of the attribute
    // as was in the original HTML code
    getAttribute: getAttribute,

    // check for the attribute presence
    // as was in the original HTML code
    hasAttribute: hasAttribute,

    // element match selector, return boolean true/false
    match: match,

    // elements matching selector, starting from element
    select: select,

    // compile selector into ad-hoc javascript resolver
    compile: compile,

    // engine configuration helper
    configure: configure,

    // add or overwrite user defined operators
    registerOperator:
      function(symbol, resolver) {
        if (!Operators[symbol]) {
          Operators[symbol] = resolver;
        }
      },

    // add selector patterns for user defined callbacks
    registerSelector:
      function(name, rexp, func) {
        if (!Selectors[name]) {
          Selectors[name] = { };
          Selectors[name].Expression = rexp;
          Selectors[name].Callback = func;
        }
      }
  };

})(this);