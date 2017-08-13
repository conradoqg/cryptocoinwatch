import { app } from 'electron';
import jetpack from 'fs-jetpack';
import path from 'path';
import fs from 'fs';

const dir = app.getPath('userData');
const userDataDir = jetpack.cwd(dir);
const configStoreFile = 'config.json';
const filePath = path.join(dir, configStoreFile);

export default {
    filePath: filePath,
    load: () => {
        if (!fs.existsSync(filePath)) {
            userDataDir.write(configStoreFile, jetpack.read('./app/sampleConfig.json', 'json'), { atomic: true });
        }
        return Object.assign({}, userDataDir.read(configStoreFile, 'json'));
    },

    save: (data) => {
        userDataDir.write(configStoreFile, data, { atomic: true });
    }
};
