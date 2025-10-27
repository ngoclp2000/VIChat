declare namespace React {
  type ReactNode = any;

  interface ComponentType<P = {}> {
    (props: P & { children?: ReactNode }): ReactNode;
  }

  interface CSSProperties {
    [key: string]: string | number;
  }

  interface SyntheticEvent<T = any> {
    target: T;
    currentTarget: T;
    preventDefault(): void;
    stopPropagation(): void;
  }

  interface FormEvent<T = any> extends SyntheticEvent<T> {}

  interface ChangeEvent<T = any> extends SyntheticEvent<T> {}

  interface KeyboardEvent<T = any> extends SyntheticEvent<T> {
    key: string;
  }

  interface MouseEvent<T = any> extends SyntheticEvent<T> {}

  interface MutableRefObject<T> {
    current: T;
  }
}

declare module 'react' {
  export type ReactNode = React.ReactNode;
  export type ComponentType<P = {}> = React.ComponentType<P>;
  export type CSSProperties = React.CSSProperties;
  export type SyntheticEvent<T = any> = React.SyntheticEvent<T>;
  export type FormEvent<T = any> = React.FormEvent<T>;
  export type ChangeEvent<T = any> = React.ChangeEvent<T>;
  export type KeyboardEvent<T = any> = React.KeyboardEvent<T>;
  export type MouseEvent<T = any> = React.MouseEvent<T>;
  export interface MutableRefObject<T> extends React.MutableRefObject<T> {}
  export type Dispatch<A> = (value: A) => void;

  export function useState<S>(initialState: S | (() => S)): [S, Dispatch<S | ((prev: S) => S)>];
  export function useEffect(effect: () => void | (() => void), deps?: readonly any[]): void;
  export function useMemo<T>(factory: () => T, deps: readonly any[]): T;
  export function useCallback<T extends (...args: any[]) => any>(callback: T, deps: readonly any[]): T;
  export function useRef<T>(initialValue: T): MutableRefObject<T>;
  export function useRef<T>(initialValue: T | null): MutableRefObject<T | null>;

  export const Fragment: unique symbol;
  export const StrictMode: ComponentType<{ children?: ReactNode }>;

  const React: {
    Fragment: typeof Fragment;
    StrictMode: ComponentType<{ children?: ReactNode }>;
  };

  export default React;
}

declare module 'react/jsx-runtime' {
  export const jsx: unknown;
  export const jsxs: unknown;
  export const Fragment: unknown;
}

declare module 'react/jsx-dev-runtime' {
  export const jsxDEV: unknown;
  export const Fragment: unknown;
}

declare namespace JSX {
  interface Element {}
  interface IntrinsicElements {
    [elemName: string]: any;
  }
}
