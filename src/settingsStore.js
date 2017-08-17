const app = require('electron').app;
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const objectPath = require('object-path');
const EventEmitter = require('events').EventEmitter;

class SettingsStore extends EventEmitter {
    constructor(filePath) {
        super();
        this.watcher = null;
        this.filePath = filePath;
        this.loadNecessary = true;
        this.load();
        this.startFileMonitor();
    }

    load() {
        if (this.loadNecessary) {
            if (!fs.existsSync(this.filePath)) fs.writeFileSync(this.filePath, fs.readFileSync(path.join(app.getAppPath(), 'build/sampleSettings.yaml.txt')));
            this.data = yaml.safeLoad(fs.readFileSync(this.filePath));
            this.loadNecessary = false;
        }
    }

    get(objPath) {
        this.load();
        return objectPath.get(this.data, objPath);
    }

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
