// This is main process of Electron, started as first thing when your
// app starts. This script is running through entire life of your application.
// It doesn't have any windows which you can see on screen, but we can open
// window from here.

import path from 'path';
import url from 'url';
import { app, Menu, Tray, nativeImage, shell } from 'electron';
import { devMenuTemplate } from './menu/dev_menu_template';
import { editMenuTemplate } from './menu/edit_menu_template';
import createWindow from './helpers/window';
import IconChart from './iconChart';
import configStore from './helpers/config';
import fetch from 'node-fetch';

// Special module holding environment variables which you declared
// in config/env_xxx.json file.
import env from './env';

const setApplicationMenu = () => {
    const menus = [editMenuTemplate];
    if (env.name !== 'production') {
        menus.push(devMenuTemplate);
    }
    Menu.setApplicationMenu(Menu.buildFromTemplate(menus));
};

// Save userData in separate folders for each environment.
// Thanks to this you can use production and development versions of the app
// on same machine like those are two separate apps.
if (env.name !== 'production') {
    const userDataPath = app.getPath('userData');
    app.setPath('userData', `${userDataPath} (${env.name})`);
}

const config = configStore.load();
var appIcon = null;
const iconChart = new IconChart();

app.on('ready', () => {
    setApplicationMenu();

    const mainWindow = createWindow('main', {
        width: 1000,
        height: 600,
        show: false
    });

    mainWindow.loadURL(url.format({
        pathname: path.join(__dirname, 'app.html'),
        protocol: 'file:',
        slashes: true,
    }));

    if (env.name === 'development') {
        mainWindow.openDevTools();
    }

    appIcon = new Tray(nativeImage.createFromPath(path.join(__dirname, 'favicon.ico')));
    var contextMenu = Menu.buildFromTemplate([       
        {
            label: 'Settings',
            click: function () {
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
    appIcon.setToolTip('Cryptocoinwatch v0.1.0.');
    appIcon.setContextMenu(contextMenu);
    appIcon.on('double-click', () => {
        shell.openExternal('https://www.cryptocompare.com/');
    })
});

const coinColor = {
    BTC: '#FF8500',
    ETH: '#51B0D1',
    BCH: '#FFEB42',
    XRP: '#CEEAF2',
    LTC: '#CCCCCC'
};

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
                        color: coinColor[coin] || "#" + ((1 << 24) * Math.random() | 0).toString(16)
                    });
                    // TODO: Think about a way to improve this
                    variableToolTip += `${coin}:$${json.RAW[coin].USD.PRICE}(${json.RAW[coin].USD.CHANGEPCT24HOUR.toFixed(2)}%)\n`;
                    totalChanged += json.RAW[coin].USD.CHANGEPCT24HOUR;
                }
            }

            const changeAvg = totalChanged / bars.length
            fixedToolTip += `Average: ${changeAvg.toFixed(2)}%\n`;
            const subTotal = {
                value: changeAvg,
                color: {
                    positive: '#6A9913',
                    negative: '#DA3612'
                }
            }

            var paidValue = 0;
            var currentValue = 0;
            uniqueCoins.forEach((value, key, map) => {
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
                    positive: '#6A9913',
                    negative: '#DA3612'
                }
            }

            iconChart.getFor(config.percentageLimit, subTotal, total, bars, (buffer) => {
                appIcon.setImage(buffer);                
                appIcon.setToolTip('Coinwatch v0.1.0\n' + variableToolTip.substring(0, 127 - 'Cryptowatch v0.1.0\n'.length - fixedToolTip.length) + fixedToolTip);
            })
        })
        .catch(err => console.error(err));
}

setInterval(updateIcon, Math.max(config.interval * 1000, 10000));
updateIcon();

app.on('window-all-closed', () => {
    appIcon.destroy();
    app.quit();
});
