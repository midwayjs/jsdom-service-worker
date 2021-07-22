'use strict';
const vm = require('vm');
const webIDLConversions = require('webidl-conversions');
const { Performance: RawPerformance } = require('w3c-hr-time');
const { installInterfaces } = require('./interfaces');
const { define, mixin } = require('jsdom/lib/jsdom/utils');
const EventTarget = require('jsdom/lib/jsdom/living/generated/EventTarget');
const EventHandlerNonNull = require('jsdom/lib/jsdom/living/generated/EventHandlerNonNull');
const OnErrorEventHandlerNonNull = require('jsdom/lib/jsdom/living/generated/OnErrorEventHandlerNonNull');
const postMessage = require('jsdom/lib/jsdom/living/post-message');
const DOMException = require('domexception/webidl2js-wrapper');
const { btoa, atob } = require('abab');
const idlUtils = require('jsdom/lib/jsdom/living/generated/utils');
const Performance = require('jsdom/lib/jsdom/living/generated/Performance');
const reportException = require('jsdom/lib/jsdom/living/helpers/runtime-script-errors');
const {
  getCurrentEventHandlerValue,
} = require('jsdom/lib/jsdom/living/helpers/create-event-accessor.js');
const { fireAnEvent } = require('jsdom/lib/jsdom/living/helpers/events');
const jsGlobals = require('jsdom/lib/jsdom/browser/js-globals.json');

const GlobalEventHandlersImpl =
  require('./global-event-handlers').implementation;

const events = new Set([
  // GlobalEventHandlers
  'install',
  'activate',
  'fetch',

  // "error" is added separately
]);

exports.createServiceWorkerGlobalScope =
  function createServiceWorkerGlobalScope(options) {
    return new ServiceWorkerGlobalScope(options);
  };

const jsGlobalEntriesToInstall = Object.entries(jsGlobals).filter(
  ([name]) => name in global
);

// TODO remove when we drop Node v10 support.
const anyNodeVersionQueueMicrotask =
  typeof queueMicrotask === 'function' ? queueMicrotask : process.nextTick;

// https://html.spec.whatwg.org/#the-window-object
function setupServiceWorkerGlobalScope(globalInstance, { runScripts }) {
  if (runScripts === 'outside-only' || runScripts === 'dangerously') {
    contextifyServiceWorkerGlobalScope(globalInstance);

    // Without this, these globals will only appear to scripts running inside the context using vm.runScript; they will
    // not appear to scripts running from the outside, including to JSDOM implementation code.
    for (const [globalName, globalPropDesc] of jsGlobalEntriesToInstall) {
      const propDesc = {
        ...globalPropDesc,
        value: vm.runInContext(globalName, globalInstance),
      };
      Object.defineProperty(globalInstance, globalName, propDesc);
    }
  } else {
    // Without contextifying the window, none of the globals will exist. So, let's at least alias them from the Node.js
    // context. See https://github.com/jsdom/jsdom/issues/2727 for more background and discussion.
    for (const [globalName, globalPropDesc] of jsGlobalEntriesToInstall) {
      const propDesc = { ...globalPropDesc, value: global[globalName] };
      Object.defineProperty(globalInstance, globalName, propDesc);
    }
  }

  installInterfaces(globalInstance, ['Worker']);

  const EventTargetConstructor = globalInstance.EventTarget;

  // eslint-disable-next-line func-name-matching, func-style, no-shadow
  const serviceWorkerGlobalScope = function ServiceWorkerGlobalScope() {
    throw new TypeError('Illegal constructor');
  };
  Object.setPrototypeOf(serviceWorkerGlobalScope, EventTargetConstructor);

  Object.defineProperty(globalInstance, 'ServiceWorkerGlobalScope', {
    configurable: true,
    writable: true,
    value: serviceWorkerGlobalScope,
  });

  const serviceWorkerGlobalScopePrototype = Object.create(
    EventTargetConstructor.prototype
  );
  Object.defineProperties(serviceWorkerGlobalScopePrototype, {
    constructor: {
      value: serviceWorkerGlobalScope,
      writable: true,
      configurable: true,
    },
    [Symbol.toStringTag]: {
      value: 'ServiceWorkerGlobalScope',
      configurable: true,
    },
  });

  serviceWorkerGlobalScope.prototype = serviceWorkerGlobalScopePrototype;
  Object.setPrototypeOf(globalInstance, serviceWorkerGlobalScopePrototype);

  EventTarget.setup(globalInstance, globalInstance);
  mixin(globalInstance, GlobalEventHandlersImpl.prototype);
  globalInstance._initGlobalEvents();

  Object.defineProperty(globalInstance, 'onerror', {
    configurable: true,
    enumerable: true,
    get() {
      return idlUtils.tryWrapperForImpl(
        getCurrentEventHandlerValue(this, 'error')
      );
    },
    set(V) {
      if (!idlUtils.isObject(V)) {
        V = null;
      } else {
        V = OnErrorEventHandlerNonNull.convert(V, {
          context:
            "Failed to set the 'onerror' property on 'ServiceWorkerGlobalScope': The provided value",
        });
      }
      this._setEventHandlerFor('error', V);
    },
  });

  for (const event of events) {
    Object.defineProperty(globalInstance, `on${event}`, {
      configurable: true,
      enumerable: true,
      get() {
        return idlUtils.tryWrapperForImpl(
          getCurrentEventHandlerValue(this, event)
        );
      },
      set(V) {
        if (!idlUtils.isObject(V)) {
          V = null;
        } else {
          V = EventHandlerNonNull.convert(V, {
            context: `Failed to set the 'on${event}' property on 'ServiceWorkerGlobalScope': The provided value`,
          });
        }
        this._setEventHandlerFor(event, V);
      },
    });
  }

  globalInstance._globalObject = globalInstance;
}

// NOTE: per https://heycam.github.io/webidl/#Global, all properties on the Window object must be own-properties.
// That is why we assign everything inside of the constructor, instead of using a shared prototype.
// You can verify this in e.g. Firefox or Internet Explorer, which do a good job with Web IDL compliance.
function ServiceWorkerGlobalScope(options) {
  setupServiceWorkerGlobalScope(this, { runScripts: options.runScripts });

  const rawPerformance = new RawPerformance();

  // eslint-disable-next-line @typescript-eslint/no-this-alias
  const globalInstance = this;

  // ### PRIVATE DATA PROPERTIES

  this._resourceLoader = options.resourceLoader;

  // vm initialization is deferred until script processing is activated
  this._globalProxy = this;
  Object.defineProperty(idlUtils.implForWrapper(this), idlUtils.wrapperSymbol, {
    get: () => this._globalProxy,
  });

  this._virtualConsole = options.virtualConsole;

  this._runScripts = options.runScripts;

  this._storageQuota = options.storageQuota;

  // ### GETTERS

  const performance = Performance.create(globalInstance, [], {
    rawPerformance,
  });

  define(this, {
    // TODO: location, origin
    get performance() {
      return performance;
    },
  });

  // ### METHODS

  // https://html.spec.whatwg.org/multipage/timers-and-user-prompts.html#timers

  // In the spec the list of active timers is a set of IDs. We make it a map of IDs to Node.js timer objects, so that
  // we can call Node.js-side clearTimeout() when clearing, and thus allow process shutdown faster.
  const listOfActiveTimers = new Map();
  let latestTimerId = 0;

  this.setTimeout = function (handler, timeout = 0, ...args) {
    if (typeof handler !== 'function') {
      handler = webIDLConversions.DOMString(handler);
    }
    timeout = webIDLConversions.long(timeout);

    return timerInitializationSteps(handler, timeout, args, {
      methodContext: globalInstance,
      repeat: false,
    });
  };
  this.setInterval = function (handler, timeout = 0, ...args) {
    if (typeof handler !== 'function') {
      handler = webIDLConversions.DOMString(handler);
    }
    timeout = webIDLConversions.long(timeout);

    return timerInitializationSteps(handler, timeout, args, {
      methodContext: globalInstance,
      repeat: true,
    });
  };

  this.clearTimeout = function (handle = 0) {
    handle = webIDLConversions.long(handle);

    const nodejsTimer = listOfActiveTimers.get(handle);
    if (nodejsTimer) {
      clearTimeout(nodejsTimer);
      listOfActiveTimers.delete(handle);
    }
  };
  this.clearInterval = function (handle = 0) {
    handle = webIDLConversions.long(handle);

    const nodejsTimer = listOfActiveTimers.get(handle);
    if (nodejsTimer) {
      // We use setTimeout() in timerInitializationSteps even for this.setInterval().
      clearTimeout(nodejsTimer);
      listOfActiveTimers.delete(handle);
    }
  };

  function timerInitializationSteps(
    handler,
    timeout,
    args,
    { methodContext, repeat, previousHandle }
  ) {
    // This appears to be unspecced, but matches browser behavior for close()ed windows.
    if (!methodContext._document) {
      return 0;
    }

    // TODO: implement timer nesting level behavior.

    const methodContextProxy = methodContext._globalProxy;
    const handle =
      previousHandle !== undefined ? previousHandle : ++latestTimerId;

    function task() {
      if (!listOfActiveTimers.has(handle)) {
        return;
      }

      try {
        if (typeof handler === 'function') {
          handler.apply(methodContextProxy, args);
        } else if (globalInstance._runScripts === 'dangerously') {
          vm.runInContext(handler, globalInstance, {
            filename: globalInstance.location.href,
            displayErrors: false,
          });
        }
      } catch (e) {
        reportException(globalInstance, e, globalInstance.location.href);
      }

      if (listOfActiveTimers.has(handle)) {
        if (repeat) {
          timerInitializationSteps(handler, timeout, args, {
            methodContext,
            repeat: true,
            previousHandle: handle,
          });
        } else {
          listOfActiveTimers.delete(handle);
        }
      }
    }

    if (timeout < 0) {
      timeout = 0;
    }

    const nodejsTimer = setTimeout(task, timeout);
    listOfActiveTimers.set(handle, nodejsTimer);

    return handle;
  }

  // https://html.spec.whatwg.org/multipage/timers-and-user-prompts.html#microtask-queuing

  this.queueMicrotask = function (callback) {
    callback = webIDLConversions.Function(callback);

    anyNodeVersionQueueMicrotask(() => {
      try {
        callback();
      } catch (e) {
        reportException(globalInstance, e, globalInstance.location.href);
      }
    });
  };

  function stopAllTimers() {
    for (const nodejsTimer of listOfActiveTimers.values()) {
      clearTimeout(nodejsTimer);
    }
    listOfActiveTimers.clear();
  }

  this.postMessage = postMessage(globalInstance);

  this.atob = function (str) {
    const result = atob(str);
    if (result === null) {
      throw DOMException.create(globalInstance, [
        'The string to be decoded contains invalid characters.',
        'InvalidCharacterError',
      ]);
    }
    return result;
  };

  this.btoa = function (str) {
    const result = btoa(str);
    if (result === null) {
      throw DOMException.create(globalInstance, [
        'The string to be encoded contains invalid characters.',
        'InvalidCharacterError',
      ]);
    }
    return result;
  };

  // TODO: service worker unregister
  this.close = function () {
    // Clear out all listeners. Any in-flight or upcoming events should not get delivered.
    idlUtils.implForWrapper(this)._eventListeners = Object.create(null);

    stopAllTimers();
  };

  // ### PUBLIC DATA PROPERTIES (TODO: should be getters)

  function wrapConsoleMethod(method) {
    return (...args) => {
      globalInstance._virtualConsole.emit(method, ...args);
    };
  }

  this.console = {
    assert: wrapConsoleMethod('assert'),
    clear: wrapConsoleMethod('clear'),
    count: wrapConsoleMethod('count'),
    countReset: wrapConsoleMethod('countReset'),
    debug: wrapConsoleMethod('debug'),
    dir: wrapConsoleMethod('dir'),
    dirxml: wrapConsoleMethod('dirxml'),
    error: wrapConsoleMethod('error'),
    group: wrapConsoleMethod('group'),
    groupCollapsed: wrapConsoleMethod('groupCollapsed'),
    groupEnd: wrapConsoleMethod('groupEnd'),
    info: wrapConsoleMethod('info'),
    log: wrapConsoleMethod('log'),
    table: wrapConsoleMethod('table'),
    time: wrapConsoleMethod('time'),
    timeLog: wrapConsoleMethod('timeLog'),
    timeEnd: wrapConsoleMethod('timeEnd'),
    trace: wrapConsoleMethod('trace'),
    warn: wrapConsoleMethod('warn'),
  };

  // ### INITIALIZATION
  // TODO: emit install event

  process.nextTick(() => {
    if (!globalInstance.document) {
      return; // window might've been closed already
    }

    const documentImpl = idlUtils.implForWrapper(globalInstance._document);

    if (globalInstance.document.readyState === 'complete') {
      fireAnEvent('load', globalInstance, undefined, {}, documentImpl);
    } else {
      globalInstance.document.addEventListener('load', () => {
        fireAnEvent('load', globalInstance, undefined, {}, documentImpl);
      });
    }
  });
}

function contextifyServiceWorkerGlobalScope(globalInstance) {
  if (vm.isContext(globalInstance)) {
    return;
  }

  vm.createContext(globalInstance);
}
