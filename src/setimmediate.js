// A minimal version of:
// https://github.com/YuzuJS/setImmediate/blob/master/setImmediate.js

let currentlyRunningATask = false;
let nextHandle = 1; // Spec says greater than zero
const messagePrefix = "setImmediate$" + Math.random() + "$";
const { length: messagePrefixLength } = messagePrefix;
const tasksByHandle = new Map();

export function setImmediate(callback) {
  tasksByHandle.set(nextHandle, callback);
  window.postMessage(messagePrefix + nextHandle, "*");
  return nextHandle++;
}

export function clearImmediate(handle) {
  tasksByHandle.delete(handle);
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
    runIfPresent(+event.data.slice(messagePrefixLength));
  }
}, false);
