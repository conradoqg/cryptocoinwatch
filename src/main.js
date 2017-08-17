const path = require('path');
const os = require('os');
const app = require('electron').app;
const nativeImage = require('electron').nativeImage;
const shell = require('electron').shell;
const Menu = require('electron').Menu;
const Tray = require('electron').Tray;
const IconChart = require('./iconChart');
const fetch = require('node-fetch');
const Theme = require('./theme');
const AutoLaunch = require('auto-launch');
const SettingsStore = require('./settingsStore');
const ManagedTimer = require('./managedTimer');
const env = process.env.ENV || 'production';
const Colors = Theme.default;

console.log('Initializing...');

if (env !== 'production') {
    app.setPath('userData', `${app.getPath('userData')} (${env})`);
}
console.log(`Environment: ${env}`);

const appNameSignature = `${app.getName()} v${app.getVersion()}`;
const filePath = path.join(app.getPath('userData'), 'settings.yaml.txt');
const settingsStore = new SettingsStore(filePath);

let appIcon = null;
const iconChart = new IconChart();
const appAutoLauncher = new AutoLaunch({
    name: app.getName()
});
const timer = new ManagedTimer(() => {
    console.log('Updating icon');
    return updateIcon();
});

app.on('ready', () => {
    if (os.platform == 'darwin') app.dock.hide();

    appIcon = new Tray(nativeImage.createFromPath(path.join(app.getAppPath(), 'build/icon.ico')));
    appIcon.setToolTip(appNameSignature);
    appIcon.setContextMenu(createContextMenu());
    appIcon.on('double-click', () => shell.openExternal('https://www.cryptocompare.com/'));

    checkAutoStartup(settingsStore.get('startWithOS'));

    updateState();
    settingsStore.on('changed', () => updateState());
});

app.on('window-all-closed', () => {
    appIcon.destroy();
    app.quit();
});

const createContextMenu = () => {
    return Menu.buildFromTemplate([
        {
            label: 'Settings',
            click: () => shell.openItem(settingsStore.filePath)
        },
        {
            type: 'separator'
        },
        {
            label: 'Exit',
            click: () => app.quit()
        }
    ]);
};

const validInterval = (interval) => Math.max(interval * 1000, 10000);

const updateState = () => {
    console.log('Settings changed');
    timer.start(validInterval(settingsStore.get('interval')));
    checkAutoStartup(settingsStore.get('startWithOS'));
};

const updateIcon = () => {
    const uniqueCoins = new Map();
    const transactions = settingsStore.get('transactions');

    for (var i = 0; i < transactions.length; i++) {
        if (!uniqueCoins.has(transactions[i].coin)) {
            uniqueCoins.set(transactions[i].coin, {
                amount: transactions[i].amount,
                paid: (transactions[i].price * transactions[i].amount) + transactions[i].fee
            });
        } else {
            const coin = uniqueCoins.get(transactions[i].coin);
            coin.amount += transactions[i].amount;
            coin.paid += (transactions[i].price * transactions[i].amount) + transactions[i].fee;

            uniqueCoins.set(transactions[i].coin, coin);
        }
    }

    if (uniqueCoins.size > 0) {
        let coinsParam = Array.from(uniqueCoins.keys()).join(',');

        fetch(`https://min-api.cryptocompare.com/data/pricemultifull?fsyms=${coinsParam}&tsyms=USD&e=${settingsStore.get('market')}&extraParams=cryptowatch`)
            .then(res => res.json())
            .then(json => {
                const bars = [];
                let fixedToolTip = '';
                let variableToolTip = '';
                let totalChanged = 0;

                for (var coin in json.RAW) {
                    if (json.RAW[coin]) {
                        const baseColor = Colors.COIN[coin] || Colors.COIN.RANDOM;

                        bars.push({
                            value: json.RAW[coin].USD.CHANGEPCT24HOUR,
                            color: {
                                positive: baseColor,
                                negaive: Theme.colorLuminance(baseColor, -0.5)
                            }
                        });
                        // TODO: Think about a way to improve this
                        variableToolTip += `${coin}:$${json.RAW[coin].USD.PRICE}(${json.RAW[coin].USD.CHANGEPCT24HOUR.toFixed(2)}%)\n`;
                        totalChanged += json.RAW[coin].USD.CHANGEPCT24HOUR;
                    }
                }

                const changeAvg = totalChanged / bars.length;
                fixedToolTip += `Average: ${changeAvg.toFixed(2)}%\n`;
                const subTotal = {
                    value: changeAvg,
                    color: {
                        positive: Colors.SUBTOTAL.positive,
                        negative: Colors.SUBTOTAL.negative
                    }
                };

                let paidValue = 0;
                let currentValue = 0;
                uniqueCoins.forEach((value, key) => {
                    if (json.RAW[key]) {
                        paidValue += uniqueCoins.get(key).paid;
                        currentValue += json.RAW[key].USD.PRICE * uniqueCoins.get(key).amount;
                    }
                });

                let profitLossPct = ((currentValue * 100) / paidValue) - 100;
                let profitLoss = currentValue - paidValue;
                fixedToolTip += `Profit/Loss: U$${profitLoss.toFixed(2)} (${profitLossPct.toFixed(2)}%)`;
                const total = {
                    value: profitLossPct,
                    color: {
                        positive: Colors.TOTAL.positive,
                        negative: Colors.TOTAL.negative
                    }
                };

                iconChart.getFor(settingsStore.get('percentageLimit'), subTotal, total, bars, (buffer) => {
                    appIcon.setImage(buffer);
                    appIcon.setToolTip(`${appNameSignature}\n${variableToolTip.substring(0, 127 - appNameSignature.length - 1 - fixedToolTip.length - 1)}\n${fixedToolTip}`);
                });
            })
            .catch(err => console.error(err));
    }
};

const checkAutoStartup = (shouldStartup) => {
    console.log('Checking startup');
    appAutoLauncher.isEnabled()
        .then(function (isEnabled) {
            if (process.env.ENV != 'production') {
                if (shouldStartup) {
                    if (!isEnabled) appAutoLauncher.enable();
                } else {
                    if (isEnabled) appAutoLauncher.disable();
                }
            }
        })
        .catch((err) => {
            console.error(err);
        });
};
