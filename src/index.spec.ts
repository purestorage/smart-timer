import { SmartTimer, WebsiteVisibilityObserver, smartTimerFactory } from './';

const fiveSeconds = 5 * 1000;
const tenSeconds = 10 * 1000;
const thirtySeconds = 30 * 1000;
const oneMinute = 60 * 1000;
const tenMinutes = 10 * 60 * 1000;
const twentyMinutes = 20 * 60 * 1000;
const oneHour = 60 * 60 * 1000;

jest.useFakeTimers();

describe('smartTimer', () => {
    let smartTimer: SmartTimer;
    let visibilityObserver: WebsiteVisibilityObserver;
    let mockWindow: any;

    beforeEach(() => {
        mockWindow = {
            document: {
                hidden: false,
            },
            setTimeout: jest.fn(() => 1),
            clearTimeout: jest.fn(),
            addEventListener: jest.fn(),
        };
        const factoryResult = smartTimerFactory(mockWindow);
        smartTimer = factoryResult.smartTimer;
        visibilityObserver = factoryResult.visibilityObserver;
    });

    it('event listener is added on factory creation', () => {
        expect(mockWindow.addEventListener).toHaveBeenCalled();
    });

    it('completes after first emit when interval duration is zero', () => {
        const smartTimer$ = smartTimer(fiveSeconds, 0, 0);
        let complete = false;

        smartTimer$.subscribe({
            next: (n) => {
                expect(n).toBe(0);
            },
            complete: () => {
                complete = true;
            },
        });

        jest.advanceTimersByTime(fiveSeconds);

        expect(complete).toBeTruthy();
    });

    it('is one time timer when no interval value is provided', () => {
        const smartTimer$ = smartTimer(fiveSeconds);
        let complete = false;

        smartTimer$.subscribe({
            next: (n) => {
                expect(n).toBe(0);
            },
            complete: () => {
                complete = true;
            },
        });

        jest.advanceTimersByTime(fiveSeconds);

        expect(complete).toBeTruthy();
    });

    it('works as an interval', () => {
        const smartTimer$ = smartTimer(fiveSeconds, oneMinute, tenMinutes);

        let subscriptionResult: number | undefined = undefined;

        const subscription = smartTimer$.subscribe({
            next: (n) => {
                subscriptionResult = n;
            },
        });

        expect(subscriptionResult).toBeUndefined();

        jest.advanceTimersByTime(fiveSeconds);

        expect(subscriptionResult).toBe(0);

        jest.advanceTimersByTime(oneMinute);

        expect(subscriptionResult).toBe(1);

        jest.advanceTimersByTime(oneMinute);

        expect(subscriptionResult).toBe(2);

        subscription.unsubscribe();
    });

    it('works as a variable interval depending on page being hidden', () => {
        const smartTimer$ = smartTimer(fiveSeconds, oneMinute, tenMinutes);

        let subscriptionResult: number | undefined;

        const subscription = smartTimer$.subscribe({
            next: (n) => {
                subscriptionResult = n;
            },
        });

        expect(subscriptionResult).toBeUndefined();

        jest.advanceTimersByTime(fiveSeconds);

        expect(subscriptionResult).toBe(0);

        jest.advanceTimersByTime(oneMinute);

        expect(subscriptionResult).toBe(1);

        // We have not run full 60 seconds here
        jest.advanceTimersByTime(oneMinute - fiveSeconds);
        expect(subscriptionResult).toBe(1);
        // Change window visibility
        mockWindow.document.hidden = true;
        (visibilityObserver as any).updateIsHidden();
        expect(mockWindow.setTimeout).toHaveBeenCalled();

        // Changing visibility to hidden should not affect the current timer
        jest.advanceTimersByTime(fiveSeconds);
        expect(subscriptionResult).toBe(2);

        jest.advanceTimersByTime(tenSeconds);
        
        let hiddenTriggered = false;
        visibilityObserver.isHidden$.subscribe(() => {
            hiddenTriggered = true;
        });

        // Mock window.setTimeout functionality
        (mockWindow.setTimeout as jest.Mock).mock.calls[0][0]();
        jest.advanceTimersByTime(0);

        // After fifteen seconds being hidden visibility observer should emit that the page is hidden
        expect(hiddenTriggered).toBeTruthy();
        
        // At this point the one minute timer should still be continuing to work
        jest.advanceTimersByTime(oneMinute - tenSeconds);
        expect(subscriptionResult).toBe(3);

        // Now the page being hidden should be detected
        jest.advanceTimersByTime(oneMinute);
        // Inactive timer is ten minutes so now there should not be an extra emit
        expect(subscriptionResult).toBe(3);
        jest.advanceTimersByTime(tenMinutes - oneMinute);
        expect(subscriptionResult).toBe(4);

        jest.advanceTimersByTime(tenMinutes);
        expect(subscriptionResult).toBe(5);

        subscription.unsubscribe();
    });

    it('after page being hidden and comming back into focus, it emmits immediately', () => {
        const smartTimer$ = smartTimer(fiveSeconds, oneMinute, tenMinutes);

        let subscriptionResult: number | undefined;

        const subscription = smartTimer$.subscribe({
            next: (n) => {
                subscriptionResult = n;
            },
        });

        expect(subscriptionResult).toBeUndefined();

        jest.advanceTimersByTime(fiveSeconds);

        expect(subscriptionResult).toBe(0);

        jest.advanceTimersByTime(oneMinute);

        expect(subscriptionResult).toBe(1);

        // Change window visibility
        mockWindow.document.hidden = true;
        (visibilityObserver as any).updateIsHidden();
        expect(mockWindow.setTimeout).toHaveBeenCalled();
        // Mock window.setTimeout functionality
        (mockWindow.setTimeout as jest.Mock).mock.calls[0][0]();

        // Changing visibility to hidden should not affect the current timer
        jest.advanceTimersByTime(oneMinute);
        expect(subscriptionResult).toBe(2);
        
        jest.advanceTimersByTime(tenMinutes);
        
        expect(subscriptionResult).toBe(3);

        jest.advanceTimersByTime(oneMinute);

        mockWindow.document.hidden = false;
        (visibilityObserver as any).updateIsHidden();

        jest.advanceTimersByTime(0);
        expect(subscriptionResult).toBe(4);

        subscription.unsubscribe();
    });

    it('after page being hidden and comming back into focus, it does not emmit immediately if the interval would be lower than provided interval', () => {
        const smartTimer$ = smartTimer(fiveSeconds, oneMinute, tenMinutes);

        let subscriptionResult: number | undefined;

        const subscription = smartTimer$.subscribe({
            next: (n) => {
                subscriptionResult = n;
            },
        });

        expect(subscriptionResult).toBeUndefined();

        jest.advanceTimersByTime(fiveSeconds);

        expect(subscriptionResult).toBe(0);

        jest.advanceTimersByTime(oneMinute);

        expect(subscriptionResult).toBe(1);

        // Change window visibility
        mockWindow.document.hidden = true;
        (visibilityObserver as any).updateIsHidden();
        expect(mockWindow.setTimeout).toHaveBeenCalled();
        // Mock window.setTimeout functionality
        (mockWindow.setTimeout as jest.Mock).mock.calls[0][0]();

        // Changing visibility to hidden should not affect the current timer
        jest.advanceTimersByTime(oneMinute);
        expect(subscriptionResult).toBe(2);
        
        jest.advanceTimersByTime(tenMinutes);
        
        expect(subscriptionResult).toBe(3);

        jest.advanceTimersByTime(thirtySeconds);

        mockWindow.document.hidden = false;
        (visibilityObserver as any).updateIsHidden();

        // We do not want to emit more often than what would always active interval do
        jest.advanceTimersByTime(0);
        expect(subscriptionResult).toBe(3);

        // Now that we reached normal interval emit should happen
        jest.advanceTimersByTime(thirtySeconds);
        expect(subscriptionResult).toBe(4);

        subscription.unsubscribe();
    });

    it('should not emit when page is hidden and inactive interval is zero', () => {
        const smartTimer$ = smartTimer(fiveSeconds, oneMinute, 0);

        let subscriptionResult: number | undefined;

        const subscription = smartTimer$.subscribe({
            next: (n) => {
                subscriptionResult = n;
            },
        });

        expect(subscriptionResult).toBeUndefined();

        jest.advanceTimersByTime(fiveSeconds);

        expect(subscriptionResult).toBe(0);

        jest.advanceTimersByTime(oneMinute);

        expect(subscriptionResult).toBe(1);

        // Change window visibility
        mockWindow.document.hidden = true;
        (visibilityObserver as any).updateIsHidden();
        expect(mockWindow.setTimeout).toHaveBeenCalled();
        // Mock window.setTimeout functionality
        (mockWindow.setTimeout as jest.Mock).mock.calls[0][0]();

        // Changing visibility to hidden should not affect the current timer
        jest.advanceTimersByTime(oneMinute);
        expect(subscriptionResult).toBe(2);
        
        jest.advanceTimersByTime(tenMinutes);
        
        expect(subscriptionResult).toBe(2);

        jest.advanceTimersByTime(thirtySeconds);

        mockWindow.document.hidden = false;
        (visibilityObserver as any).updateIsHidden();

        jest.advanceTimersByTime(0);
        expect(subscriptionResult).toBe(3);

        subscription.unsubscribe();
    });

    it('default inactive interval should be 20 minutes', () => {
        const smartTimer$ = smartTimer(fiveSeconds, oneMinute);

        let subscriptionResult: number | undefined;

        const subscription = smartTimer$.subscribe({
            next: (n) => {
                subscriptionResult = n;
            },
        });

        expect(subscriptionResult).toBeUndefined();

        jest.advanceTimersByTime(fiveSeconds);

        expect(subscriptionResult).toBe(0);

        jest.advanceTimersByTime(oneMinute);

        expect(subscriptionResult).toBe(1);

        // Change window visibility
        mockWindow.document.hidden = true;
        (visibilityObserver as any).updateIsHidden();
        expect(mockWindow.setTimeout).toHaveBeenCalled();
        // Mock window.setTimeout functionality
        (mockWindow.setTimeout as jest.Mock).mock.calls[0][0]();

        // Changing visibility to hidden should not affect the current timer
        jest.advanceTimersByTime(oneMinute);
        expect(subscriptionResult).toBe(2);
        
        jest.advanceTimersByTime(tenMinutes);
        
        expect(subscriptionResult).toBe(2);

        jest.advanceTimersByTime(tenMinutes);

        expect(subscriptionResult).toBe(3);

        jest.advanceTimersByTime(twentyMinutes);

        expect(subscriptionResult).toBe(4);

        subscription.unsubscribe();
    });

    it('default inactive interval should be equal to interval when interval is more than 20 minutes', () => {
        const smartTimer$ = smartTimer(fiveSeconds, oneHour);

        let subscriptionResult: number | undefined;

        const subscription = smartTimer$.subscribe({
            next: (n) => {
                subscriptionResult = n;
            },
        });

        expect(subscriptionResult).toBeUndefined();

        jest.advanceTimersByTime(fiveSeconds);

        expect(subscriptionResult).toBe(0);

        jest.advanceTimersByTime(oneHour);

        expect(subscriptionResult).toBe(1);

        // Change window visibility
        mockWindow.document.hidden = true;
        (visibilityObserver as any).updateIsHidden();
        expect(mockWindow.setTimeout).toHaveBeenCalled();
        // Mock window.setTimeout functionality
        (mockWindow.setTimeout as jest.Mock).mock.calls[0][0]();

        // Changing visibility to hidden should not affect the current timer
        jest.advanceTimersByTime(oneHour);
        
        expect(subscriptionResult).toBe(2);

        jest.advanceTimersByTime(oneHour);

        expect(subscriptionResult).toBe(3);

        subscription.unsubscribe();
    });

    it('each subscription should be on different timer', () => {
        const smartTimer$ = smartTimer(oneMinute, oneMinute);

        let resultA, resultB: number | undefined;

        const subscriptionA = smartTimer$.subscribe(value => {
            resultA = value;
        });

        jest.advanceTimersByTime(oneMinute);

        // After one minute result A should be 0 (one emit) and B should still be undefined
        expect(resultA).toBe(0);
        expect(resultB).toBeUndefined();

        jest.advanceTimersByTime(fiveSeconds);

        const subscriptionB = smartTimer$.subscribe(value => {
            resultB = value;
        });

        jest.advanceTimersByTime(oneMinute - fiveSeconds);

        // After two minutes result A should be 1 (two emits) and B should still be undefined as second subscription happened only 55 seconds ago
        expect(resultA).toBe(1);
        expect(resultB).toBeUndefined();

        jest.advanceTimersByTime(fiveSeconds);

        // After two minutes and 5 seconds result A should be 1 (two emits) and B should be 0 (one emit)
        expect(resultA).toBe(1);
        expect(resultB).toBe(0);

        subscriptionA.unsubscribe();

        jest.advanceTimersByTime(oneMinute);

        // After additional minute B should be 1 (two emits) and A should stay the same since it has been unsubscribed
        expect(resultA).toBe(1);
        expect(resultB).toBe(1);

        subscriptionB.unsubscribe();
    });
});
