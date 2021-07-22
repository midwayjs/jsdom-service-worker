import { Context, runInContext } from 'vm';
import { ModuleMocker } from 'jest-mock';
import { JSWorker } from '@midwayjs/jsdom-service-worker';

class WorkerEnvironment {
  worker: JSWorker;
  context: Context | null;
  // TODO: define global;
  global: any;
  moduleMocker: ModuleMocker | null;

  constructor() {
    this.worker = new JSWorker();
    this.context = this.worker.context;
    const global = (this.global = runInContext('globalThis', this.context));
    global.global = global;
    global.Error.stackTraceLimit = Infinity;

    // Node.js Specific globals, used in jest/source-map-support.
    const knownProcessAccess: PropertyKey[] = [
      '_isMockFunction',
      'env',
      'platform',
      'cwd',
      'chdir',
      'version',
      'stdout',
      '_events',
      'listeners',
    ];
    const processPropertyBlockList: PropertyKey[] = ['exit'];
    global.process = new Proxy(process, {
      has(target, p) {
        if (processPropertyBlockList.includes(p)) {
          return false;
        }
        return p in target;
      },
      get(target, p) {
        if (processPropertyBlockList.includes(p)) {
          return undefined;
        }
        if (!knownProcessAccess.includes(p)) {
          console.trace('access process', p);
        }
        return (target as any)[p];
      },
    });
    global.Buffer = Buffer;

    this.moduleMocker = new ModuleMocker(global);
  }

  async setup() {}

  async teardown() {
    this.context = null;
  }

  getVmContext() {
    return this.context;
  }
}

export default WorkerEnvironment;
