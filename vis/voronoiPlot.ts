import { Axis } from './axis'
import { Delaunay, Voronoi } from "d3-delaunay";
import * as igv from 'igv';
import * as d3 from 'd3';
import { start } from 'repl';

export class VoronoiPlot extends Axis {

    imageCanvas: HTMLCanvasElement;
    imageCTX: CanvasRenderingContext2D;
    //imageDiv: HTMLDivElement;

    smoothingRepetitions: number;
    omega: number;

    belowBrowser: igv.IGVBrowser
    rightBrowser: igv.IGVBrowser

    displayVoronoiEdges: boolean;

    boxesToDraw: Array<number[]>;

    //axis: Axis;
    points: Uint32Array
    normPoints: Array<number[]>

    voronoi: Voronoi<Delaunay.Point>;
    voronoiCanvas: HTMLCanvasElement;

    constructor(belowBrowser: igv.IGVBrowser, rightBrowser: igv.IGVBrowser) {
        super(<HTMLCanvasElement>document.getElementById("voronoi-canvas"));

        //this.imageDiv = <HTMLDivElement>document.getElementById("figure-div");
        this.imageCanvas = <HTMLCanvasElement>document.getElementById("voronoi-canvas");
        this.imageCTX = <CanvasRenderingContext2D>this.imageCanvas.getContext('2d')
        this.imageCTX.imageSmoothingEnabled = false;

        this.tickDecimalPlaces = 0;

        this.smoothingRepetitions = 1;
        this.omega = 1;
        this.points = new Uint32Array();
        this.normPoints = new Array<number[]>();
        this.boxesToDraw = new Array<number[]>(1);

        this.boxesToDraw[0] = new Array<number>(2);
        this.boxesToDraw[0][0] = 804435;
        this.boxesToDraw[0][1] = 969587;

        this.belowBrowser = belowBrowser;
        this.rightBrowser = rightBrowser;

        this.displayVoronoiEdges = true;

        // Buffer canvas for voronoi to improve interactivity 
        this.voronoiCanvas = document.createElement("canvas");
        this.voronoiCanvas.width = this.axisWidth;
        this.voronoiCanvas.height = this.axisHeight;

        this.voronoi = Delaunay.from([]).voronoi();

        // Set up the controls
        //this.numPointsLabel = document.createElement('label');
        //this.imageDiv.appendChild(this.numPointsLabel);
    }

    loadDataForVoronoi(minX: number, maxX: number, minY: number, maxY: number) {
        /*this.minX = minX;
        this.maxX = maxX;
        this.minY = minY;
        this.maxY = maxY;*/

        var self = this;

        this.belowBrowser.search("chr4:" + minX + "-" + maxX)
        this.rightBrowser.search("chr4:" + minY + "-" + maxY)
        console.log("chr4:" + minY + "-" + maxY)

        fetch('./points?xStart=' + minX + '&xEnd=' + maxX + '&yStart=' + minY + '&yEnd=' + maxY)
            .then((response) => {
                if (response.status !== 200) {
                    console.log('Looks like there was a problem. Status Code: ' +
                        response.status);
                    return;
                }

                // Examine the text in the response
                response.arrayBuffer().then((byteBuffer) => {
                    self.points = new Uint32Array(byteBuffer);

                    self.normPoints = Array<number[]>(self.points.length);

                    for (let i = 0; i < self.points.length / 2; i++) {
                        self.normPoints[i * 2] = Array<number>(2);

                        self.normPoints[i * 2 + 1] = Array<number>(2);
                    }

                    console.log(self);
                    //self.updatePoints();

                    self.updateDataLimits(minX, maxX, minY, maxY);
                    self.updateView(minX, maxX, minY, maxY);
                });
            }
            )
            .catch(function (err) {
                console.log('Fetch Error :-S', err);
            });
    }

    setData(data: Uint32Array) {
        this.points = data;
    }

    polygonArea(polygon: Delaunay.Polygon) 
    { 
        let area = 0;   // Accumulates area 
        let j = 0;

        for (let i=1; i<polygon.length; i++)
        { 
            //area += (polygon[j][0]+polygon[i][0]) * (polygon[j][1]+polygon[i][1]); 
            var crossProduct = polygon[j][0] * polygon[i][1] - polygon[j][1] * polygon[i][0];
            area += crossProduct;
            j = i;  //j is previous vertex to i
        }
        return area/2;
    }

    polygonCentroid(polygon: Delaunay.Polygon) {
        var i = -1,
            n = polygon.length,
            x = 0,
            y = 0,
            a,
            b = polygon[n - 1],
            c,
            k = 0;
      
        while (++i < n) {
          a = b;
          b = polygon[i];
          k += c = a[0] * b[1] - b[0] * a[1];
          x += (a[0] + b[0]) * c;
          y += (a[1] + b[1]) * c;
        }
      
        return k *= 3, [x / k, y / k];
      }


    setSmoothingRepetitions(smoothingRepetitions: number) {
        this.smoothingRepetitions = smoothingRepetitions;

        this.calculateVoronoi();
        this.redraw();
    }

    setOmega(omega: number) {
        this.omega = omega;

        this.calculateVoronoi();
        this.redraw();
    }

    setDisplayVoronoiEdges(display: boolean) {
        this.displayVoronoiEdges = display;

        this.redraw();
    }

    // When updating points or view -> recreate voronoi
    calculateVoronoi() {
        let startX = this.minViewX;
        let endX = this.maxViewX;
        let startY = this.minViewY;
        let endY = this.maxViewY;


        var axisCanvas = this.getAxisCanvas();

        for (let i = 0; i < this.points.length / 2; i++) {
            // Why doesn't this work: (this.points[i * 2] - startX) * xScaleFactor;//
            this.normPoints[i * 2][0] = ((this.points[i * 2] - startX) / (endX - startX)) * axisCanvas.width;
            this.normPoints[i * 2][1] = ((this.points[i * 2 + 1] - startY) / (endY - startY)) * axisCanvas.height;
            this.normPoints[i * 2 + 1][0] = ((this.points[i * 2 + 1] - startX) / (endX - startX)) * axisCanvas.width;
            this.normPoints[i * 2 + 1][1] = ((this.points[i * 2] - startY) / (endY - startY)) * axisCanvas.height;
            //normPoints[i*2+1][0] = canvasWidth - normPoints[i*2][0];
            //normPoints[i*2+1][1] = canvasHeight - normPoints[i*2][1];
        }


        //const points = [[0, 0], [0, 1], [1, 0], [1, 1]];
        let delaunay = Delaunay.from(this.normPoints);
        this.voronoi = delaunay.voronoi([0, 0, axisCanvas.width, axisCanvas.height]);

        for(let j = 0; j < this.smoothingRepetitions; j++) {
            // Apply smoothing
            for(let i = 0; i < this.normPoints.length; i++) {
                    let polygon = this.voronoi.cellPolygon(i);
                    if(polygon == null) 
                        continue;

                    const x0 = this.normPoints[i][0];
                    const y0 = this.normPoints[i][1];
                    // Lloyd's algorithm - observable website
                    const [x1, y1] = this.polygonCentroid(polygon);
                    
                    this.normPoints[i][0] = x0 + (x1 - x0) * this.omega;
                    this.normPoints[i][1] = y0 + (y1 - y0) * this.omega;
            }

            delaunay = Delaunay.from(this.normPoints);
            this.voronoi = delaunay.voronoi([0, 0, axisCanvas.width, axisCanvas.height]);
        }
    }

    // When changing colourmap -> redraw voronoi
    drawVoronoi() {
        let startX = this.minViewX;
        let endX = this.maxViewX;
        let startY = this.minViewY;
        let endY = this.maxViewY;


        //var axisCanvas = this.getAxisCanvas();
        let voronoiCanvasCTX = <CanvasRenderingContext2D> this.voronoiCanvas.getContext("2d");
        voronoiCanvasCTX.clearRect(0, 0, this.voronoiCanvas.width, this.voronoiCanvas.height);

        //axisCanvasCTX.fillStyle = "darkblue";
        //axisCanvasCTX.beginPath();
        let numPolygons = 0;
        let maxArea = 0;
        let minArea = 1e100;
        let areas = [];
        let indicies = [];
        for(const polygon of this.voronoi.cellPolygons()) {
            let area = this.polygonArea(polygon);
            //indicies.push(polygon.index);
            areas.push(area);

            if(maxArea < area) {
                maxArea = area;
            }
            if(minArea > area) {
                minArea = area;
            }

            numPolygons++;
        }

        // TODO: Scale area by the area of view
        console.log(Math.log(minArea * (endX - startX)))

        let colours = 100;
        var scale = d3.scaleQuantize()
        .range(d3.range(colours))
        .domain([14, 19]);
        //.domain([Math.log(minArea), Math.log(maxArea)]);
        var colorScale = d3.scaleLinear<string>()
        //.range(["saddlebrown", "forestgreen", "lightgreen", "steelblue"])
        //.domain([0, colours / 3, 2*colours/3, colours]);
        .range(["saddlebrown", "lightgreen", "steelblue"])
        .domain([0, colours / 2, colours]);
        
        for(let i = 0; i < this.normPoints.length; i++) { //areas.length*2
        //for(const polygon of voronoi.cellPolygons()) {
            let polygon = this.voronoi.cellPolygon(i);
            if(polygon == null) 
                continue;
            let area = this.polygonArea(polygon);
//console.log(area);
//console.log(Math.log(maxArea)-Math.log(area));
            voronoiCanvasCTX.fillStyle = colorScale(scale(Math.log(area* (endX - startX))));//'rgb(0, 0, ' + Math.round(255-50*(Math.log(maxArea)-Math.log(area)))  + ')';
            voronoiCanvasCTX.beginPath();
            this.voronoi.renderCell(i, voronoiCanvasCTX);
            //console.log('rgb(100, 100, ' + Math.round(255*(area / maxArea))  + ')');            
            voronoiCanvasCTX.fill();

            if(this.displayVoronoiEdges) {
                voronoiCanvasCTX.stroke();
            }
        }
    }
    
    // When changing contact plot -> only redraw contacts

    redraw() { //minX: number, minY: number, maxX: number, maxY: number) {
        // TODO: Sort this out..
        /*minX = xStart;
        maxX = xEnd;
        minY = yStart;
        maxY = yEnd;
    
        let startX = this.minX + startXFrac*xDataDiff;
        let endX = this.maxX - (1-endXFrac)*xDataDiff;
        let startY = this.minY + startYFrac*yDataDiff;
        let endY = this.maxY - (1-endYFrac)*yDataDiff;
    
        console.log("Start (" + startX + ", " + startY + ") End (" + endX + ", " + endY + ")");*/

        /*minXText.value = "" + startX.toFixed(0);
        maxXText.value = "" + endX.toFixed(0);
        minYText.value = "" + startY.toFixed(0);
        maxYText.value = "" + endY.toFixed(0);*/

        var axisCanvas = this.getAxisCanvas();
        var axisCanvasCTX = <CanvasRenderingContext2D>axisCanvas.getContext('2d');
        axisCanvasCTX.imageSmoothingEnabled = false;
        axisCanvasCTX.drawImage(this.voronoiCanvas, 0, 0, axisCanvas.width, axisCanvas.height);

        this.drawContacts();

        

        /*axisCanvasCTX.save();
        axisCanvasCTX.fillStyle = "rgba(255, 255, 255, 0.75)";
        for(let i = 0; i < this.boxesToDraw.length; i++) {
            let x = this.boxesToDraw[i][0];
            let y = this.boxesToDraw[i][1];

            if(x >= this.minViewX && x <= this.maxDataX && y >= this.minViewY && y <= this.maxViewY) {
                x = (x - startX) * xScaleFactor;
                y = (y - startY) * yScaleFactor;

                let halfWidth = 2500 * xScaleFactor;
                let halfHeight = 2500 * yScaleFactor;

                axisCanvasCTX.beginPath();
                axisCanvasCTX.rect(x-halfWidth, y-halfHeight, halfWidth*2, halfHeight*2);
                axisCanvasCTX.fill();
                axisCanvasCTX.stroke();
                //this.normPoints[i * 2][0] = ((this.points[i * 2] - startX) / (endX - startX)) * axisCanvas.width;
                //axisCanvasCTX.
            }
        }
        axisCanvasCTX.restore();*/

        //voronoi.delaunay.renderPoints(axisCanvasCTX, 1);
        //axisCanvasCTX.stroke();
        this.drawAxisCanvas();

        return;
        // /*for(let i = 0; i < voronoi.delaunay.points.length; i++) {
        //     let polygon = voronoi.cellPolygon(i);
        //     console.log(polygon);
        //     console.log(this.polygonArea(polygon));
        //     voronoi.renderCell(i);
        // }*/
        // //voronoi.delaunay.renderPoints(axisCanvasCTX, 1);
        // axisCanvasCTX.fill();

        // axisCanvasCTX.strokeStyle = 'RoyalBlue';

        // axisCanvasCTX.beginPath();
        // axisCanvasCTX.lineWidth = 1;
        // //voronoi.renderBounds(canvasBufferContext);
        // voronoi.render(axisCanvasCTX)
        // axisCanvasCTX.stroke();

        // //drawVoroniFromBuffer();
        // //this.drawTicks();
        // this.drawAxisCanvas();

        // console.log(voronoi)
    }

    updateView(minX: number, maxX: number, minY: number, maxY: number): void {
        this.minViewX = minX;
        this.maxViewX = maxX;
        this.minViewY = minY;
        this.maxViewY = maxY;

        this.calculateVoronoi();
        this.drawVoronoi();
        this.redraw();
    }
}