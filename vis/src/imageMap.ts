import { Axis } from './axis'
import { Chromosome } from './chromosome';
import { VoronoiPlot } from './voronoiPlot'

export class ImageMap extends Axis {
    //numBinsForDensity = 300;
    isImageLocked = false;
    imageCanvas: HTMLCanvasElement;
    imageCTX: CanvasRenderingContext2D;
    //imageDiv : HTMLDivElement;

    numPointsLabel: HTMLLabelElement

    // Editable options
    numBins = 200;
    percentile = 0.97;
    imageThreshold = -1;

    voronoiPlot: VoronoiPlot

    imageData: Uint32Array
    buffer: Uint8ClampedArray
    iData: ImageData


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

        //this.imageDiv = <HTMLDivElement>document.getElementById("image-div");
        this.imageCanvas = <HTMLCanvasElement>document.getElementById("image-canvas");
        this.imageCTX = <CanvasRenderingContext2D>this.imageCanvas.getContext('2d')
        this.imageCTX.imageSmoothingEnabled = false;

        // Set up the controls
        this.numPointsLabel = document.createElement('label');
        //this.imageDiv.appendChild(this.numPointsLabel);
        this.imageData = new Uint32Array();
        this.buffer = new Uint8ClampedArray();

        

        var axisCanvasCTX = <CanvasRenderingContext2D>this.getAxisCanvas().getContext('2d');
        this.iData = axisCanvasCTX.createImageData(this.numBins, this.numBins);

        this.setNumberBins(numBins);


        /*fetch('./details')
            .then(
                (response) => {
                    if (response.status !== 200) {
                        console.log('Looks like there was a problem. Status Code: ' +
                            response.status);
                        return;
                    }

                    response.json().then(details => {
                        console.log(details);

                        this.minDataX = details['minX']
                        this.maxDataX = details['maxX']
                        this.minDataY = details['minY']
                        this.maxDataY = details['maxY']

                        this.updateView(this.minDataX, this.maxDataX, this.minDataY, this.maxDataY);
                    });
                });*/

        //this.canvas.addEventListener('dblclick', () => { 
        //    // TODO: Get the 
        //    var xStart = 8e4
        //    var xEnd = 3e6
        //    var yStart = 8e4
        //    var yEnd = 3e6
        //    
        //   this.updateView(xStart, xEnd, yStart, yEnd);
        //});

        this.voronoiPlot = voronoiPlot;

        //this.axis = new Axis(this.imageCanvas);
        //this.axis.drawTicks();
    }

    callback: Function = () => { };

    setCallback(callback: Function) {
        this.callback = callback;
    }

    //onImageLoad: (minX: number, maxX: number, minY: number, maxY: number) => void = () => {};

    //setOnImageLoad(onImageLoad: (minX: number, maxX: number, minY: number, maxY: number) => void) {
    //    this.onImageLoad = onImageLoad;
    //}

    setChromPair(sourceChrom: Chromosome, targetChrom: Chromosome) {
        super.setChromPair(sourceChrom, targetChrom);

        // Reset image threshold so that we recalculate an appropriate threshold
        this.imageThreshold = -1;
    }

    /*updateView(minX: number, maxX: number, minY: number, maxY: number) {
        if(minX < 0) {
            minX = 0;
        }
        if(minY < 0) {
            minY = 0;
        }

        this.loadDensityImage(Math.round(minX), Math.round(maxX), Math.round(minY), Math.round(maxY), () => {
            this.onImageLoad(Math.round(minX), Math.round(maxX), Math.round(minY), Math.round(maxY));
            //this.voronoiPlot.requestView(Math.round(minX), Math.round(maxX), Math.round(minY), Math.round(maxY));
        });
    }*/

    lockImage() {
        this.isImageLocked = true;
    }

    unlockImage() {
        this.isImageLocked = false;
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

        this.redraw();
    }

    redraw() {

        // update canvas with new data
        //ctx.putImageData(idata, 0, 0);
        createImageBitmap(this.iData).then(bitmapData => {
            var axisCanvas = this.getAxisCanvas();
            var axisCanvasCTX = <CanvasRenderingContext2D>axisCanvas.getContext('2d');
            axisCanvasCTX.imageSmoothingEnabled = false;
            axisCanvasCTX.drawImage(bitmapData, 0, 0, axisCanvas.width, axisCanvas.height);

            this.drawContacts();

            this.tickDecimalPlaces = 0;

            this.drawAxisCanvas();

        });
    }

    requestView(sourceChrom: Chromosome, targetChrom: Chromosome, minX: number, maxX: number, minY: number, maxY: number) {
        this.setChromPair(sourceChrom, targetChrom)

        this.loadDensityImage(sourceChrom, targetChrom, minX, maxX, minY, maxY)
    }

    loadDensityImage(sourceChrom: Chromosome, targetChrom: Chromosome, startX: number, endX: number, startY: number, endY: number) {
        this.lockImage();

        var self = this;

        fetch('./densityImage?numBins=' + this.numBins + '&sourceChrom=' + this.sourceChrom.name + '&targetChrom=' + this.targetChrom.name + '&xStart=' + startX + '&xEnd=' + endX + '&yStart=' + startY + '&yEnd=' + endY)
            .then(
                (response) => {
                    if (response.status !== 200) {
                        console.log('Looks like there was a problem. Status Code: ' +
                            response.status);
                        return;
                    }


                    // Examine the text in the response
                    response.arrayBuffer().then((byteBuffer) => {
                        this.imageData = new Uint32Array(byteBuffer);
                        //console.log(this.imageData);


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

                        console.log("Found number of points = " + numPoints)

                        /*if (numPoints < this.voronoiPlot.maxNumberPointsToLoad) {
                            callback();
                        }*/

                        this.setPercentile(this.percentile);
                        /*if(this.imageThreshold < 0) {
                            this.setPercentile(0.95);
                        } else {
                            this.thresholdImage();
                        }*/
                        //console.log("Max intensity = " + maxIntensity);

                        //maxIntensity = this.calculatePercentile(0.95) /// countNotZero * 10
                        //console.log("Max intensity = " + maxIntensity);


                        this.numPointsLabel.innerText = "Number of datapoints (in view): " + numPoints;

                        //self.setImageThreshold(maxIntensity);

                        



                        this.updateViewLimits(startX, endX, startY, endY);
                        this.redraw();


                        self.unlockImage();
                    });
                }
            )
            .catch(function (err) {
                console.log('Fetch Error :-S', err);
            });
    }
}