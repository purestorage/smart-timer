const DEFAULT_INACTIVE_INTERVAL = 20 * 60 * 1000;

export type SmartTimerWindow = Pick<Window, 'addEventListener' | 'clearTimeout' | 'document' | 'setTimeout'>;
type SmartTimerNext<T> = (value: T) => void;
type SmartTimerComplete = () => void;
type SmartTimerObserver<T> = {
    next?: SmartTimerNext<T>;
    complete?: SmartTimerComplete;
};
type SmartTimerTeardown = () => void;
type SmartTimerListener<T> = Required<SmartTimerObserver<T>>;
type TimerHandle = ReturnType<typeof globalThis.setTimeout> | number;

export type SmartTimerSubscription = {
    readonly closed: boolean;
    unsubscribe(): void;
};

export interface SmartTimerStream<T> {
    subscribe(observer: SmartTimerObserver<T>): SmartTimerSubscription;
    subscribe(next: SmartTimerNext<T>, complete?: SmartTimerComplete): SmartTimerSubscription;
    ['@@observable'](): SmartTimerStream<T>;
}

class Subscription implements SmartTimerSubscription {
    private teardowns: SmartTimerTeardown[] = [];
    closed = false;

    add(teardown: SmartTimerTeardown): void {
        if (this.closed) {
            teardown();
            return;
        }

        this.teardowns.push(teardown);
    }

    unsubscribe(): void {
        if (this.closed) {
            return;
        }

        this.closed = true;

        const teardowns = [...this.teardowns];
        this.teardowns = [];

        teardowns.forEach((teardown) => teardown());
    }
}

class Stream<T> implements SmartTimerStream<T> {
    constructor(
        private readonly subscribeHandler: (listener: SmartTimerListener<T>) => SmartTimerTeardown | void,
    ) {
    }

    subscribe(
        observerOrNext: SmartTimerObserver<T> | SmartTimerNext<T>,
        complete?: SmartTimerComplete,
    ): SmartTimerSubscription {
        const subscription = new Subscription();
        const observer = typeof observerOrNext === 'function' ? { next: observerOrNext, complete } : observerOrNext;

        const listener: SmartTimerListener<T> = {
            next: (value: T) => {
                if (!subscription.closed) {
                    observer.next?.(value);
                }
            },
            complete: () => {
                if (!subscription.closed) {
                    observer.complete?.();
                    subscription.unsubscribe();
                }
            },
        };

        const teardown = this.subscribeHandler(listener);
        if (teardown) {
            subscription.add(teardown);
        }

        return subscription;
    }

    ['@@observable'](): SmartTimerStream<T> {
        return this;
    }
}

class Subject<T> extends Stream<T> {
    private listeners = new Set<SmartTimerListener<T>>();
    private completed = false;

    constructor() {
        super((listener) => {
            if (this.completed) {
                listener.complete();
                return;
            }

            this.listeners.add(listener);

            return () => {
                this.listeners.delete(listener);
            };
        });
    }

    next(value: T): void {
        if (this.completed) {
            return;
        }

        [...this.listeners].forEach((listener) => listener.next(value));
    }

    complete(): void {
        if (this.completed) {
            return;
        }

        this.completed = true;

        const listeners = [...this.listeners];
        this.listeners.clear();

        listeners.forEach((listener) => listener.complete());
    }
}

export class WebsiteVisibilityObserver {
    readonly isHidden$: Subject<boolean>;
    hidden: boolean;
    private timerHandle?: number;
    private readonly isHiddenDelay = 15 * 1000;

    constructor(
        private readonly window?: SmartTimerWindow,
    ) {
        this.isHidden$ = new Subject<boolean>();

        if (this.window?.document) {
            this.hidden = this.window.document.hidden;
            this.window.addEventListener('visibilitychange', this.updateIsHidden);
        } else {
            this.hidden = false;
        }
    }

    private updateIsHidden = (): void => {
        if (!this.window?.document) {
            return;
        }

        const { hidden } = this.window.document;

        if (hidden === this.hidden) {
            this.stopTimer();
        } else if (!hidden) {
            this.hidden = hidden;
            this.isHidden$.next(hidden);
        } else {
            this.startTimer();
        }
    };

    startTimer(): void {
        this.stopTimer();

        if (!this.window) {
            return;
        }

        this.timerHandle = this.window.setTimeout(() => {
            this.hidden = true;
            this.isHidden$.next(this.hidden);
            this.timerHandle = undefined;
        }, this.isHiddenDelay);
    }

    isHidden(): boolean {
        return this.hidden;
    }

    stopTimer(): void {
        if (this.timerHandle && this.window) {
            this.window.clearTimeout(this.timerHandle);
            this.timerHandle = undefined;
        }
    }
}

/**
 * Smart timer works like default RXJS timer, but will switch to a longer interval when the page is inactive in the browser (eg user minimizes the browser or switches tabs). Use this when you have a timer() that you are okay if it emits less frequently at times, and can emit frequently and/or result in non-trivial operations (like HTTP requests).
 * This is meant to save unnecessary requests when user gets no value from updated content
 * @param dueTime Time in milliseconds how long should smart timer wait before first emit. Zero means emit immediately
 * @param intervalDuration Time in milliseconds how often should smart timer emit when page is visible.
 * Zero means that there will only be one first emit and after that obserable will complete.
 * Also under all circumstances smart timer will not emit more often than interval duration no matter what value inactive interval duration is
 * @param inactiveIntervalDuration Time in milliseconds how often smart timer should emit. Zero means no emits when page is hidden. Negative number means using higher of default inactive interval or standard interval.
 * @returns Stream that emits a number that is starting at zero and is increasing every emit
 */
export type SmartTimer = (dueTime: number, intervalDuration?: number, inactiveIntervalDuration?: number) => SmartTimerStream<number>;

const getDefaultWindow = (): SmartTimerWindow | undefined => typeof window === 'undefined' ? undefined : window;

const normalizeInactiveInterval = (intervalDuration: number, inactiveIntervalDuration: number): number => {
    if (intervalDuration === 0) {
        return 0;
    }

    if (inactiveIntervalDuration < 0) {
        return intervalDuration > DEFAULT_INACTIVE_INTERVAL ? intervalDuration : DEFAULT_INACTIVE_INTERVAL;
    }

    return inactiveIntervalDuration;
};

const createTimerApi = () => ({
    clearTimeout: (timerHandle: TimerHandle | undefined): void => {
        if (!timerHandle) {
            return;
        }

        globalThis.clearTimeout(timerHandle);
    },
    setTimeout: (callback: () => void, delay: number): TimerHandle => {
        return globalThis.setTimeout(callback, delay);
    },
});

// This factory's main purpose is to allow window injection for testing
export function smartTimerFactory(customWindow: SmartTimerWindow | undefined = getDefaultWindow()): { smartTimer: SmartTimer; visibilityObserver: WebsiteVisibilityObserver } {
    const visibilityObserver = new WebsiteVisibilityObserver(customWindow);
    const timerApi = createTimerApi();

    const smartTimer: SmartTimer = (
        dueTime: number,
        intervalDuration = 0,
        inactiveIntervalDuration = -1,
    ): SmartTimerStream<number> => {
        const calculatedInactiveIntervalDuration = normalizeInactiveInterval(intervalDuration, inactiveIntervalDuration);

        return new Stream<number>((listener) => {
            let timerHandle: TimerHandle | undefined;
            let nextEmitAt: number | undefined;
            let emittedCount = 0;
            let lastEmitAt: number | undefined;

            const clearScheduledEmit = (): void => {
                timerApi.clearTimeout(timerHandle);
                timerHandle = undefined;
                nextEmitAt = undefined;
            };

            const scheduleEmitAt = (targetTime: number): void => {
                if (nextEmitAt !== undefined && nextEmitAt <= targetTime) {
                    return;
                }

                clearScheduledEmit();

                nextEmitAt = targetTime;
                timerHandle = timerApi.setTimeout(() => {
                    clearScheduledEmit();
                    emit();
                }, Math.max(0, targetTime - Date.now()));
            };

            const scheduleNextEmit = (delay: number): void => {
                scheduleEmitAt(Date.now() + Math.max(0, delay));
            };

            const emit = (): void => {
                lastEmitAt = Date.now();
                listener.next(emittedCount);
                emittedCount += 1;

                if (intervalDuration === 0) {
                    listener.complete();
                    return;
                }

                const nextDelay = visibilityObserver.isHidden() ? calculatedInactiveIntervalDuration : intervalDuration;
                if (nextDelay > 0) {
                    scheduleNextEmit(nextDelay);
                }
            };

            const visibilitySubscription = visibilityObserver.isHidden$.subscribe((hidden) => {
                if (hidden || lastEmitAt === undefined) {
                    return;
                }

                const elapsed = Date.now() - lastEmitAt;
                if (elapsed >= intervalDuration) {
                    scheduleNextEmit(0);
                    return;
                }

                scheduleNextEmit(intervalDuration - elapsed);
            });

            scheduleNextEmit(dueTime);

            return () => {
                visibilitySubscription.unsubscribe();
                clearScheduledEmit();
            };
        });
    };

    return {
        smartTimer,
        visibilityObserver,
    };
}

export const { smartTimer } = smartTimerFactory();
