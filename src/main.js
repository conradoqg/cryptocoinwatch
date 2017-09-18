const path = require('path');
const os = require('os');
const fs = require('fs-extra');
const app = require('electron').app;
const nativeImage = require('electron').nativeImage;
const shell = require('electron').shell;
const Menu = require('electron').Menu;
const Tray = require('electron').Tray;
const dialog = require('electron').dialog;
const AutoLaunch = require('auto-launch');
const IconChart = require('./iconChart');
const Theme = require('./theme').default;
const SettingsStore = require('./settingsStore');
const ManagedTimer = require('./managedTimer');
const statisticsCalculator = require('./statisticsCalculator');
const env = process.env.ENV || 'production';

console.log('Initializing...');

if (env !== 'production') {
    app.setPath('userData', `${app.getPath('userData')} (${env})`);
}

console.log(`Environment: ${env}`);

const appNameSignature = `${app.getName()} v${app.getVersion()}`;

// Controls
let appIcon = null;
const iconChart = new IconChart();
const appAutoLauncher = new AutoLaunch({ name: app.getName() });
const timer = new ManagedTimer();

// Application state
const settingsStore = new SettingsStore(path.join(app.getPath('userData'), 'settings.yaml.txt'));
let statistics = null;
let lastDataUpdate = null;

app.on('ready', () => {
    if (os.platform() == 'darwin') app.dock.hide();

    appIcon = new Tray(nativeImage.createFromPath(path.join(app.getAppPath(), 'build/icon.ico')));
    appIcon.setToolTip(appNameSignature);
    appIcon.setContextMenu(createContextMenu());
    if (os.platform() != 'darwin') {
        appIcon.on('click', () => {
            return updateData().then(updateUIState);
        });
    }
    appIcon.on('double-click', () => shell.openExternal(settingsStore.get('website') || 'https://www.cryptocompare.com/'));

    checkAutoStartup(settingsStore.get('startWithOS'));

    settingsStore.on('changed', () => updateState());
    timer.on('tick', (success) => {
        console.log('Tick');
        return updateData()
            .then(updateUIState)
            .then(success)
            .catch(console.error);

    });
    updateState();
});

app.on('window-all-closed', () => {
    appIcon.destroy();
    app.quit();
});

/**
 * Create the context menu, if the data is avaiable, add specific menus that shows the statistics.
 */
const createContextMenu = () => {
    let menuItems = [];
    let lastMenu = null;

    const last = (array) => array[array.length - 1];

    if (lastDataUpdate) {
        menuItems.push({
            label: `Last update: ${lastDataUpdate.toLocaleString()}`,
            enabled: false
        });

        menuItems.push({
            type: 'separator'
        });
    }

    if (statistics) {
        menuItems.push({
            label: 'Coins',
            submenu: []
        });

        lastMenu = last(menuItems).submenu;
        for (var i = 0; i < statistics.coins.length; i++) {
            const item = statistics.coins[i];
            if (item.amount != 0 && item.paid > 0) {
                lastMenu.push({
                    label: `${item.coin}: $${item.price.toFixed(2)} ( * ${item.changePct24Hour.toFixed(2)}% = $${item.change24Hour.toFixed(2)}) * ${item.amount.toFixed(6)} = $${item.value.toFixed(2)} - $${item.paid.toFixed(2)} = $${item.profitLoss.toFixed(2)} (${item.profitLossPct.toFixed(2)}%)`,
                    click: () => shell.openExternal(`https://www.cryptocompare.com/coins/${item.coin.toLowerCase()}/overview/USD`)
                });
            }
        }

        lastMenu.push({
            type: 'separator'
        });

        const subTotal = statistics.subTotal;
        lastMenu.push({
            label: `Change: ${subTotal.changeTotalPct.toFixed(2)}% = $${subTotal.changeTotal.toFixed(2)} `,
            enabled: false
        });

        const total = statistics.total;
        lastMenu.push({
            label: `Profit/Loss: $${total.valueTotal.toFixed(2)} - $${total.paidTotal.toFixed(2)} = $${total.profitLoss.toFixed(2)} (${total.profitLossPct.toFixed(2)}%)`,
            enabled: false
        });

        menuItems.push({
            label: 'Wallets',
            submenu: []
        });

        lastMenu = last(menuItems).submenu;
        for (var i = 0; i < statistics.wallets.length; i++) {
            const wallet = statistics.wallets[i];

            if (!(wallet.valueTotal > -0.01 && wallet.valueTotal < 0.01)) {
                lastMenu.push({
                    label: wallet.wallet,
                    submenu: []
                });

                let lastSubMenu = last(lastMenu).submenu;

                for (var x = 0; x < wallet.coins.length; x++) {
                    const walletCoin = wallet.coins[x];
                    if (!(walletCoin.value > -0.01 && walletCoin.value < 0.01)) {
                        lastSubMenu.push({
                            label: `${walletCoin.coin}: $${walletCoin.price.toFixed(2)} * ${walletCoin.amount.toFixed(6)} = $${walletCoin.value.toFixed(2)}`,
                        });
                    }
                }
            }
        }

        menuItems.push({
            label: 'ICOs',
            submenu: []
        });

        lastMenu = last(menuItems).submenu;
        for (var i = 0; i < statistics.icos.length; i++) {
            const ico = statistics.icos[i];
            const value = ico.value ? ico.value : ico.price;
            lastMenu.push({
                label: `${ico.token}: ${ico.amount.toFixed(2)} = $${value.toFixed(2)} - $${ico.price.toFixed(2)} = $${(value - ico.price).toFixed(2)} (${(((ico.price - value) * 100) / ico.price).toFixed(2)}%)`,
                submenu: []
            });
        }
    }

    menuItems = menuItems.concat([
        {
            type: 'separator'
        },
        {
            label: 'Refresh',
            click: () => {
                return updateData()
                    .then(updateUIState)
                    .catch(console.error);
            }
        },
        {
            label: 'Export',
            click: () => {
                return exportData();
            }
        },
        {
            label: 'Settings',
            click: () => shell.openItem(settingsStore.filePath)
        },
        {
            label: 'Help',
            click: () => shell.openExternal(`https://github.com/conradoqg/cryptocoinwatch/blob/v${app.getVersion()}/HELP.md`)
        },
        {
            type: 'separator'
        },
        {
            label: 'Exit',
            click: () => app.quit()
        }
    ]);

    return Menu.buildFromTemplate(menuItems);
};

/**
 * Every change on the settings file will restart the timer and check if the startup is correctly configured.
 */
const updateState = () => {
    console.log('Updating state...');
    timer.start(validInterval(settingsStore.get('interval')));
    checkAutoStartup(settingsStore.get('startWithOS'));
    console.log('State updated.');
};

/**
 * Updates the UI state, including the icon and the context-menu.
 */
const updateUIState = () => {
    console.log('Updating UI state...');
    if (statistics != null) {
        let { coins, subTotal, total } = statistics;

        let coinsBar = [];
        Object.keys(coins).forEach((key) => {
            const coin = coins[key];
            const coinColor = Theme.COIN[coin.coin] || Theme.COIN.RANDOM;
            if (coin.amount != 0 && coin.paid > 0) {
                coinsBar.push({
                    value: coin.changePct24Hour,
                    max: settingsStore.get('percentageLimit.coin'),
                    min: -settingsStore.get('percentageLimit.coin'),
                    color: {
                        positive: coinColor,
                        negative: Theme.colorLuminance(coinColor, -0.5)
                    }
                });
            }
            return;
        });

        coinsBar = coinsBar.slice(0, 4);

        let subTotalBar = {
            span: 2,
            value: subTotal.changeTotalPct,
            max: settingsStore.get('percentageLimit.subTotal'),
            min: -settingsStore.get('percentageLimit.subTotal'),
            color: Theme.SUBTOTAL
        };

        let totalBar = {
            span: 2,
            value: total.profitLossPct,
            max: settingsStore.get('percentageLimit.total'),
            min: -settingsStore.get('percentageLimit.total'),
            color: Theme.TOTAL
        };

        return iconChart.createIconFromBars([...coinsBar, subTotalBar, totalBar])
            .then(icon => {
                console.log('UI state updated.');
                appIcon.setImage(icon);
                appIcon.setContextMenu(createContextMenu());
            });
    }
};

/**
 * Get updated data from the source.
 */
const updateData = () => {
    console.log('Updating data...');
    return statisticsCalculator(settingsStore.get('transactions'), settingsStore.get('transfers'), settingsStore.get('icos'), settingsStore.get('market'))
        .then((newStatistics) => {
            lastDataUpdate = new Date(Date.now());
            console.log('Data updated.');
            statistics = newStatistics;
        });
};

/**
 * Guarantee that the interval has a minimum of 10 seconds.
 * @param {String} interval The interval to check
 */
const validInterval = (interval) => Math.max(interval * 1000, 10000);

/**
 * Check if the startup is configured according the settings.
 * @param {String} shouldStartup If it should configure the program to start
 */
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

const capitalize = (s) => {
    return s && s[0].toUpperCase() + s.slice(1);
};

const exportData = () => {
    dialog.showSaveDialog(null, {
        defaultPath: `${app.getName()}_${(new Date()).toLocaleString().replace(/[ \-\/\:,]/g, '_')}`,
        filters: [
            { name: 'CSV', extensions: ['csv'] },
            { name: 'All Files', extensions: ['*'] }
        ]
    }, (filepath) => {
        var stringify = require('csv-stringify');
        let dataToExport = [];
        let columns = {};

        columns['type'] = capitalize('type');

        settingsStore.get('transactions').forEach((transaction) => {
            Object.keys(transaction).forEach(key => columns[key] = capitalize(key));
            dataToExport.push(Object.assign({
                type: 'Transaction'
            }, transaction));
        });

        settingsStore.get('transfers').forEach((transfer) => {
            Object.keys(transfer).forEach(key => columns[key] = capitalize(key));
            dataToExport.push(Object.assign({
                type: 'Transfer'
            }, transfer));
        });
        settingsStore.get('icos').forEach((ico) => {
            Object.keys(ico).forEach(key => columns[key] = capitalize(key));
            dataToExport.push(Object.assign({
                type: 'ICOs'
            }, ico));
        });

        stringify(dataToExport, {
            header: true,
            columns: columns,
            formatters: {
                date: function (value) {
                    return value.toISOString().substr(0,10);
                }
            }
        }, function (err, output) {
            if (err) dialog.showErrorBox('Unable to export data', err);
            if (filepath) {
                fs.writeFile(filepath, output, (err) => {
                    if (err) dialog.showErrorBox('Unable to export data', err.message);
                    else dialog.showMessageBox(null, {
                        type: 'info',
                        title: 'Export data',
                        message: 'Data exported successfully.'
                    });
                });
            }
        });
    });
};
