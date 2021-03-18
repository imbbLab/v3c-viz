import { Axis } from './axis'
import { Locus, Chromosome } from './chromosome'
//import { Delaunay, Voronoi } from "d3-delaunay";
import * as igv from 'igv';
import * as d3 from 'd3';

export class Point {
    x: number
    y: number

    constructor(x:number, y:number) {
        this.x = x;
        this.y = y;
    }
}

export class Polygon {
    points: Point[] = []
    area: number = 0
    clipped:boolean = false;
    centroid: Point = new Point(0, 0)
}

export class Voronoi {
    polygons: Polygon[] = []
}

export class VoronoiPlot extends Axis {

    imageCanvas: HTMLCanvasElement;
    imageCTX: CanvasRenderingContext2D;
    //imageDiv: HTMLDivElement;

    maxNumberPointsToLoad = 2e5;

    smoothingRepetitions: number;
    omega: number;

    belowBrowser: igv.IGVBrowser
    rightBrowser: igv.IGVBrowser

    displayVoronoiEdges: boolean;
    displayCentroid: boolean = false;
    displayVoronoiPoints: boolean;

    generateVoronoiOnServer: boolean = true

    boxesToDraw: Array<number[]>;

    //axis: Axis;
    points: Uint32Array
    normPoints: Array<number[]>

    //voronoi: Voronoi<Delaunay.Point>;
    voronoi: Voronoi;
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
        this.points = new Uint32Array(0);
        this.normPoints = new Array<number[]>();
        this.boxesToDraw = new Array<number[]>();

        this.belowBrowser = belowBrowser;
        this.rightBrowser = rightBrowser;

        this.displayVoronoiEdges = true;
        this.displayVoronoiPoints = true;

        // Buffer canvas for voronoi to improve interactivity 
        this.voronoiCanvas = document.createElement("canvas");
        this.voronoiCanvas.width = 1024; //this.axisWidth;
        this.voronoiCanvas.height = 1024; //this.axisHeight;

        this.voronoi = new Voronoi(); //Delaunay.from([]).voronoi();
        this.voronoiCanvas.style.position = 'absolute';
        this.voronoiCanvas.style.top = '1000px';
        this.voronoiCanvas.style.left = '1000px'
        //document.body.appendChild(this.voronoiCanvas)

        // Set up the controls
        //this.numPointsLabel = document.createElement('label');
        //this.imageDiv.appendChild(this.numPointsLabel);
    }



    getVoronoiDrawWidth() {
        return Math.min(this.axisWidth, this.voronoiCanvas.width)
    }

    getVoronoiDrawHeight() {
        return Math.min(this.axisHeight, this.voronoiCanvas.height)
    }

    colours = 100
    scale: d3.ScaleQuantize<number, never> = d3.scaleQuantize()
        .range(d3.range(this.colours))
        .domain([Math.log(1e20), Math.log(1e50)]);
    colourScale: d3.ScaleContinuousNumeric<string, string, never> = d3.scaleLinear<string>()
        .range(["saddlebrown", "lightgreen", "steelblue"])
        .domain([0, this.colours/2, this.colours]);

    // singlePoints: any
    // twoPoints: any
    // polygons: any

    // async updateFromJSON(data: any) {
    //     if(data) {
    //         this.singlePoints = data['Points']
    //         this.twoPoints = data['TwoPoints']
    //         this.polygons = data['Polygons']
    //     } else {
    //         this.singlePoints = null;
    //         this.twoPoints = null;
    //         this.polygons = null;
    //     }

    //     this.redrawVoronoi();
    // }

    setVoronoi(voronoi: Voronoi) {
        this.voronoi = voronoi;

        this.redrawVoronoi();
    }

    redrawVoronoi() {
        let voronoiCanvasCTX = <CanvasRenderingContext2D>this.voronoiCanvas.getContext("2d");
        voronoiCanvasCTX.clearRect(0, 0, this.voronoiCanvas.width, this.voronoiCanvas.height);

        // Draw the polygons that are too small to be drawn with detail (between 1 and 2 pixels width/height)
        // If displaying edges, then display them with the same colour as the edges, otherwise same as the smallest value on colour scale
        if(this.displayVoronoiEdges || this.displayCentroid) {
            voronoiCanvasCTX.fillStyle = 'rgb(0, 0, 0)'
        } else {
            voronoiCanvasCTX.fillStyle = this.colourScale(0);
        }

        // if (this.singlePoints) {
        //     for (let i = 0; i < this.singlePoints.length; i++) {
        //         voronoiCanvasCTX.fillRect(this.singlePoints[i]['X'], this.singlePoints[i]['Y'], 1, 1);
        //     }
        // }
        // if (this.twoPoints) {
        //     for (let i = 0; i < this.twoPoints.length; i++) {
        //         voronoiCanvasCTX.fillRect(this.twoPoints[i]['MinX'], this.twoPoints[i]['MinY'], this.twoPoints[i]['MaxX'] - this.twoPoints[i]['MinX'], this.twoPoints[i]['MaxY'] - this.twoPoints[i]['MinY']);
        //     }
        // }

        //if(this.polygons && this.colourScale && this.scale) {
        if(this.colourScale && this.scale) {
            let binSizeX = (this.maxViewX-this.minViewX) / this.axisWidth
            let binSizeY = (this.maxViewY-this.minViewY) / this.axisHeight

            for (let i = 0; i < this.voronoi.polygons.length; i++) {
                let points = this.voronoi.polygons[i].points
                voronoiCanvasCTX.fillStyle = this.colourScale(this.scale(Math.log(this.voronoi.polygons[i].area)));

                voronoiCanvasCTX.beginPath();
                voronoiCanvasCTX.moveTo((points[0].x - this.minViewX) / binSizeX, (points[0].y - this.minViewY) / binSizeY)
                for (let j = 1; j < points.length; j++) {
                    voronoiCanvasCTX.lineTo((points[j].x - this.minViewX) / binSizeX, (points[j].y - this.minViewY) / binSizeY)
                }
                voronoiCanvasCTX.closePath();
                voronoiCanvasCTX.fill();

                if (this.displayVoronoiEdges) {
                    voronoiCanvasCTX.stroke();
                }

                // Need to draw the other part of the voronoi as we only kept one part of triangle
                if (this.sourceChrom == this.targetChrom) {
                    voronoiCanvasCTX.beginPath();
                    voronoiCanvasCTX.moveTo((points[0].y - this.minViewX) / binSizeX, (points[0].x - this.minViewY) / binSizeY)
                    for (let j = 1; j < points.length; j++) {
                        voronoiCanvasCTX.lineTo((points[j].y - this.minViewX) / binSizeX, (points[j].x - this.minViewY) / binSizeY)
                    }
                    voronoiCanvasCTX.closePath();
                    voronoiCanvasCTX.fill();

                    if (this.displayVoronoiEdges) {
                        voronoiCanvasCTX.stroke();
                    }
                }
            }

            voronoiCanvasCTX.fillStyle = 'rgb(0, 0, 0)'
            
            if(this.displayCentroid) {
                if (this.displayVoronoiPoints) {
                    for (let i = 0; i < this.voronoi.polygons.length; i++) {
                        //voronoiCanvasCTX.fillRect(this.voronoi.polygons[i].centroid.x-1, this.voronoi.polygons[i].centroid.y-1, 2, 2);
                        voronoiCanvasCTX.fillRect(((this.voronoi.polygons[i].centroid.x - this.minViewX)/binSizeX), ((this.voronoi.polygons[i].centroid.y - this.minViewY) / binSizeY), 2, 2);
                   //     voronoiCanvasCTX.fillRect(this.polygons[i]['DataPoint'][0], this.polygons[i]['DataPoint'][1], 2, 2);

                   if(this.sourceChrom == this.targetChrom) {
                    voronoiCanvasCTX.fillRect(((this.voronoi.polygons[i].centroid.y - this.minViewX)/binSizeX), ((this.voronoi.polygons[i].centroid.x - this.minViewY) / binSizeY), 2, 2);
                   }
                    }
                }
            }
        }

        this.redraw()
    }

    setDisplayVoronoiEdges(display: boolean) {
        this.displayVoronoiEdges = display;

        this.redraw();
    }

    // When changing contact plot -> only redraw contacts

    redraw() {   
        var axisCanvas = this.getAxisCanvas();
        var axisCanvasCTX = <CanvasRenderingContext2D>axisCanvas.getContext('2d');
        axisCanvasCTX.clearRect(0, 0, this.axisCanvas.width, this.axisCanvas.height);
        
        axisCanvasCTX.save();

        if (this.intrachromosomeView) {
            axisCanvasCTX.rotate(-45*Math.PI/180)
            axisCanvasCTX.scale(1/Math.sqrt(2), 1/Math.sqrt(2))
            axisCanvasCTX.imageSmoothingEnabled = true;
        } else {
            axisCanvasCTX.imageSmoothingEnabled = false;
        }
        axisCanvasCTX.drawImage(this.voronoiCanvas, 0, 0, this.getVoronoiDrawWidth(), this.getVoronoiDrawHeight(),
            0, 0, this.axisCanvas.width, this.axisCanvas.height);

        this.drawContacts();

        axisCanvasCTX.restore();

        this.drawAxisCanvas();
    }
}