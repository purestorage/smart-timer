import { Observable } from 'rxjs';

import { WebsiteVisibilityObserver, smartTimerFactory as createCoreSmartTimerFactory, type SmartTimerWindow } from './index';

export type SmartTimer = (dueTime: number, intervalDuration?: number, inactiveIntervalDuration?: number) => Observable<number>;

export function smartTimerFactory(window?: SmartTimerWindow): { smartTimer: SmartTimer; visibilityObserver: WebsiteVisibilityObserver } {
    const { smartTimer: coreSmartTimer, visibilityObserver } = createCoreSmartTimerFactory(window);

    return {
        smartTimer: (dueTime: number, intervalDuration = 0, inactiveIntervalDuration = -1) => new Observable<number>((subscriber) => {
            const subscription = coreSmartTimer(dueTime, intervalDuration, inactiveIntervalDuration).subscribe({
                next: (value) => subscriber.next(value),
                complete: () => subscriber.complete(),
            });

            return () => {
                subscription.unsubscribe();
            };
        }),
        visibilityObserver,
    };
}

export const { smartTimer } = smartTimerFactory(typeof window === 'undefined' ? undefined : window);
