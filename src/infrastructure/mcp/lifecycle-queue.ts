export function serializeLifecycle() {
  let pending = Promise.resolve();

  return <A>(operation: () => Promise<A>): Promise<A> => {
    const result = pending.then(operation);
    pending = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };
}
