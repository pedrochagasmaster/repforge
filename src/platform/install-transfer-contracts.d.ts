/** Concrete browser protocol capabilities. Unknown JSON stays opaque until the
 * shared wire validator or the named producer has checked it. */
export type JsonRecord=Record<string,unknown>;
export type Contract=ReturnType<typeof import('../interchange/transfer-contract.js').createTransferContract>;
export interface CookieDocument {cookie:string;nodeType?:number;defaultView?:unknown}
export type LocationLike=string|{href:string};
export interface CookieAdapters {document?:CookieDocument;location?:LocationLike;now?:number|string|(()=>number|string)}
export interface Capabilities {
  now():string;TextEncoder:typeof TextEncoder;TextDecoder:typeof TextDecoder;
  atob:typeof atob;btoa:typeof btoa;
  Buffer?:{from(value:Uint8Array|string,encoding?:string):{toString(encoding:string):string;[Symbol.iterator]():Iterator<number>}};
  crypto?:Crypto;fetch?:typeof fetch;indexedDB?:IDBFactory;
  document?:CookieDocument;location?:{href:string};navigator?:{standalone?:boolean};
  matchMedia?:(query:string)=>{matches:boolean};
}
export interface Failure {ok:false;code:string;state?:string;value?:never;status?:never;body?:never}
export type Success<T extends object>={ok:true;code?:never}&T;
export type Result<T>=Failure|Success<{value:T}>;
export type Producer=(()=>unknown|Promise<unknown>)|{logicalCloneSection():unknown|Promise<unknown>}|null|undefined;
export interface DraftSource {
  flush():unknown|Promise<unknown>;current():unknown;
  checkpoint():{status:string;value?:{kind?:string;raw?:unknown}};
  read():{status:string;raw?:unknown};logicalCloneSection(value:unknown):unknown;
}
export interface Sections {workoutDraft?:DraftSource;durableState?:Producer;programEntryDraft?:Producer;uiPreferences?:Producer;analytics?:Producer;telemetryIdentity?:Producer}
export interface LogicalSnapshot {durableState:JsonRecord;workoutDraft:JsonRecord|null;programEntryDraft:JsonRecord|null;uiPreferences:JsonRecord;analytics:JsonRecord;telemetryIdentity:JsonRecord}
export interface Source {context?:string;logicalInstallationId?:string;sourceRevision?:number}
export interface SealedCredential {version:number;algorithm:string;context:string;keyId:string;iv:string;ciphertext:string}
export interface CredentialPair extends JsonRecord {token?:unknown;claimId?:unknown}
export interface CredentialVault {seal(context:string,value:unknown):Promise<SealedCredential>;unseal(context:string,value:unknown):Promise<CredentialPair>;forget(context:string,value:unknown):Promise<void>}
export interface KeyStore {put(context:string,keyId:string,key:CryptoKey):Promise<void>;get(context:string,keyId:string):Promise<CryptoKey|null>;delete(context:string,keyId:string):Promise<void>}
export interface MarkerStore {read():Promise<JsonRecord|null|undefined>;write(marker:JsonRecord):Promise<unknown>;clear():Promise<unknown>}
export interface StorageAdapters {outbound?:MarkerStore;inbound?:MarkerStore;credentials?:CredentialVault;operationLock?:{withLock<T>(name:string,work:()=>T|Promise<T>):Promise<T>}}
export interface TransportRequest {path:string;body:unknown;maxResponseBytes?:number;method?:string;endpoint?:string;headers?:Record<string,string>}
export interface Transport {request(input:TransportRequest):Promise<{status:number;bytes:Uint8Array|ArrayBuffer}>}
export interface CreateOptions {sections?:Sections;source?:Source;sourceAfter?:()=>Sections|Promise<Sections>;consent?:{enabled?:boolean};hasMeaningfulData?:boolean}
export interface ClientOptions {contract?:Contract;crypto?:Crypto;transport?:Transport;context?:string;document?:CookieDocument;location?:LocationLike;storage?:StorageAdapters;now?:()=>string}
