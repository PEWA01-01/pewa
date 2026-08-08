export function withTimeout<T>(promise: Promise<T>, timeoutMs: number = 4000, fallbackValue?: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve, reject) => {
      setTimeout(() => {
        if (fallbackValue !== undefined) {
          resolve(fallbackValue);
        } else {
          reject(new Error(`Operation timed out after ${timeoutMs}ms`));
        }
      }, timeoutMs);
    })
  ]);
}
