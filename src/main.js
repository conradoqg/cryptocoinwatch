const path = require('path');
const os = require('os');
const app = require('electron').app;
const Menu = require('electron').Menu;
const Tray = require('electron').Tray;
const nativeImage = require('electron').nativeImage;
const shell = require('electron').shell;
const IconChart = require('./iconChart');
const fetch = require('node-fetch');
const Colors = require('./colors');
const AutoLaunch = require('auto-launch');
const SettingsStore = require('./settingsStore');
const ManagedTimer = require('./managedTimer');
const env = process.env.ENV || 'production';

console.log('Initializing...');

if (env !== 'production') {
    const userDataPath = app.getPath('userData');
    app.setPath('userData', `${userDataPath} (${env})`);
}
console.log(`Environment: ${env}`);

let appIcon = null;

const dir = app.getPath('userData');
const filePath = path.join(dir, 'settings.yaml.txt');
let settingsStore = new SettingsStore(filePath);

const appNameSignature = `${app.getName()} v${app.getVersion()}`;
const iconChart = new IconChart();

let appAutoLauncher = new AutoLaunch({
    name: app.getName()
});

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

checkAutoStartup(settingsStore.get('startWithOS'));

app.on('ready', () => {
    if (os.platform == 'darwin') {
        app.dock.hide();
    }
    appIcon = new Tray(nativeImage.createFromPath(path.join(app.getAppPath(), 'build/icon.ico')));

    var contextMenu = Menu.buildFromTemplate([
        {
            label: 'Settings',
            click: () => {
                shell.openItem(settingsStore.filePath);
            }
        },
        {
            type: 'separator'
        },
        {
            label: 'Exit',
            click: () => {
                app.quit();
            }
        }
    ]);

    appIcon.setToolTip(appNameSignature);
    appIcon.setContextMenu(contextMenu);
    appIcon.on('double-click', () => {
        shell.openExternal('https://www.cryptocompare.com/');
    });

    let validInterval = (interval) => Math.max(interval * 1000, 10000);

    let timer = new ManagedTimer(validInterval(settingsStore.get('interval')), () => {
        console.log('Updating icon');
        return updateIcon();
    });

    timer.start();

    settingsStore.on('changed', () => {
        console.log('Settings changed');
        timer.restart(validInterval(settingsStore.get('interval')));
        checkAutoStartup(settingsStore.get('startWithOS'));
    });
});



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
                var fixedToolTip = '';
                var variableToolTip = '';
                var totalChanged = 0;

                for (var coin in json.RAW) {
                    if (json.RAW[coin]) {
                        bars.push({
                            value: json.RAW[coin].USD.CHANGEPCT24HOUR,
                            color: Colors.COIN[coin] || '#' + ((1 << 24) * Math.random() | 0).toString(16)
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

                var paidValue = 0;
                var currentValue = 0;
                uniqueCoins.forEach((value, key) => {
                    if (json.RAW[key]) {
                        paidValue += uniqueCoins.get(key).paid;
                        currentValue += json.RAW[key].USD.PRICE * uniqueCoins.get(key).amount;
                    }
                });

                var profitLossPct = ((currentValue * 100) / paidValue) - 100;
                var profitLoss = currentValue - paidValue;
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

app.on('window-all-closed', () => {
    appIcon.destroy();
    app.quit();
});
