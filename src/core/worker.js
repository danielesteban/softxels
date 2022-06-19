class Worker {
  constructor({
    buffer,
    concurrency = navigator.hardwareConcurrency || 1,
    options,
    program,
    script,
  }) {
    this.queue = [];
    program().then((program) => {
      this.instances = Array.from({ length: concurrency }, () => {
        const worker = new script();
        if (buffer) {
          worker.buffer = new Uint8Array(buffer);
        }
        worker.isBusy = true;
        worker.run = ({ operation, resolve }) => {
          worker.isBusy = true;
          worker.resolve = resolve;
          if (buffer) {
            const stride = operation[0].length;
            operation.forEach((chunk, i) => {
              worker.buffer.set(chunk, stride * i)
            });
            worker.postMessage(worker.buffer, [worker.buffer.buffer]);
          } else {
            worker.postMessage(operation);
          }
        };
        const onLoad = () => {
          worker.removeEventListener('message', onLoad);
          worker.addEventListener('message', onData);
          const queued = this.queue.shift();
          if (queued) {
            worker.run(queued);
          } else {
            worker.isBusy = false;
          }
        };
        const onData = ({ data }) => {
          if (buffer) {
            worker.buffer = data.buffer;
            data = data.data;
          }
          const { resolve } = worker;
          delete worker.resolve;
          resolve(data);
          const queued = this.queue.shift();
          if (queued) {
            worker.run(queued);
          } else {
            worker.isBusy = false;
          }
        };
        worker.addEventListener('message', onLoad);
        worker.postMessage({ options, program });
        return worker;
      });
    });
  }

  dispose() {
    const { instances } = this;
    instances.forEach((instance) => instance.terminate());
  }

  run(operation) {
    const { instances, queue } = this;
    return new Promise((resolve) => {
      if (!instances) {
        queue.push({ operation, resolve });
        return;
      }
      let worker;
      for (let i = 0, l = instances.length; i < l; i++) {
        if (!instances[i].isBusy) {
          worker = instances[i];
          break;
        }
      }
      if (!worker) {
        queue.push({ operation, resolve });
        return;
      }
      worker.run({ operation, resolve });
    });
  }
}

export default Worker;
