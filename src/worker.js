class Worker {
  constructor({
    instances,
    options,
    program,
    script,
  }) {
    this.queue = [];
    program().then((program) => {
      this.instances = [...Array(instances)].map(() => {
        const worker = new script();
        const onLoad = () => {
          worker.removeEventListener('message', onLoad);
          worker.addEventListener('message', onData);
        };
        const onData = ({ data }) => {
          const { resolve } = worker;
          delete worker.resolve;
          resolve(data);
          const queued = this.queue.shift();
          if (queued) {
            const { operation, resolve } = queued;
            worker.resolve = resolve;
            worker.postMessage(operation);
          } else {
            worker.isBusy = false;
          }
        };
        worker.addEventListener('message', onLoad);
        worker.postMessage({ options, program });
        return worker;
      });
      if (this.queue.length) {
        this.queue.splice(0, instances).forEach(({ operation, resolve }) => (
          this.run(operation).then(resolve)
        ));
      }
    });
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
      worker.isBusy = true;
      worker.resolve = resolve;
      worker.postMessage(operation);
    });
  }
}

export default Worker;
