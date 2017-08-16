const app = require('electron').app;
const fs = require('fs');
const yaml = require('js-yaml');
const objectPath = require('object-path');
const EventEmitter = require('events').EventEmitter;
const jetpack = require('fs-jetpack');

class SettingsStore extends EventEmitter {
    constructor(filePath) {
        super();
        this.filePath = filePath;
        this.loadNecessary = true;
        this.load();
        this.startFileMonitor();
    }

    load() {
        if (this.loadNecessary) {
            if (!fs.existsSync(this.filePath)) {
                const dir = app.getPath('userData');
                const userDataDir = jetpack.cwd(dir);
                userDataDir.write(this.filePath, jetpack.cwd(app.getAppPath()).read('build/sampleSettings.yaml.txt', 'utf8'), { atomic: true });
            }
            this.data = yaml.safeLoad(fs.readFileSync(this.filePath));
        }
    }

    get(objPath) {
        this.load();
        return objectPath.get(this.data, objPath);
    }

    startFileMonitor() {
        let fsTimeout = null;

        fs.watch(this.filePath, { persistent: false }, () => {
            this.loadNecessary = true;
            if (!fsTimeout) fsTimeout = setTimeout(() => { this.emit('changed'); fsTimeout = null; }, 300);
        });
    }
}

module.exports = SettingsStore;
