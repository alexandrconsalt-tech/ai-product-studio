declare module "jsdom" {
  export class VirtualConsole {
    on(event: string, callback: (error: unknown) => void): this;
  }

  export class JSDOM {
    constructor(html: string, options?: Record<string, unknown>);
    window: Window & typeof globalThis;
  }
}
