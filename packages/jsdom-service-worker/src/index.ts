import { VirtualConsole } from 'jsdom';
import fetch, { Blob, Headers, Request, Response } from 'node-fetch';
import { TextDecoder, TextEncoder } from 'util';
import { URL, URLSearchParams } from 'url';
import { Context } from 'vm';

const {
  createServiceWorkerGlobalScope,
} = require('./service-worker-global-scope');
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

class JSWorker {
  context: Context;
  // TODO: define type
  global: typeof globalThis;

  constructor() {
    const virtualConsole = new VirtualConsole();
    const globalScope = createServiceWorkerGlobalScope({
      virtualConsole,
      runScripts: 'dangerously',
    });
    const { ExtendableEvent, FetchEvent } = createEvents({
      Event: globalScope.Event,
      DOMException: globalScope.DOMException,
      Response,
    });
    defineGlobalProperties(globalScope, {
      fetch,
      Blob,
      ExtendableEvent,
      FetchEvent,
      Headers,
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
    this.global = this.context = globalScope as any;
  }
}

export { JSWorker };
export * from './types';
