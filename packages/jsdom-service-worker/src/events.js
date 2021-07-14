// TODO: webidl

function createEvents(global) {
  const { Event, DOMException, Response } = global;

  class ExtendableEvent extends Event {
    constructor(type, eventInitDict) {
      super(type, eventInitDict);
      this._extendLifeTimePromises = [];
      this._pendingPromisesCount = 0;
      this._timedOutFlag;
    }

    get #active() {
      return (
        this._timedOutFlag === undefined ||
        this._pendingPromisesCount > 0 ||
        this._dispatchFlag
      );
    }

    async waitUntil(future) {
      if (!this.#active) {
        throw new DOMException('invalid state', DOMException.INVALID_STATE_ERR);
      }
      future = Promise.resolve(future);
      this._extendLifeTimePromises.push(future);
      this._pendingPromisesCount++;
      Promise.resolve(future).finally(() => {
        this._pendingPromisesCount--;
      });
    }
  }

  class FetchEvent extends ExtendableEvent {
    constructor(type, eventInitDict) {
      super(type, eventInitDict);
      eventInitDict = eventInitDict ?? {};
      this._request = eventInitDict.request;
      this._preloadResponse =
        eventInitDict.preloadResponse ?? Promise.resolve();
      this._clientId = eventInitDict.clientId ?? '';
      this._resultingClientId = eventInitDict.resultingClientId ?? '';
      this._replacesClientId = eventInitDict.replacesClientId ?? '';
      this._handled = eventInitDict.handled ?? Promise.resolve();

      this._waitToRespondFlag = false;
      this._respondWithEnteredFlag = false;
      this._respondWithErrorFlag = false;
      this._potentialResponse = undefined;

      this._respondWithPromise;
    }

    get clientId() {
      return this._clientId;
    }

    get preloadResponse() {
      return this._preloadResponse;
    }

    get replacesClientId() {
      return this._replacesClientId;
    }

    get resultingClientId() {
      return this._resultingClientId;
    }

    get request() {
      return this._request;
    }

    // https://w3c.github.io/ServiceWorker/#fetch-event-respondwith
    respondWith(ret) {
      if (this._respondWithEnteredFlag) {
        throw new DOMException('invalid state', DOMException.INVALID_STATE_ERR);
      }
      ret = Promise.resolve(ret);
      this.waitUntil(ret);
      this._stopPropagationFlag = true;
      this._stopImmediatePropagationFlag = true;
      this._respondWithEnteredFlag = true;
      this._waitToRespondFlag = true;

      this._respondWithPromise = ret.then(
        response => {
          if (!(response instanceof Response)) {
            this._respondWithErrorFlag = true;
            return;
          }
          // TODO: drain Response.body stream.
          this._potentialResponse = new Response(response.body, response);
          this._waitToRespondFlag = false;
        },
        err => {
          this._respondWithErrorFlag = true;
          this._waitToRespondFlag = false;
          throw err;
        }
      );
    }
  }

  return {
    ExtendableEvent,
    FetchEvent,
  };
}

module.exports = createEvents;
