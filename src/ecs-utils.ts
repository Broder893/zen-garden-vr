import type { Entity } from '@iwsdk/core';

/** The parts of an ECS query that trackFirst needs. */
interface QueryLike {
  entities: Set<Entity>;
  subscribe(event: 'qualify' | 'disqualify', cb: (entity: Entity) => void): () => void;
}

/** A live reference to a query's first entity (null when the query is empty). */
export interface FirstEntity {
  readonly entity: Entity | null;
}

/**
 * Keeps the first entity of a query up to date through subscriptions, so
 * systems can read it every frame without iterating (and allocating) a Set.
 * Unsubscribes are pushed to `cleanup` (pass the system's cleanupFuncs).
 */
export function trackFirst(query: QueryLike, cleanup: (() => void)[]): FirstEntity {
  const ref: { entity: Entity | null } = { entity: null };
  const refill = (except: Entity | null) => {
    ref.entity = null;
    for (const e of query.entities) {
      if (e === except) continue;
      ref.entity = e;
      break;
    }
  };
  cleanup.push(
    query.subscribe('qualify', (e) => {
      if (!ref.entity) ref.entity = e;
    }),
    query.subscribe('disqualify', (e) => {
      if (ref.entity === e) refill(e);
    }),
  );
  refill(null);
  return ref;
}
