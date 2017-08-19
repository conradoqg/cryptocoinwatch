const PImage = require('pureimage');
const stream = require('stream');
const nativeImage = require('electron').nativeImage;

class IconChart {
    constructor() {
        this.pImage = PImage.make(16, 16);
        this.context = this.pImage.getContext('2d');
        this.width = 16;
        this.heigth = 16;
        this.largeBarWidth = 4;
        this.minBarWidth = 2;
    }

    createIconFromBars(bars) {
        const isPositive = (value) => (value >= 0);
        const normalizeValue = (value, max, min) => 2 * ((value - min) / (max - min)) - 1;

        // Check the max allowed bars (considering span)
        const barsCount = bars.reduce((current, next) => current += next.span || 1, 0);
        if (barsCount > (this.width / this.minBarWidth)) throw new Error(`Max supported bars count is ${(this.width / this.minBarWidth)}.`);

        // Clear bar
        this.context.clearRect(0, 0, this.width, this.heigth);

        // Generate the bar coordinates
        let barIndex = 0;
        const fillCoors = bars.map((bar) => {
            const span = (bar.span ? bar.span : 1);
            const width = span * this.minBarWidth;
            const normalizedValue = normalizeValue(bar.value, bar.max || 100, bar.min || 0);
            const heigth = Math.max(1, Math.round(Math.abs(normalizedValue) * this.heigth));
            const y = (isPositive(normalizedValue) ? this.heigth - heigth : 0);
            const color = (isPositive(normalizedValue) ? bar.color.positive : bar.color.negative);
            const coor = {
                x: barIndex,
                y: y,
                width: width,
                heigth: heigth,
                color: color,
            };
            barIndex += width;
            return coor;
        });

        // Draw bars
        fillCoors.map((coor) => {
            this.context.fillStyle = coor.color;
            this.context.fillRect(coor.x, coor.y, coor.width, coor.heigth);
        });

        return this.getNativeImageFromPureImage(this.pImage);
    }

    getNativeImageFromPureImage(pImage) {
        return new Promise((resolve, reject) => {
            let data = [];
            const converter = new stream.Writable({
                write: function (chunk, encoding, next) {
                    data.push(chunk);
                    next();
                }
            });

            converter.on('finish', () => {
                resolve(Buffer.concat(data));
            });

            converter.on('error', error => reject(error));

            PImage.encodePNGToStream(pImage, converter);
        }).then(buffer => {
            return nativeImage.createFromBuffer(buffer, {
                width: this.pImage.width,
                height: this.pImage.height,
                scaleFactor: 1
            });
        });
    }
}

module.exports = IconChart;
