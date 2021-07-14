import { DOMWindow, JSDOM, VirtualConsole } from 'jsdom';
import fetch, { Blob, Headers, Request, Response } from 'node-fetch';
import { TextDecoder, TextEncoder } from 'util';
import { URL, URLSearchParams } from 'url';

const createStream = require('./streams');
const createEvents = require('./events');

type StreamConstruction = {
  ReadableStream: ReadableStream;
  TransformStream: TransformStream;
  WritableStream: WritableStream;
  ReadableStreamDefaultReader: ReadableStreamDefaultReader;
  WritableStreamDefaultWriter: WritableStreamDefaultWriter;
};

const {
  ReadableStream,
  TransformStream,
  WritableStream,
  ReadableStreamDefaultReader,
  WritableStreamDefaultWriter,
} = createStream() as StreamConstruction;

interface Dict<T> {
  [key: string]: T;
}

interface JSWorkerOptions {
  /**
   * url sets the value returned by window.location, document.URL, and document.documentURI,
   * and affects things like resolution of relative URLs within the document
   * and the same-origin restrictions and referrer used while fetching subresources.
   * It defaults to "about:blank".
   */
  url?: string | undefined;
  virtualConsole?: VirtualConsole | undefined;
}

function defineGlobalProperties(globalScope: any, properties: Dict<unknown>) {
  const p: PropertyDescriptorMap = {};
  for (const key of Object.getOwnPropertyNames(properties)) {
    p[key] = {
      value: properties[key],
      enumerable: false,
      configurable: true,
      writable: true,
    };
  }

  Object.defineProperties(globalScope, p);
}

class JSWorkerWorkerGlobalScope {
  constructor(window: DOMWindow) {
    const { ExtendableEvent, FetchEvent } = createEvents({
      Event: window.Event,
      DOMException: window.DOMException,
      Response,
    });

    defineGlobalProperties(this, {
      atob: window.atob,
      btoa: window.btoa,
      // caches,
      console: console,
      fetch,
      clearInterval,
      clearTimeout,
      queueMicrotask,
      setInterval,
      setTimeout,

      AbortSignal: window.AbortSignal,
      AbortController: window.AbortController,
      Blob,
      // Cache,
      // CacheStorage,
      CustomEvent: window.CustomEvent,
      DOMException: window.DOMException,
      Event: window.Event,
      EventTarget: window.EventTarget,
      ExtendableEvent,
      FetchEvent,
      FormData: window.FormData,
      Headers,
      Location: window.Location,
      ReadableStream,
      ReadableStreamDefaultReader,
      Request,
      Response,
      TextDecoder,
      TextEncoder,
      TransformStream,
      URL,
      URLSearchParams,
      WritableStream,
      WritableStreamDefaultWriter,
    });
  }
}

class JSWorkerServiceWorkerGlobalScope extends JSWorkerWorkerGlobalScope {
  constructor(window: DOMWindow) {
    super(window);
    defineGlobalProperties(this, {});
  }
}

class JSWorker {
  dom: JSDOM;
  // TODO: define type
  global: typeof globalThis;

  constructor(options?: JSWorkerOptions) {
    // TODO: contextify with JSDOM
    this.dom = new JSDOM('<!DOCTYPE html>', {
      pretendToBeVisual: true,
      runScripts: 'dangerously',
      url: options?.url,
      virtualConsole:
        options?.virtualConsole ?? new VirtualConsole().sendTo(console),
    });

    const window = this.dom.window;
    const globalScope = new JSWorkerServiceWorkerGlobalScope(window);
    this.global = globalScope as any;
  }
}

export { JSWorker };
export const ServiceWorkerGlobalScope = JSWorkerServiceWorkerGlobalScope;
export * from './types';
