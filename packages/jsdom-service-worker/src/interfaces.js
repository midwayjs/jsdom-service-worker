/* eslint-disable global-require */
'use strict';

// This object defines the mapping between the interface name and the generated interface wrapper code.
// Note: The mapping needs to stay as-is in order due to interface evaluation.
// We cannot "refactor" this to something less duplicative because that would break bundlers which depend on static
// analysis of require()s.
const generatedInterfaces = {
  DOMException: require('domexception/webidl2js-wrapper'),

  URL: require('whatwg-url/webidl2js-wrapper').URL,
  URLSearchParams: require('whatwg-url/webidl2js-wrapper').URLSearchParams,

  EventTarget: require('jsdom/lib/jsdom/living/generated/EventTarget'),

  Event: require('jsdom/lib/jsdom/living/generated/Event'),
  CloseEvent: require('jsdom/lib/jsdom/living/generated/CloseEvent'),
  CustomEvent: require('jsdom/lib/jsdom/living/generated/CustomEvent'),
  MessageEvent: require('jsdom/lib/jsdom/living/generated/MessageEvent'),
  ErrorEvent: require('jsdom/lib/jsdom/living/generated/ErrorEvent'),

  Performance: require('jsdom/lib/jsdom/living/generated/Performance'),
  FileReader: require('jsdom/lib/jsdom/living/generated/FileReader'),
  Blob: require('jsdom/lib/jsdom/living/generated/Blob'),
  File: require('jsdom/lib/jsdom/living/generated/File'),
  FileList: require('jsdom/lib/jsdom/living/generated/FileList'),
  FormData: require('jsdom/lib/jsdom/living/generated/FormData'),

  Headers: require('jsdom/lib/jsdom/living/generated/Headers'),
  AbortController: require('jsdom/lib/jsdom/living/generated/AbortController'),
  AbortSignal: require('jsdom/lib/jsdom/living/generated/AbortSignal'),
};

exports.installInterfaces = (window, globalNames) => {
  // Install generated interface.
  for (const generatedInterface of Object.values(generatedInterfaces)) {
    generatedInterface.install(window, globalNames);
  }
};

// Returns an interface webidl2js wrapper given its an interface name.
exports.getInterfaceWrapper = name => {
  return generatedInterfaces[name];
};
