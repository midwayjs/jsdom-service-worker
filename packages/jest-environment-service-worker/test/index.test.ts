import assert from 'assert';

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
