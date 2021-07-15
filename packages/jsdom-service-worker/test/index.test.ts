import assert from 'assert';
import { JSWorker } from '../src';

describe('JSWorker', () => {
  it('should create global', () => {
    const worker = new JSWorker();
    const global = worker.global;
    assert.strictEqual(typeof global.ReadableStream, 'function');
    assert(!('window' in global));
    assert('ServiceWorkerGlobalScope' in global);
    assert(global instanceof global.ServiceWorkerGlobalScope);
  });
});
