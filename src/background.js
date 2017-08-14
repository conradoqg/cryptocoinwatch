import path from 'path';
import { app, Menu, Tray, nativeImage, shell } from 'electron';
import IconChart from './iconChart';
import configStore from './helpers/config';
import fetch from 'node-fetch';
import Colors from './colors';
import AutoLaunch from 'auto-launch';

import env from './env';

if (env.name !== 'production') {
    const userDataPath = app.getPath('userData');
    app.setPath('userData', `${userDataPath} (${env.name})`);
}

var appIcon = null;
const config = configStore.load();
const appNameSignature = `${app.getName()} v${app.getVersion()}`;
const iconChart = new IconChart();

var appAutoLauncher = new AutoLaunch({
    name: appNameSignature,
    path: `/Applications/${capitalize(app.getName())}.app`
});

appAutoLauncher.isEnabled()
    .then(function (isEnabled) {
        if (config.startWithOS) {
            if (!isEnabled) appAutoLauncher.enable();
        } else {
            if (isEnabled) appAutoLauncher.disable();
        }

    })
    .catch((err) => {
        console.error(err);
    });

function capitalize(s) {
    return s && s[0].toUpperCase() + s.slice(1);
}

app.on('ready', () => {
    appIcon = new Tray(nativeImage.createFromPath(path.join(__dirname, 'favicon.ico')));

    var contextMenu = Menu.buildFromTemplate([
        {
            label: 'Settings',
            click: () => {
                shell.openItem(configStore.filePath);
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

    var lastExecution = Date.now();
    var interval = Math.max(config.interval * 1000, 10000);
    updateIcon();

    // Check every 2 seconds if the icon was updated, if the computer awakes from sleep, the time passed doesn't count, so it forces an update.
    setInterval(() => {
        if (Date.now() - lastExecution > interval + 1000) updateIcon();
    }, 2000);

    // Main icon updater
    setInterval(() => {
        lastExecution = Date.now();
        updateIcon();
    }, interval);
});

const updateIcon = () => {
    const uniqueCoins = new Map();

    for (var i = 0; i < config.transactions.length; i++) {
        if (!uniqueCoins.has(config.transactions[i].coin)) {
            uniqueCoins.set(config.transactions[i].coin, {
                amount: config.transactions[i].amount,
                paid: (config.transactions[i].price * config.transactions[i].amount) + config.transactions[i].fee
            });
        } else {
            const coin = uniqueCoins.get(config.transactions[i].coin);
            coin.amount += config.transactions[i].amount;
            coin.paid += (config.transactions[i].price * config.transactions[i].amount) + config.transactions[i].fee;

            uniqueCoins.set(config.transactions[i].coin, coin);
        }
    }

    let coinsParam = Array.from(uniqueCoins.keys()).join(',');

    fetch(`https://min-api.cryptocompare.com/data/pricemultifull?fsyms=${coinsParam}&tsyms=USD&e=${config.market}&extraParams=cryptowatch`)
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

            iconChart.getFor(config.percentageLimit, subTotal, total, bars, (buffer) => {
                appIcon.setImage(buffer);
                appIcon.setToolTip(`${appNameSignature}\n${variableToolTip.substring(0, 127 - appNameSignature.length - 1 - fixedToolTip.length - 1)}\n${fixedToolTip}`);
            });
        })
        .catch(err => console.error(err));
};

app.on('window-all-closed', () => {
    appIcon.destroy();
    app.quit();
});
