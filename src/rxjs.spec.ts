import { Observable } from 'rxjs';

import { smartTimerFactory } from './rxjs';

const fiveSeconds = 5 * 1000;

jest.useFakeTimers();

describe('smartTimer rxjs adapter', () => {
    it('returns an rxjs Observable', () => {
        const mockWindow: any = {
            document: {
                hidden: false,
            },
            setTimeout: jest.fn((callback, delay) => setTimeout(callback, delay)),
            clearTimeout: jest.fn((timerHandle) => clearTimeout(timerHandle)),
            addEventListener: jest.fn(),
        };

        const { smartTimer } = smartTimerFactory(mockWindow);
        const smartTimer$ = smartTimer(fiveSeconds);

        let emittedValue: number | undefined;
        let completed = false;

        expect(smartTimer$).toBeInstanceOf(Observable);

        smartTimer$.subscribe({
            next: (value) => {
                emittedValue = value;
            },
            complete: () => {
                completed = true;
            },
        });

        jest.advanceTimersByTime(fiveSeconds);

        expect(emittedValue).toBe(0);
        expect(completed).toBeTruthy();
    });
});
