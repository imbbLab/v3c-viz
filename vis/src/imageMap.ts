import { Axis, OriginLocation } from './axis'
import { Chromosome } from './chromosome';
import { VoronoiPlot } from './voronoiPlot'

export class ImageMap extends Axis {
    //numBinsForDensity = 300;
    //isImageLocked = false;
    //imageCanvas: HTMLCanvasElement;
    //imageCTX: CanvasRenderingContext2D;
    //imageDiv : HTMLDivElement;

    //numPointsLabel: HTMLLabelElement

    // Editable options
    numBins = 200;
    percentile = 0.97;
    imageThreshold = -1;

    voronoiPlot: VoronoiPlot

    imageData: Uint32Array
    buffer: Uint8ClampedArray
    iData: ImageData
    bitmapData: ImageBitmap | undefined

    //axis: Axis;

    setNumberBins(numBins: number) {
        this.numBins = numBins;

        this.buffer = new Uint8ClampedArray(numBins * numBins * 4)

        var axisCanvas = this.getAxisCanvas();
        var axisCanvasCTX = <CanvasRenderingContext2D>axisCanvas.getContext('2d');
        this.iData = axisCanvasCTX.createImageData(this.numBins, this.numBins);
        this.iData.data.set(this.buffer);

        //this.updateView(this.minDataX, this.maxDataX, this.minDataY, this.maxDataY);
    }

    constructor(numBins: number, voronoiPlot: VoronoiPlot) {
        super(<HTMLCanvasElement>document.getElementById("image-canvas"))
        
        this.imageData = new Uint32Array();
        this.buffer = new Uint8ClampedArray();



        var axisCanvasCTX = <CanvasRenderingContext2D>this.getAxisCanvas().getContext('2d');
        this.iData = axisCanvasCTX.createImageData(this.numBins, this.numBins);


        this.setNumberBins(numBins);

        this.voronoiPlot = voronoiPlot;

        //this.axis = new Axis(this.imageCanvas);
        //this.axis.drawTicks();
    }

    callback: Function = () => { };

    setCallback(callback: Function) {
        this.callback = callback;
    }

    setDimensions(width: number, height: number) {
        super.setDimensions(width, height);
        this.setNumberBins(this.axisWidth);
    }

    setChromPair(sourceChrom: Chromosome, targetChrom: Chromosome) {
        super.setChromPair(sourceChrom, targetChrom);

        // Reset image threshold so that we recalculate an appropriate threshold
        this.imageThreshold = -1;
    }

    setPercentile(percentile: number) {
        this.percentile = percentile;

        let imageThreshold = this.calculatePercentile(this.percentile);
        this.setImageThreshold(imageThreshold);
    }

    setImageThreshold(threshold: number) {
        this.imageThreshold = threshold;
        this.thresholdImage();
    }

    calculatePercentile(percentile: number): number {
        let sortedData = Uint32Array.from(this.imageData);
        sortedData.sort();
        var index = sortedData.findIndex(function (val) {
            return val > 0;
        });
        sortedData = sortedData.slice(index);

        return sortedData[Math.round(sortedData.length * percentile)]

    }

    thresholdImage() {
        var clamped = new Uint8ClampedArray([0]);

        //var axisCanvas = this.getAxisCanvas();
        //var axisCanvasCTX = <CanvasRenderingContext2D>axisCanvas.getContext('2d');
        //this.iData = axisCanvasCTX.createImageData(this.numBins, this.numBins);//self.imageCTX.createImageData(width, height);
        // set our buffer as source
        //       

        for (var y = 0; y < this.numBins; ++y) {
            for (var x = 0; x < this.numBins; ++x) {
                clamped[0] = this.imageData[y * this.numBins + x] / this.imageThreshold * 255;

                var pos = (y * this.numBins + x) * 4; // position in buffer based on x and y
                this.iData.data[pos] = clamped[0];           // some R value [0, 255]
                this.iData.data[pos + 1] = clamped[0];           // some G value
                this.iData.data[pos + 2] = clamped[0];           // some B value
                this.iData.data[pos + 3] = 255;           // set alpha channel
            }
        }

        this.updateBitmap();
    }

    updateBitmap() {
        createImageBitmap(this.iData).then(bitmapData => {
            this.bitmapData = bitmapData;

            this.redraw();
        });
    }

    redraw() {
        // update canvas with new data
        //ctx.putImageData(idata, 0, 0);

        var axisCanvas = this.getAxisCanvas();
        var axisCanvasCTX = <CanvasRenderingContext2D>axisCanvas.getContext('2d');
        axisCanvasCTX.clearRect(0, 0, axisCanvas.width, axisCanvas.height);

        axisCanvasCTX.save();

        if (this.intrachromosomeView) {
            axisCanvasCTX.rotate(-45 * Math.PI / 180)
            axisCanvasCTX.scale(1 / Math.sqrt(2), 1 / Math.sqrt(2))
            axisCanvasCTX.imageSmoothingEnabled = true;
        } else {
            axisCanvasCTX.imageSmoothingEnabled = false;
        }
        if (this.bitmapData) {
            axisCanvasCTX.drawImage(this.bitmapData, 0, 0, this.bitmapData.width, this.bitmapData.height,
                0, 0, axisCanvas.width, axisCanvas.height);
        }

        this.drawContacts();
        axisCanvasCTX.restore();

        this.tickDecimalPlaces = 0;

        this.drawAxisCanvas();
    }

    async updateFromArray(imageData: Uint32Array) {
        this.imageData = imageData;

        let maxIntensity = 0;
        let countNotZero = 0;

        var numPoints = 0;

        this.imageData.forEach(value => {
            numPoints += value;

            if (value > maxIntensity) {
                maxIntensity = value;
            }
            if (value > 0) {
                countNotZero += 1;
            }
        })

        this.setPercentile(this.percentile);
        
        this.redraw();
    }
}