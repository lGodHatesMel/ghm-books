/**
 * SD Computers mode. When this page is framed by the sd-computers desktop as an app, everything goes
 * through its SDK (`window.computer`) instead of the game's NUI callbacks, and the page fills its window.
 * In a plain, unframed browser tab, add `#computer` to the address to preview it with mock data.
 */

export interface ComputerApi {
  inComputer: boolean;
  isReady: boolean;
  ready(cb?: (c: ComputerApi) => void): Promise<ComputerApi>;
  callServer<T = unknown>(endpoint: string, data?: unknown): Promise<T>;
  print(job: { title?: string; data?: unknown; text?: string }): Promise<boolean>;
  window: { close(): Promise<true>; preventClose(message?: string | boolean | null): Promise<true> };
}

declare global {
  interface Window {
    computer?: ComputerApi;
  }
}

/**
 * The page sits in a frame of a frame: only an sd-computers window does that. The game's own NUI page is
 * itself an iframe of the NUI root page (window.top), so `self !== top` alone is true in the game too and
 * would open the library over the loading screen; an app window is one level deeper (top > sd-computers > app).
 */
export const framed = typeof window !== 'undefined' && window.self !== window.top && window.parent !== window.top;

/** True when this page is an app window on an sd-computers desktop, or a browser preview of one (`#computer`). */
export const computerMode: boolean = framed || (typeof location !== 'undefined' && location.hash === '#computer');

/** The SDK is put into the page after it loads; wait for it. */
export function whenComputer(): Promise<ComputerApi> {
  return new Promise((resolve, reject) => {
    if (window.computer?.isReady) return resolve(window.computer);
    window.addEventListener('computer:ready', (e) => resolve((e as CustomEvent<ComputerApi>).detail), { once: true });
    // The SDK may exist but not be ready yet.
    window.computer?.ready().then(resolve);
    // A frame that is not an sd-computers window never gets the SDK: give up instead of waiting for ever.
    setTimeout(() => reject(new Error('The computer SDK did not load')), 8000);
  });
}
