//TODO: This should extend EventEmitter
class ManagedTimer {
    constructor(fn) {
        this.fn = fn;
        this.lastExecution = null;
    }

    start(ms) {
        if (ms != null) {
            this.ms = ms;
            this.stop();
        }

        this.intervalTimer = setInterval(() => {
            try {
                return this.run();
            } catch (ex) {
                console.error(ex);
            }
        }, this.ms);

        this.checkerTimer = setInterval(() => {
            try {
                if (this.lastExecution != null) {
                    if (Date.now() - this.lastExecution > this.ms + 1000) return this.run();
                }
            } catch (ex) {
                console.error(ex);
            }
        }, 2000);

        this.run();
    }

    stop() {
        if (this.intervalTimer) clearInterval(this.intervalTimer);
        if (this.checkerTimer) clearInterval(this.checkerTimer);
        this.lastExecution = null;
    }

    run() {
        this.lastExecution = Date.now();
        return this.fn();
    }
}

module.exports = ManagedTimer;
