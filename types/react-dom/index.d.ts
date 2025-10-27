declare module 'react-dom/client' {
  import type { ReactNode } from 'react';

  export interface Root {
    render(children: ReactNode): void;
  }

  export interface ReactDomClient {
    createRoot(container: Element | DocumentFragment): Root;
  }

  const client: ReactDomClient;
  export default client;
  export function createRoot(container: Element | DocumentFragment): Root;
}
