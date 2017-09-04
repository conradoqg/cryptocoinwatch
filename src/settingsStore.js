const app = require('electron').app;
const fs = require('fs-extra');
const path = require('path');
const yaml = require('js-yaml');
const objectPath = require('object-path');
const EventEmitter = require('events').EventEmitter;

/**
 * Settings store
 */
class SettingsStore extends EventEmitter {
    /**
     * Constructs the Settings Store that uses the filePath as the YAML storage
     * @param {String} filePath Path to read the data from
     */
    constructor(filePath) {
        super();
        this.watcher = null;
        this.filePath = filePath;
        this.loadNecessary = true;
        this.load();
        this.startFileMonitor();
    }

    /**
     * Load the data if necessary. If the settings file doesn't exist, creates it based on a sample settings file.
     */
    load() {
        if (this.loadNecessary) {
            if (!fs.existsSync(this.filePath)) {
                fs.ensureFileSync(this.filePath);
                fs.writeFileSync(this.filePath, fs.readFileSync(path.join(app.getAppPath(), 'build/sampleSettings.yaml.txt')));
            }
            this.data = yaml.safeLoad(fs.readFileSync(this.filePath));
            this.loadNecessary = false;
        }
    }

    /**
     * Get a settings property given a path. Based on object-path module.
     * @param {String} objPath
     * @returns The data from the given property path
     */
    get(objPath) {
        this.load();
        return objectPath.get(this.data, objPath);
    }

    /**
     * Monitor changes on settings file, if it happens, mark the store to be reload.
     */
    startFileMonitor() {
        let fsTimeout = null;

        this.watcher = fs.watchFile(this.filePath, { persistent: false, interval: 2000 }, () => {
            try {
                this.loadNecessary = true;
                if (!fsTimeout) fsTimeout = setTimeout(() => { this.emit('changed'); fsTimeout = null; }, 300);
            } catch (ex) {
                console.error(ex);
            }
        });
    }
}

module.exports = SettingsStore;
