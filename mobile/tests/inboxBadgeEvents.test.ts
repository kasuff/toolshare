import { describe, it, expect, vi } from 'vitest';
import {
  notifyInboxBadgeRefresh,
  subscribeInboxBadgeRefresh,
} from '../utils/inboxBadgeEvents';

describe('inbox badge events', () => {
  it('invokes subscribed listeners on notify', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeInboxBadgeRefresh(listener);

    notifyInboxBadgeRefresh();
    notifyInboxBadgeRefresh();
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
  });

  it('stops invoking a listener after it unsubscribes', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeInboxBadgeRefresh(listener);

    unsubscribe();
    notifyInboxBadgeRefresh();
    expect(listener).not.toHaveBeenCalled();
  });

  it('fans out to multiple listeners', () => {
    const a = vi.fn();
    const b = vi.fn();
    const unsubA = subscribeInboxBadgeRefresh(a);
    const unsubB = subscribeInboxBadgeRefresh(b);

    notifyInboxBadgeRefresh();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);

    unsubA();
    unsubB();
  });
});
