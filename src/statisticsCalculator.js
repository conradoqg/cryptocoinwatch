const fetch = require('node-fetch');

const getOrDefault = (map, key, defaultValue) => {
    let value = null;
    if (map[key]) value = map[key];
    else {
        if (typeof (defaultValue) == 'object')
            value = copy(defaultValue);
        else
            value = defaultValue;
    }
    return value;
};

const copy = (o) => {
    var out, v, key;
    out = Array.isArray(o) ? [] : {};
    for (key in o) {
        v = o[key];
        out[key] = (typeof v === 'object') ? copy(v) : v;
    }
    return out;
};

/**
 * Calculate the statistics for transactions, transfers for a given market
 *
 * @param {Array} transactions List of transactions
 * @param {Array} transfers List of transfers
 * @param {String} market Market name to retrieve information from
 */
const statisticsCalculator = (transactions, transfers, market) => {
    const uniqueCoins = {};
    const uniqueWallets = {};
    const defaultCoinValue = {
        amount: 0,
        paid: 0
    };
    const defaultWalletValue = {
        uniqueCoins: {}
    };
    const defaultCoinWalletValue = {
        amount: 0
    };

    if (transactions) {
        for (var i = 0; i < transactions.length; i++) {
            const transaction = transactions[i];
            let coinKey = transaction.coin;
            let coin = getOrDefault(uniqueCoins, coinKey, defaultCoinValue);

            let walletKey = transaction.wallet ? transaction.wallet : 'Unknown';
            let wallet = getOrDefault(uniqueWallets, walletKey, defaultWalletValue);
            let coinWallet = getOrDefault(wallet.uniqueCoins, coinKey, defaultCoinWalletValue);

            const operation = transaction.operation || 'buy';

            if (operation == 'buy') {
                coin.amount += transaction.amount;
                coin.paid += (transaction.price * transaction.amount) + transaction.fee;
                coinWallet.amount += transaction.amount;
            } else {
                coin.amount -= transaction.amount;
                coin.paid -= (transaction.price * transaction.amount) + transaction.fee;
                coinWallet.amount -= transaction.amount;
            }

            uniqueCoins[coinKey] = coin;
            wallet.uniqueCoins[coinKey] = coinWallet;
            uniqueWallets[walletKey] = wallet;
        }
    }

    if (transfers) {
        for (var i = 0; i < transfers.length; i++) {
            let transfer = transfers[i];
            let coinKey = transfer.coin;
            let coin = getOrDefault(uniqueCoins, coinKey, defaultCoinValue);

            let walletKey = transfer.wallet ? transfer.wallet : 'Unknown';
            let wallet = getOrDefault(uniqueWallets, walletKey, defaultWalletValue);
            let coinWallet = getOrDefault(wallet.uniqueCoins, coinKey, defaultCoinWalletValue);

            const fee = transfer.fee ? transfer.fee : 0;

            if (transfers[i].from == 'me') {
                coin.amount -= transfer.amount + fee;
                coinWallet.amount -= transfer.amount + fee;
            }
            if (transfers[i].to == 'me') {
                coin.amount += transfer.amount;
                coinWallet.amount += transfer.amount;
            }

            uniqueCoins[coinKey] = coin;
            wallet.uniqueCoins[coinKey] = coinWallet;
            uniqueWallets[walletKey] = wallet;
        }
    }

    if (Object.keys(uniqueCoins).length > 0) {
        let coinsParam = Object.keys(uniqueCoins).join(',');

        return fetch(`https://min-api.cryptocompare.com/data/pricemultifull?fsyms=${coinsParam}&tsyms=USD&e=${market}&extraParams=cryptowatch`)
            .then((res) => {
                return res.json();
            })
            .then(json => {
                if (json.Response && json.Response == 'Error') throw new Error(json.Message);

                const coins = [];
                const wallets = [];

                let changeTotal = 0;
                let changePctTotal = 0;
                let maxChangePctTotal = 0;
                let minChangePctTotal = 0;
                let paidTotal = 0;
                let priceTotal = 0;
                let highTotal = 0;
                let lowTotal = 0;
                let valueTotal = 0;
                let highValueTotal = 0;
                let lowValueTotal = 0;

                Object.keys(uniqueCoins).forEach((coinKey) => {
                    if (json.RAW[coinKey]) {
                        const value = json.RAW[coinKey].USD.PRICE * uniqueCoins[coinKey].amount;
                        coins.push({
                            coin: coinKey,
                            change24Hour: json.RAW[coinKey].USD.CHANGE24HOUR,
                            changePct24Hour: json.RAW[coinKey].USD.CHANGEPCT24HOUR,
                            price: json.RAW[coinKey].USD.PRICE,
                            high24Hour: json.RAW[coinKey].USD.HIGH24HOUR,
                            low24Hour: json.RAW[coinKey].USD.LOW24HOUR,
                            amount: uniqueCoins[coinKey].amount,
                            paid: uniqueCoins[coinKey].paid,
                            value: value,
                            profitLoss: value - uniqueCoins[coinKey].paid,
                            profitLossPct: ((value * 100) / uniqueCoins[coinKey].paid) - 100
                        });
                        changeTotal += json.RAW[coinKey].USD.CHANGE24HOUR;
                        changePctTotal += json.RAW[coinKey].USD.CHANGEPCT24HOUR;
                        maxChangePctTotal += ((json.RAW[coinKey].USD.HIGH24HOUR * 100) / json.RAW[coinKey].USD.OPEN24HOUR) - 100;
                        minChangePctTotal += ((json.RAW[coinKey].USD.LOW24HOUR * 100) / json.RAW[coinKey].USD.OPEN24HOUR) - 100;
                        paidTotal += uniqueCoins[coinKey].paid;
                        priceTotal += json.RAW[coinKey].USD.PRICE;
                        highTotal += json.RAW[coinKey].USD.HIGH24HOUR;
                        lowTotal += json.RAW[coinKey].USD.LOW24HOUR;
                        valueTotal += json.RAW[coinKey].USD.PRICE * uniqueCoins[coinKey].amount;
                        highValueTotal += json.RAW[coinKey].USD.HIGH24HOUR * uniqueCoins[coinKey].amount;
                        lowValueTotal += json.RAW[coinKey].USD.LOW24HOUR * uniqueCoins[coinKey].amount;
                    }
                });

                Object.keys(uniqueWallets).forEach((walletKey) => {
                    let uniqueCoins = uniqueWallets[walletKey].uniqueCoins;
                    let coins = [];
                    Object.keys(uniqueCoins).forEach((coinKey) => {
                        if (json.RAW[coinKey]) {
                            const value = json.RAW[coinKey].USD.PRICE * uniqueCoins[coinKey].amount;
                            coins.push({
                                coin: coinKey,
                                price: json.RAW[coinKey].USD.PRICE,
                                amount: uniqueCoins[coinKey].amount,
                                value: value,
                            });
                        }
                    });

                    wallets.push({
                        wallet: walletKey,
                        coins: coins
                    });
                });

                const subTotal = {
                    changeTotalPct: (changeTotal * 100) / priceTotal,
                    changeTotal: changeTotal,
                    maxChangePctAvg: ((highTotal - priceTotal) * 100) / priceTotal,
                    minChangePctAvg: ((lowValueTotal - priceTotal) * 100) / priceTotal
                };

                const total = {
                    profitLossPct: ((valueTotal * 100) / paidTotal) - 100,
                    maxProfitLossPct: ((highValueTotal * 100) / paidTotal) - 100,
                    minProfitLossPct: ((lowValueTotal * 100) / paidTotal) - 100,
                    profitLoss: valueTotal - paidTotal,
                    maxProfitLoss: highValueTotal - paidTotal,
                    minProfitLoss: lowValueTotal - paidTotal,
                    valueTotal: valueTotal,
                    paidTotal: paidTotal
                };

                return { wallets, coins, subTotal, total };
            });
    }
};

module.exports = statisticsCalculator;
