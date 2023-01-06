import assert from 'assert';
import { JSWorker } from '../src';

describe('JSWorker', () => {
  it('should create global', () => {
    const worker = new JSWorker();
    const global = worker.global;
    assert.strictEqual(typeof global.ReadableStream, 'function');
    // erase type to avoid typescript from discriminating the type of global.
    assert(!('window' in (global as any)));
    assert('ServiceWorkerGlobalScope' in (global as any));
    assert(global instanceof global.ServiceWorkerGlobalScope);
  });
});
