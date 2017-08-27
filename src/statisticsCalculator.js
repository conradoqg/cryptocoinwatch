const fetch = require('node-fetch');

/**
 * Calculate the statistics for transactions, transfers for a given market
 *
 * @param {Array} transactions List of transactions
 * @param {Array} transfers List of transfers
 * @param {String} market Market name to retrieve information from
 */
const statisticsCalculator = (transactions, transfers, market) => {
    const uniqueCoins = new Map();

    if (transactions) {
        for (var i = 0; i < transactions.length; i++) {
            const transaction = transactions[i];
            let coin = null;
            if (!uniqueCoins.has(transaction.coin)) {
                coin = {
                    amount: 0,
                    paid: 0
                };
            } else {
                coin = uniqueCoins.get(transaction.coin);
            }

            const operation = transaction.operation || 'buy';

            if (operation == 'buy') {
                coin.amount += transaction.amount;
                coin.paid += (transaction.price * transaction.amount) + transaction.fee;
            } else {
                coin.amount -= transaction.amount;
                coin.paid -= (transaction.price * transaction.amount) + transaction.fee;
            }

            uniqueCoins.set(transaction.coin, coin);
        }
    }

    if (transfers) {
        for (var i = 0; i < transfers.length; i++) {
            let coin = null;
            let transfer = transfers[i];
            if (!uniqueCoins.has(transfer.coin)) {
                coin = {
                    amount: 0,
                    paid: 0
                };
            } else {
                coin = uniqueCoins.get(transfer.coin);
            }

            const fee = transfer.fee ? transfer.fee : 0;

            if (transfers[i].from == 'me')
                coin.amount -= transfer.amount + fee;
            if (transfers[i].to == 'me')
                coin.amount += transfer.amount;
            uniqueCoins.set(transfer.coin, coin);
        }
    }

    if (uniqueCoins.size > 0) {
        let coinsParam = Array.from(uniqueCoins.keys()).join(',');

        return fetch(`https://min-api.cryptocompare.com/data/pricemultifull?fsyms=${coinsParam}&tsyms=USD&e=${market}&extraParams=cryptowatch`)
            .then((res) => {
                return res.json();
            })
            .then(json => {
                if (json.Response && json.Response == 'Error') throw new Error(json.Message);

                const coins = [];

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

                uniqueCoins.forEach((value, key) => {
                    if (json.RAW[key]) {
                        coins.push({
                            coin: key,
                            change24Hour: json.RAW[key].USD.CHANGE24HOUR,
                            changePct24Hour: json.RAW[key].USD.CHANGEPCT24HOUR,
                            price: json.RAW[key].USD.PRICE,
                            high24Hour: json.RAW[key].USD.HIGH24HOUR,
                            low24Hour: json.RAW[key].USD.LOW24HOUR,
                            amount: uniqueCoins.get(key).amount,
                            paid: uniqueCoins.get(key).paid,
                            value: json.RAW[key].USD.PRICE * uniqueCoins.get(key).amount
                        });
                        changeTotal += json.RAW[key].USD.CHANGE24HOUR;
                        changePctTotal += json.RAW[key].USD.CHANGEPCT24HOUR;
                        maxChangePctTotal += ((json.RAW[key].USD.HIGH24HOUR * 100) / json.RAW[key].USD.OPEN24HOUR) - 100;
                        minChangePctTotal += ((json.RAW[key].USD.LOW24HOUR * 100) / json.RAW[key].USD.OPEN24HOUR) - 100;
                        paidTotal += uniqueCoins.get(key).paid;
                        priceTotal += json.RAW[key].USD.PRICE;
                        highTotal += json.RAW[key].USD.HIGH24HOUR;
                        lowTotal += json.RAW[key].USD.LOW24HOUR;
                        valueTotal += json.RAW[key].USD.PRICE * uniqueCoins.get(key).amount;
                        highValueTotal += json.RAW[key].USD.HIGH24HOUR * uniqueCoins.get(key).amount;
                        lowValueTotal += json.RAW[key].USD.LOW24HOUR * uniqueCoins.get(key).amount;
                    }
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

                return { coins, subTotal, total };
            });
    }
};

module.exports = statisticsCalculator;
