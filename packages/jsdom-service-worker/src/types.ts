export interface JSWorkerExtendableEvent extends ExtendableEvent {
  _extendLifeTimePromises: Promise<unknown>[];
}

export interface JSWorkerFetchEvent
  extends JSWorkerExtendableEvent,
    FetchEvent {
  _potentialResponse?: Response;
  _respondWithPromise?: Promise<void>;
}
