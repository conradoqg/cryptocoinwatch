module.exports = {
    SUBTOTAL: {
        positive: '#6A9913',
        negative: '#DA3612'
    },
    TOTAL: {
        positive: '#6A9913',
        negative: '#DA3612'
    },
    COIN: {
        BTC: '#FF8500',
        ETH: '#51B0D1',
        BCH: '#FFEB42',
        XRP: '#CEEAF2',
        LTC: '#CCCCCC',
        RANDOM: '#' + ((1 << 24) * Math.random() | 0).toString(16)
    }
};
