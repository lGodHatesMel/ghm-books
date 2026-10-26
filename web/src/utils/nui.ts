import { mockNuiHandlers } from '../mockData';
import { framed, whenComputer } from './computer';

// A page framed by sd-computers sits on the resource's NUI origin without GetParentResourceName, so the host name counts too.
const isInGame = typeof (window as any).GetParentResourceName === 'function' || location.hostname.startsWith('cfx-nui-');

/** True when the page is open in a regular browser (Vite dev server) rather than the FiveM client. */
export const isEnvBrowser = !isInGame;

export function getResourceName(): string {
  if (typeof (window as any).GetParentResourceName === 'function') return (window as any).GetParentResourceName();
  return isInGame ? location.hostname.replace(/^cfx-nui-/, '') : 'ghm-books';
}

export async function fetchNui<T = unknown>(event: string, data?: unknown): Promise<T | null> {
  // Framed by an sd-computers desktop: its SDK is the way to the server, wherever the page is served from.
  if (framed) return callComputer<T>(event, data);

  if (isEnvBrowser) {
    const handler = mockNuiHandlers[event];
    if (!handler) return null;
    await new Promise((resolve) => setTimeout(resolve, 80));
    return (await handler(data)) as T;
  }

  try {
    const resp = await fetch(`https://${getResourceName()}/${event}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify(data ?? {}),
    });
    return (await resp.json()) as T;
  } catch (err) {
    console.error(`[NUI] Failed to fetch ${event}:`, err);
    return null;
  }
}

export function onNuiEvent<T = any>(event: string, callback: (data: T) => void): () => void {
  const handler = (e: MessageEvent) => {
    if (e.data?.action === event) callback(e.data);
  };
  window.addEventListener('message', handler);
  return () => window.removeEventListener('message', handler);
}

/** The NUI events the app uses, as the endpoints the server registers with sd-computers. */
const COMPUTER_ENDPOINTS: Record<string, string> = {
  save: 'save',
  limits: 'limits',
  printers: 'printers',
  mineList: 'mine:list',
  mineGet: 'mine:get',
  minePrint: 'mine:print',
  mineDelete: 'mine:delete',
  mineRestore: 'mine:restore',
};

async function callComputer<T>(event: string, data?: unknown): Promise<T | null> {
  const computer = await whenComputer();
  if (event === 'close') {
    await computer.window.close();
    return null;
  }
  const endpoint = COMPUTER_ENDPOINTS[event];
  if (!endpoint) return null;
  try {
    return await computer.callServer<T>(endpoint, data);
  } catch (err) {
    console.error(`[computer] ${endpoint} failed:`, err);
    return null;
  }
}
