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
    },
    colorLuminance: (hex, lum) => {
        // validate hex string
        hex = String(hex).replace(/[^0-9a-f]/gi, '');
        if (hex.length < 6) {
            hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
        }
        lum = lum || 0;

        // convert to decimal and change luminosity
        let rgb = '#', c, i;
        for (i = 0; i < 3; i++) {
            c = parseInt(hex.substr(i * 2, 2), 16);
            c = Math.round(Math.min(Math.max(0, c + (c * lum)), 255)).toString(16);
            rgb += ('00' + c).substr(c.length);
        }

        return rgb;
    }
};
