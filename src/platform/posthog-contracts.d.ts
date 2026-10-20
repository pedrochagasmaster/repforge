import type {createTelemetry} from './telemetry.js';
export type Telemetry=ReturnType<typeof createTelemetry>;
export type BootStatus=ReturnType<Telemetry['boot']>;
export interface DeploymentConfig {projectToken?:string;host?:string;sdkVersion?:string;appVersion?:string;releaseChannel?:string}
/** The pinned optional SDK's consumed surface, not a substitute event schema. */
export interface PostHogSdk {
 capture(name:string,properties:Readonly<Record<string,unknown>>):unknown;
 init(token:string,config:ReturnType<typeof import('./posthog.js').createConfig>):unknown;
 opt_out_capturing():unknown;opt_in_capturing():unknown;has_opted_out_capturing?():boolean;
 startSessionRecording?():unknown;stopSessionRecording?():unknown;
 _requestQueue?:{clear?():unknown};
}
export interface AdapterBrowser {
 crypto?:import('./telemetry.js').BootOptions['crypto'];location?:import('./telemetry.js').BootOptions['location'];
 navigator?:unknown;localStorage?:import('./telemetry.js').TelemetryStorage;
 document?:Pick<Document,'createElement'|'head'>;posthog?:PostHogSdk;
}
export type ConfigInput=BootStatus & {host:string;token?:string};
