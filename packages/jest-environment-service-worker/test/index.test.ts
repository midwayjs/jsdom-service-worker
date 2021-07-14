import assert from 'assert';
import {
  JSWorkerExtendableEvent,
  JSWorkerFetchEvent,
} from '@midwayjs/jsdom-service-worker';

describe('should bootstrap jest environment', () => {
  it('global should be worker global', () => {
    assert.strictEqual(typeof ReadableStream, 'function');
    assert(!('window' in globalThis));
  });

  it('construct Request', async () => {
    const request = new Request('https://example.com', {
      method: 'POST',
      body: 'foobar',
    });
    assert.strictEqual(await request.text(), 'foobar');
  });

  it('construct Response', async () => {
    const response = new Response('foobar');
    assert.strictEqual(await response.text(), 'foobar');
  });

  it('construct ExtendableEvent', async () => {
    const event = new ExtendableEvent('foo') as JSWorkerExtendableEvent;
    const target = new EventTarget();
    const future = new Promise<void>(resolve => {
      target.addEventListener('foo', (event: any) => {
        event.waitUntil(Promise.resolve('foobar'));
        resolve();
      });
    });
    target.dispatchEvent(event);
    await future;
    const [it] = await Promise.all(event._extendLifeTimePromises);
    assert.strictEqual(it, 'foobar');
  });

  it('construct FetchEvent', async () => {
    const request = new Request('https://example.com', {
      method: 'POST',
      body: 'foobar',
    });
    const event = new FetchEvent('foo', { request }) as JSWorkerFetchEvent;
    const target = new EventTarget();
    const future = new Promise<void>(resolve => {
      target.addEventListener('foo', (event: any) => {
        event.respondWith(
          Promise.resolve().then(async () => {
            assert.strictEqual(await event.request.text(), 'foobar');
            return new Response('foobar');
          })
        );
        resolve();
      });
    });
    target.dispatchEvent(event);
    await future;

    const response = await Promise.resolve(event._respondWithPromise).then(
      () => event._potentialResponse
    );
    assert(response != null);
    assert.strictEqual(await response.text(), 'foobar');
  });

  it.skip('Response with stream as body', async () => {
    const readableStream = new ReadableStream({
      start() {},
      pull(controller) {
        controller.enqueue('foo');
        controller.enqueue('bar');
        controller.close();
      },
    });
    const response = new Response(readableStream);
    assert.strictEqual(await response.text(), 'foobar');
  });
});
