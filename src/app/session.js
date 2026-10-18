// Narrow application projections, not storage validators or a second durable schema.
// Unknown historical fields remain in each record and survive JSON cloning.
/** @typedef {Record<string, unknown> & {session?:string|number}} HistoryRow
 * @typedef {Record<string, unknown> & {id?:string,libraryId?:string}} ProgramRow
 * @typedef {Record<string, unknown> & {id:string,created?:string,metricIds?:unknown[],metricDefinitions?:unknown[]}} CustomExercise
 * @typedef {Record<string, unknown> & {id?:string,blockId?:string,programDefinition?:unknown}} ProgramMeta
 * @typedef {Record<string, unknown> & {id:string,meta:ProgramMeta,program:ProgramRow[],completedAt:string,review?:unknown,transitionOut?:unknown,archiveId?:string}} ProgramHistory
 * @typedef {Record<string, unknown> & {log:HistoryRow[],program?:ProgramRow[],programMeta?:ProgramMeta,customExercises?:CustomExercise[],programHistory?:ProgramHistory[]}} Snapshot
 * @typedef {{status?:string,effect?:{kind?:string,precondition?:string,[key:string]:unknown},[key:string]:unknown}} DraftEffect
 * @typedef {{committed?:boolean,settled?:boolean,localOk?:boolean,idbOk?:boolean,alreadyCommitted?:boolean,pendingJournalId?:string,head?:Snapshot,revision?:number,conflict?:boolean,staleRevision?:boolean,[key:string]:unknown}} CommitResult
 * @typedef {{reject:true,result:CommitResult}|{proposal:Snapshot}|null} PreflightResult
 * @typedef {Record<string,unknown> & {preflight?:((context:{head:Snapshot})=>PreflightResult|Promise<PreflightResult>)|null,effect?:DraftEffect|null}} CommitOptions
 * @typedef {(proposal:Snapshot,options:CommitOptions,io?:unknown)=>Promise<CommitResult>} Commit
 */

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
    /** @param {T} next */
    publish(next) {
      snapshot = freezeSnapshot(copySnapshot(next));
      onUpdate(snapshot);
      return snapshot;
    },
    /** A rejected command must not poison the next command.
     * @template R @param {()=>R|Promise<R>} command @returns {Promise<R>} */
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
