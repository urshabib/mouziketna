/**
 * Application Version and Build Information
 * Injected at build time by Vite define, with safe runtime fallbacks.
 */
declare const __APP_BUILD_TIME__: number | undefined;
declare const __APP_VERSION__: string | undefined;

export const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.2.1';
export const APP_BUILD_TIME = typeof __APP_BUILD_TIME__ !== 'undefined' ? __APP_BUILD_TIME__ : Date.now();
export const APP_NAME = 'MOUZIKETNA';

export interface VersionInfo {
  version: string;
  buildTime: number;
  buildDate: string;
  appName: string;
  gitSha?: string;
  notes?: string;
}

export function getAppBuildInfo(): VersionInfo {
  return {
    version: APP_VERSION,
    buildTime: APP_BUILD_TIME,
    buildDate: new Date(APP_BUILD_TIME).toISOString(),
    appName: APP_NAME,
  };
}
