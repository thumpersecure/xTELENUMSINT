/**
 * Minimal concurrency helpers for TELESPOT-NUMSINT popup.
 * Kept dependency-free and MV3-safe.
 */
(() => {
  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Concurrency-limited map that never throws; results are allSettled-like.
   * @template T,U
   * @param {T[]} items
   * @param {number} limit
   * @param {(item: T, index: number) => Promise<U>|U} mapper
   * @param {{ onSettled?: (result: {status:'fulfilled', value: U} | {status:'rejected', reason: any}, index: number) => void }} [opts]
   * @returns {Promise<Array<{status:'fulfilled', value: U} | {status:'rejected', reason: any}>>}
   */
  function allSettledMapLimit(items, limit, mapper, opts = {}) {
    const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.floor(limit)) : 1;
    const results = new Array(items.length);
    let nextIndex = 0;
    let active = 0;

    return new Promise(resolve => {
      const launchMore = () => {
        while (active < safeLimit && nextIndex < items.length) {
          const i = nextIndex++;
          active++;

          Promise.resolve()
            .then(() => mapper(items[i], i))
            .then(
              value => {
                results[i] = { status: 'fulfilled', value };
              },
              reason => {
                results[i] = { status: 'rejected', reason };
              }
            )
            .finally(() => {
              active--;
              try {
                if (opts.onSettled) opts.onSettled(results[i], i);
              } catch {
                // Best-effort progress hook
              }
              if (nextIndex >= items.length && active === 0) {
                resolve(results);
                return;
              }
              launchMore();
            });
        }
      };

      launchMore();
    });
  }

  window.TelespotConcurrency = {
    sleep,
    allSettledMapLimit
  };
})();

