// https://github.com/YuzuJS/setImmediate/blob/master/setImmediate.js

let currentlyRunningATask = false;
let nextHandle = 1; // Spec says greater than zero
const messagePrefix = "setImmediate$" + Math.random() + "$";
const tasksByHandle = new Map();

function setImmediate(callback) {
  tasksByHandle.set(nextHandle, callback);
  window.postMessage(messagePrefix + nextHandle, "*");
  return nextHandle++;
}

function clearImmediate(handle) {
  tasksByHandle.delete(handle);
}

function run(task) {
  const callback = task.callback;
  const args = task.args;
  switch (args.length) {
  case 0:
    callback();
    break;
  case 1:
    callback(args[0]);
    break;
  case 2:
    callback(args[0], args[1]);
    break;
  case 3:
    callback(args[0], args[1], args[2]);
    break;
  default:
    callback.apply(undefined, args);
    break;
  }
}

function runIfPresent(handle) {
  // From the spec: "Wait until any invocations of this algorithm started before this one have completed."
  // So if we're currently running a task, we'll need to delay this invocation.
  if (currentlyRunningATask) {
    // Delay by doing a setTimeout. setImmediate was tried instead, but in Firefox 7 it generated a
    // "too much recursion" error.
    setTimeout(runIfPresent, 0, handle);
  } else {
    const task = tasksByHandle.get(handle);
    if (task) {
      currentlyRunningATask = true;
      try {
        task();
      } finally {
        clearImmediate(handle);
        currentlyRunningATask = false;
      }
    }
  }
}

window.addEventListener("message", (event) => {
  if (
    event.source === window
    && typeof event.data === "string"
    && event.data.indexOf(messagePrefix) === 0
  ) {
    runIfPresent(+event.data.slice(messagePrefix.length));
  }
}, false);

export default setImmediate;
