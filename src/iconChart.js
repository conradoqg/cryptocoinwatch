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
        const isPositive = (value) => (value >= 0);

        // Clear bar
        this.context.clearRect(0, 0, this.width, this.height);

        // Draw the total bar
        let barHeight = (value) => ((this.height / 2) * Math.abs(value)) / percentageLimit.total;

        if (isPositive(total.value)) this.context.fillStyle = total.color.positive || '#6A9913';
        else this.context.fillStyle = total.color.negative || '#DA3612';

        this.context.fillRect(this.width - this.largeBarWidth, (isPositive(total.value) ? (this.height / 2) - barHeight(total.value) : (this.height / 2)), this.largeBarWidth, barHeight(total.value));

        // Draw the subtotal bar
        barHeight = (value) => ((this.height / 2) * Math.abs(value)) / percentageLimit.subTotal;

        if (isPositive(subTotal.value)) this.context.fillStyle = subTotal.color.positive || '#6A9913';
        else this.context.fillStyle = subTotal.color.negative || '#DA3612';

        this.context.fillRect(this.width - (this.largeBarWidth * 2), (isPositive(subTotal.value) ? (this.height / 2) - barHeight(subTotal.value) : (this.height / 2)), this.largeBarWidth, barHeight(subTotal.value));

        // Draws each other item
        if (bars.length > 2) {
            barHeight = (value) => ((this.height / 2) * Math.abs(value)) / percentageLimit.coin;
            const barWidth = (this.largeBarWidth * 2) / bars.length;

            for (var i = 0; i < Math.min(bars.length, 8); i++) {
                if (isPositive(bars[i].value)) this.context.fillStyle = bars[i].color.positive;
                else this.context.fillStyle = bars[i].color.negative;

                this.context.fillRect(barWidth * i, (isPositive(bars[i].value) ? (this.height / 2) - barHeight(bars[i].value) : (this.height / 2)), barWidth, barHeight(bars[i].value));
            }
        }

        let data = [];

        const converter = new stream.Writable({
            write: function (chunk, encoding, next) {
                data.push(chunk);
                next();
            }
        });

        converter.on('finish', () => {
            const buffer = Buffer.concat(data);

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

module.exports = IconChart;
