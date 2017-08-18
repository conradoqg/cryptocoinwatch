const path = require('path');
const os = require('os');
const app = require('electron').app;
const nativeImage = require('electron').nativeImage;
const shell = require('electron').shell;
const Menu = require('electron').Menu;
const Tray = require('electron').Tray;
const IconChart = require('./iconChart');
const Theme = require('./theme').default;
const AutoLaunch = require('auto-launch');
const SettingsStore = require('./settingsStore');
const ManagedTimer = require('./managedTimer');
const env = process.env.ENV || 'production';
const StatisticsCalculator = require('./statisticsCalculator');

console.log('Initializing...');

if (env !== 'production') {
    app.setPath('userData', `${app.getPath('userData')} (${env})`);
}
console.log(`Environment: ${env}`);

const appNameSignature = `${app.getName()} v${app.getVersion()}`;
const settingsStore = new SettingsStore(path.join(app.getPath('userData'), 'settings.yaml.txt'));

let appIcon = null;
const iconChart = new IconChart();
const appAutoLauncher = new AutoLaunch({
    name: app.getName()
});
const timer = new ManagedTimer(() => {
    console.log('Updating icon');
    return updateIcon();
});
let tooltipMode = 1;

app.on('ready', () => {
    if (os.platform == 'darwin') app.dock.hide();

    appIcon = new Tray(nativeImage.createFromPath(path.join(app.getAppPath(), 'build/icon.ico')));
    appIcon.setToolTip(appNameSignature);
    appIcon.setContextMenu(createContextMenu());
    appIcon.on('click', () => {
        tooltipMode = (tooltipMode == 1 ? 2 : 1);
        updateIcon();
    });
    appIcon.on('double-click', () => shell.openExternal(settingsStore.get('website') || 'https://www.cryptocompare.com/'));

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
};

const validInterval = (interval) => Math.max(interval * 1000, 10000);

const updateState = () => {
    console.log('Settings changed');
    timer.start(validInterval(settingsStore.get('interval')));
    checkAutoStartup(settingsStore.get('startWithOS'));
};

const updateIcon = () => {
    StatisticsCalculator.type1(settingsStore.get('transactions'), settingsStore.get('market'))
        .then(({ coins, subTotal, total }) => {
            let summaryToolTip = '';
            let coinToolTip = '';

            let coinsBar = coins.map((item) => {
                const coinColor = Theme.COIN[item.coin] || Theme.COIN.RANDOM;
                coinToolTip += `${item.coin}: $${item.price} (${item.changePct24Hour.toFixed(2)}%) = U$${item.total.toFixed(2)}\n`;
                return {
                    value: item.changePct24Hour,
                    max: item.high24Hour,
                    min: item.low24Hour,
                    color: {
                        positive: coinColor,
                        negative: Theme.colorLuminance(coinColor, -0.5)
                    }
                };
            });

            summaryToolTip += `Coin change: ${subTotal.changePctAvg.toFixed(2)}%\n`;
            let subTotalBar = {
                value: subTotal.changePctAvg,
                max: subTotal.maxChangePctAvg,
                min: subTotal.minChangePctAvg,
                color: Theme.SUBTOTAL
            };

            summaryToolTip += `Paid/Current: U$${total.paidValue.toFixed(2)} - U$${total.currentValue.toFixed(2)}\n`;
            summaryToolTip += `Profit/Loss: U$${total.profitLoss.toFixed(2)} (${total.profitLossPct.toFixed(2)}%)`;
            let totalBar = {
                value: total.profitLossPct,
                max: total.maxProfitLossPct,
                min: total.minProfitLossPct,
                color: Theme.TOTAL
            };

            iconChart.getFor(settingsStore.get('percentageLimit'), coinsBar, subTotalBar, totalBar, (buffer) => {
                appIcon.setImage(buffer);

                let tooltip = '';
                if (tooltipMode == 1) tooltip = `${appNameSignature}\n${coinToolTip}`;
                else tooltip = `${appNameSignature}\n${summaryToolTip}`;
                appIcon.setToolTip(tooltip);
            });
        })
        .catch(err => console.error(err));
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
