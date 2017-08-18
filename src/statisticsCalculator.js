const fetch = require('node-fetch');

class StatisticsCalculator {
    static type1(transactions, market) {
        const uniqueCoins = new Map();

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

            return fetch(`https://min-api.cryptocompare.com/data/pricemultifull?fsyms=${coinsParam}&tsyms=USD&e=${market}&extraParams=cryptowatch`)
                .then(res => res.json())
                .then(json => {
                    const coins = [];

                    let totalChangedPct = 0;
                    let maxTotalChangePct = 0;
                    let minTotalChangePct = 0;
                    let paidValue = 0;
                    let currentValue = 0;
                    let maxValue = 0;
                    let minValue = 0;

                    uniqueCoins.forEach((value, key) => {
                        if (json.RAW[key]) {
                            coins.push({
                                coin: key,
                                change24Hour: json.RAW[key].USD.CHANGE24HOUR,
                                changePct24Hour: json.RAW[key].USD.CHANGEPCT24HOUR,
                                price: json.RAW[key].USD.PRICE,
                                high24Hour: json.RAW[key].USD.HIGH24HOUR,
                                low24Hour: json.RAW[key].USD.LOW24HOUR,
                                total: json.RAW[key].USD.PRICE * uniqueCoins.get(key).amount
                            });
                            totalChangedPct += json.RAW[key].USD.CHANGEPCT24HOUR;
                            maxTotalChangePct += ((json.RAW[key].USD.HIGH24HOUR * 100) / json.RAW[key].USD.OPEN24HOUR) - 100;
                            minTotalChangePct += ((json.RAW[key].USD.LOW24HOUR * 100) / json.RAW[key].USD.OPEN24HOUR) - 100;
                            paidValue += uniqueCoins.get(key).paid;
                            currentValue += json.RAW[key].USD.PRICE * uniqueCoins.get(key).amount;
                            maxValue += json.RAW[key].USD.HIGH24HOUR * uniqueCoins.get(key).amount;
                            minValue += json.RAW[key].USD.LOW24HOUR * uniqueCoins.get(key).amount;
                        }
                    });

                    const subTotal = {
                        changePctAvg: totalChangedPct / coins.length,
                        maxChangePctAvg: maxTotalChangePct / coins.length,
                        minChangePctAvg: minTotalChangePct / coins.length
                    };

                    const total = {
                        profitLossPct: ((currentValue * 100) / paidValue) - 100,
                        maxProfitLossPct: ((maxValue * 100) / paidValue) - 100,
                        minProfitLossPct: ((minValue * 100) / paidValue) - 100,
                        profitLoss: currentValue - paidValue,
                        maxProfitLoss: maxValue - paidValue,
                        minProfitLoss: minValue - paidValue,
                        currentValue: currentValue,
                        paidValue: paidValue
                    };

                    return { coins, subTotal, total };
                });
        }
    }
}

module.exports = StatisticsCalculator;
