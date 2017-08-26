const EventEmitter = require('events').EventEmitter;

/**
 * Managed timer that keeps itself on check and guarantee that the timer is executed even after a sleep.
 */
class ManagedTimer extends EventEmitter {
    constructor() {
        super();
        this.lastExecution = null;
    }

    /**
     * Starts or restart the timer
     * @param {Integer} ms Value in milliseconds
     */
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
                    if (Date.now() - this.lastExecution > this.ms + 1000) {
                        return this.run();
                    }
                } else {
                    return this.run();
                }
            } catch (ex) {
                console.error(ex);
            }
        }, 2000);

        this.run();
    }

    /**
     * Stop the timer
     */
    stop() {
        if (this.intervalTimer) clearInterval(this.intervalTimer);
        if (this.checkerTimer) clearInterval(this.checkerTimer);
        this.lastExecution = null;
    }

    /**
     * Run the timer tick
     */
    run() {
        return this.emit('tick', this.success.bind(this));
    }

    /**
     * Inform the successfull run of a tick
     */
    success() {
        this.lastExecution = Date.now();
    }
}

module.exports = ManagedTimer;
