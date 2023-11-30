import { Observable, asyncScheduler, BehaviorSubject, switchMap, timer, tap, Subject, filter, throttleTime, merge, take } from 'rxjs';

const DEFAULT_INACTIVE_INTERVAL = 20 * 60 * 1000;

export class WebsiteVisibilityObserver {
    readonly isHidden$: Subject<boolean>;
    hidden: boolean;
    private timerHandle = 0;
    private readonly isHiddenDelay = 15 * 1000;

    constructor(
        private window: Window,
    ) {
        this.isHidden$ = new Subject<boolean>();

        // If document property is not present then there is no point in observing anything (test env)
        if (this.window?.document) {
            this.hidden = this.window.document.hidden;
            this.window.addEventListener('visibilitychange', this.updateIsHidden);
        } else {
            this.hidden = false;
        }
    }

    private updateIsHidden = (): void => {
        const { hidden } = this.window.document;

        if (hidden === this.hidden) {
            this.stopTimer();
        } else if (!hidden) {
            // Becoming visible is propagated immediately
            this.hidden = hidden;
            this.isHidden$.next(hidden);
        } else {
            this.startTimer();
        }
    };

    startTimer(): void {
        this.stopTimer();

        this.timerHandle = this.window.setTimeout(() => {
            this.hidden = true;
            this.isHidden$.next(this.hidden);
            this.timerHandle = 0;
        }, this.isHiddenDelay);
    }

    isHidden(): boolean {
        return this.hidden;
    }

    stopTimer(): void {
        if (this.timerHandle) {
            this.window.clearTimeout(this.timerHandle);
            this.timerHandle = 0;
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
 * @returns Observable that emits a number that is starting at zero and is increasing every emit
 */
export type SmartTimer = (dueTime: number, intervalDuration?: number, inactiveIntervalDuration?: number) => Observable<number>;

// This factory's main purpose is to allow window injection for testing
export function smartTimerFactory(window: Window): { smartTimer: SmartTimer; visibilityObserver: WebsiteVisibilityObserver } {
    const visibilityObserver = new WebsiteVisibilityObserver(window);

    const smartTimer: SmartTimer = (
        dueTime: number,
        intervalDuration = 0,
        inactiveIntervalDuration = -1,
    ): Observable<number> => {
        let calculatedInactiveIntervalDuration = inactiveIntervalDuration;
        
        if (inactiveIntervalDuration < 0) {
            calculatedInactiveIntervalDuration = intervalDuration > DEFAULT_INACTIVE_INTERVAL ? intervalDuration : DEFAULT_INACTIVE_INTERVAL;
        }

        // When there is no intervel there also should not be inactive interval
        if (intervalDuration === 0) {
            calculatedInactiveIntervalDuration = 0;
        }

        return new Observable(subscriber => {
            let n = 0;

            const timer$ = new BehaviorSubject<number>(dueTime);

            let trigger$: Observable<any>;
        
            if (intervalDuration === 0) {
            // This is supposed to mimic a configurable interval
                trigger$ =  timer$.pipe(
                    switchMap(value => timer(value)),
                    take(1),
                );
            } else {
                trigger$ = merge(
                // This is supposed to mimic a configurable interval 
                    timer$.pipe(
                        switchMap(value => timer(value)),
                    ),
                    // Emit when page becomes visible after being hidden
                    visibilityObserver.isHidden$.pipe(
                        // Do not emit when visibility changes to hidden
                        filter(value => !value),
                    ),
                );
            }

            const subscription = trigger$.pipe(
                // No matter visibility changes, only emit every "intervalDuration" at most
                // This is supposed to block unneeded requests for long timers (like 30mins)
                // which could be triggered more frequently than needed when user toggles tab too often
                throttleTime(intervalDuration, asyncScheduler, { leading: true, trailing: true }),
                // Once we get here it is clear that smart timer will emit so we need to
                // ensure that the timer will emit again when time is right
                tap(() => {
                    const nextDueTime = visibilityObserver.isHidden() ? calculatedInactiveIntervalDuration : intervalDuration;
                    if (nextDueTime > 0) {
                        timer$.next(nextDueTime);
                    }
                }),
            ).subscribe({
                next: () => {
                    if (!subscriber.closed) {
                        subscriber.next(n);
                        n++;

                        if (timer$.closed) {
                            subscriber.complete();
                        }
                    }                
                },
                complete: () => {
                    if (!timer$.closed) {
                        timer$.complete();
                    }

                    if (!subscriber.closed) {
                        subscriber.complete();
                    }
                },
            });

            // Add teardown logic for this subscription
            subscription.add(() => {
                if (!subscriber.closed) {
                    subscriber.complete();
                }
                
                if (!timer$.closed) {
                    timer$.complete();
                }
            });

            return subscription;
        });

    };

    return {
        smartTimer,
        visibilityObserver,
    };
}

export const { smartTimer } = smartTimerFactory(window);
