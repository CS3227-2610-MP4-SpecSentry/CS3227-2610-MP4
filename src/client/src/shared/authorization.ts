export interface AuthorizationGeneration {
  current: () => number;
  invalidate: () => void;
}
