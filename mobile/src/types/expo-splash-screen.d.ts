declare module 'expo-splash-screen' {
  export function preventAutoHideAsync(): Promise<void>;
  export function hideAsync(): Promise<void>;
  export function setOptions(options: { duration?: number; fade?: boolean }): void;
}

