/** JSON snapshots retain the existing durable protocol's clone semantics.
 * @template T @param {T} value @returns {T} */
export function copySnapshot(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

/** @template T @param {T} value @returns {Readonly<T>} */
function freezeSnapshot(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freezeSnapshot(child);
    Object.freeze(value);
  }
  return value;
}

/** One acknowledged read model and command ordering per page. Pending input,
 * editor documents, navigation and storage queues belong to their own owners.
 * publish is a composition-root capability; never hand it to a view.
 * @template T
 * @param {{initialSnapshot:T, onUpdate?:(snapshot:Readonly<T>)=>void}} options */
export function createSession({initialSnapshot, onUpdate = () => {}}) {
  let snapshot = freezeSnapshot(copySnapshot(initialSnapshot));
  let tail = Promise.resolve();
  return Object.freeze({
    read: () => snapshot,
    publish(next) {
      snapshot = freezeSnapshot(copySnapshot(next));
      onUpdate(snapshot);
      return snapshot;
    },
    /** A rejected command must not poison the next command. */
    run(command) {
      const operation = tail.then(command);
      tail = operation.then(() => undefined, () => undefined);
      return operation;
    },
    async idle() {
      for (;;) {
        const pending = tail;
        await pending;
        if (pending === tail) return;
      }
    },
  });
}
