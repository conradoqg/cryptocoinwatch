const PImage = require('pureimage');
const stream = require('stream');
const nativeImage = require('electron').nativeImage;

class IconChart {
    constructor() {
        this.pImage = PImage.make(16, 16);
        this.context = this.pImage.getContext('2d');
        this.width = 16;
        this.height = 16;
        this.largeBarWidth = 4;
    }

    getFor(percentageLimit, subTotal, total, bars, callback) {
        // Clear bar
        this.context.clearRect(0, 0, this.width, this.height);

        const isPositive = (value) => (value >= 0);

        // Draw the total bar
        var barHeight = (value) => ((this.height / 2) * Math.abs(value)) / percentageLimit.total;
        if (total.value >= 0) {
            this.context.fillStyle = total.color.positive || '#6A9913';
        } else {
            this.context.fillStyle = total.color.negative || '#DA3612';
        }
        this.context.fillRect(this.width - this.largeBarWidth, (isPositive(total.value) ? (this.height / 2) - barHeight(total.value) : (this.height / 2)), this.largeBarWidth, barHeight(total.value));

        // Draw the subtotal bar
        barHeight = (value) => ((this.height / 2) * Math.abs(value)) / percentageLimit.subTotal;
        if (subTotal.value >= 0) {
            this.context.fillStyle = subTotal.color.positive || '#6A9913';
        } else {
            this.context.fillStyle = subTotal.color.negative || '#DA3612';
        }
        this.context.fillRect(this.width - (this.largeBarWidth * 2), (isPositive(subTotal.value) ? (this.height / 2) - barHeight(subTotal.value) : (this.height / 2)), this.largeBarWidth, barHeight(subTotal.value));

        // Draws each other item
        if (bars.length > 2) {
            barHeight = (value) => ((this.height / 2) * Math.abs(value)) / percentageLimit.coin;
            const barWidth = (this.largeBarWidth * 2) / bars.length;

            for (var i = 0; i < Math.min(bars.length, 8); i++) {
                if (bars[i].value >= 0) {
                    this.context.fillStyle = bars[i].color;
                } else {
                    this.context.fillStyle = colorLuminance(bars[i].color, -0.5);
                }
                this.context.fillRect(barWidth * i, (isPositive(bars[i].value) ? (this.height / 2) - barHeight(bars[i].value) : (this.height / 2)), barWidth, barHeight(bars[i].value));
            }
        }

        var data = [];

        var converter = new stream.Writable({
            write: function (chunk, encoding, next) {
                data.push(chunk);
                next();
            }
        });

        converter.on('finish', () => {
            var buffer = Buffer.concat(data);

            callback(nativeImage.createFromBuffer(buffer, {
                width: this.pImage.width,
                height: this.pImage.height,
                scaleFactor: 1
            }));
        });

        PImage.encodePNGToStream(this.pImage, converter);

        return;
    }
}

function colorLuminance(hex, lum) {

    // validate hex string
    hex = String(hex).replace(/[^0-9a-f]/gi, '');
    if (hex.length < 6) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    lum = lum || 0;

    // convert to decimal and change luminosity
    var rgb = '#', c, i;
    for (i = 0; i < 3; i++) {
        c = parseInt(hex.substr(i * 2, 2), 16);
        c = Math.round(Math.min(Math.max(0, c + (c * lum)), 255)).toString(16);
        rgb += ('00' + c).substr(c.length);
    }

    return rgb;
}

module.exports = IconChart;
