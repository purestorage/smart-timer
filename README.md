# Smart-Timer

> A smart way to prevent your Angular website from making unnecessary requests.

## Introduction

Do you use timers to keep your page data fresh? And did you ever wonder what happends when the users switches to another tab? Does the browser intervene and pause the timer or does it keep running? Is it possible that you are just wasting your backend resources to keep the data fresh while the user is not even looking at it?

Truth is that on computer that is not running on battery power, the browser will more or less keep running the timer. On mobile device the browser intervention will be more aggressive but still this is pretty much up to the browser to decide and there are very little resources documenting the exact behavior.

Here is where Smart-Timer comes to the rescue. It allows replacing RXJS `timer` and `interval` observables with `smartTimer` which has exactly the same API but thanks to Page Visibility API it will automatically prolong the intervals for you when the user has left the page for more than 15 seconds. And it will automatically emit once the user returns resulting in immediate refresh of the data. Of course you can configure the "hidden" interval manually or even to be the same as the standard one since for some requests, for example refreshing users auth token it is not desirable change the interval at all.

You can read about how the smart-timer was created in [this blog post](https://blog.purestorage.com/purely-technical/notes-from-a-hackathon-how-to-cut-down-web-requests-by-70/).

## Installation

You just need to install the package from [NPM](https://www.npmjs.com/package/@pstg/smart-timer):

```bash
npm i @pstg/smart-timer
```

and then you are good to go

```typescript
import { smartTimer } from '@pstg/smart-timer';

// When to emit first. 0 to emit immediately
const dueTime = 1000;
// When to do subsequent emits. 0 to emit only after dueTime and never again
const intervalDuration = 5000;

smartTimer(dueTime, intervalDuration).subscribe((value) => {
    this.timerHits += 1;
    console.log('Timer hits: ', this.timerHits);
});
```

And that's it. You can use `smartTimer` exactly the same way as you would use `timer` or `interval` from RXJS.

## Going Further

At Pure Storage we recognised that it doesn't make any sense to use plain timer since `smartTimer` has basicaly no dissadvantages. To ensure that it is the only timer solution used in our codebase, we created couple of eslint rules to keep everyone aware what the default is.

```typescript
// .eslintrc.js
// overrides
{
    // Disable usage of rxjs timer and interval to enforce usage fo smartTimer
    files: "core/src/**/*.ts",
    excludedFiles: ["core/src/utils/smart-timer.ts"],
    rules: {
        "no-restricted-imports": [
            "error", {
                "paths": [{
                    "name": "rxjs",
                    "importNames": ["timer", "interval"],
                    "message": "Do not use default timer, use 'smartTimer' instead"
                }]
            }
        ]
    }
}, 
{
    files: "core/src/**/*.ts",
    excludedFiles: ["core/src/**/*.spec.ts"],
    rules: {
        "no-restricted-globals": [
            "error", {
                name: "setInterval",
                message: "Avoid using global variables.",
            }, {
                name: "setTimeout",
                message: "Avoid using global variables.",
            }
        ],
    },
}

// rules
"no-restricted-properties": ["error", {
        object: 'window',
        property: "setInterval",
        message: "Do not use window.setInterval, use 'smartTimer' instead",
    }],
```
