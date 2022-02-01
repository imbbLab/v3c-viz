import { Axis } from './axis'
//import { Delaunay, Voronoi } from "d3-delaunay";
import * as d3 from 'd3';
import { SVGContext } from './canvas2svg';
import { Polygon, Voronoi } from './voronoi';


export class VoronoiPlot extends Axis {

    imageCanvas: HTMLCanvasElement;
    imageCTX: CanvasRenderingContext2D;
    //imageDiv: HTMLDivElement;

    maxNumberPointsToLoad = 2e5;

    smoothingRepetitions: number;
    omega: number;

    //belowBrowser: igv.Browser
    //rightBrowser: igv.Browser

    displayVoronoiEdges: boolean;
    displayCentroid: boolean = false;
    displayVoronoiPoints: boolean = false;

    generateVoronoiOnServer: boolean = true

    dataPointSize = 5

    boxesToDraw: Array<number[]>;

    //axis: Axis;
    points: Uint32Array
    normPoints: Array<number[]>

    //voronoi: Voronoi<Delaunay.Point>;
    voronoi: Voronoi;
    voronoiCanvas: HTMLCanvasElement;
    polygons: Polygon[] = []


    constructor(canvas: HTMLCanvasElement) {
        super(canvas);

        //this.imageDiv = <HTMLDivElement>document.getElementById("figure-div");
        this.imageCanvas = canvas; //<HTMLCanvasElement>document.getElementById("voronoi-canvas");
        this.imageCTX = <CanvasRenderingContext2D>this.imageCanvas.getContext('2d')
        this.imageCTX.imageSmoothingEnabled = false;

        this.tickDecimalPlaces = 0;

        this.smoothingRepetitions = 1;
        this.omega = 1;
        this.points = new Uint32Array(0);
        this.normPoints = new Array<number[]>();
        this.boxesToDraw = new Array<number[]>();

        //this.belowBrowser = belowBrowser;
        //this.rightBrowser = rightBrowser;

        this.displayVoronoiEdges = true;
        this.displayVoronoiPoints;

        // Buffer canvas for voronoi to improve interactivity 
        this.voronoiCanvas = document.createElement("canvas");
        this.voronoiCanvas.width = 1600; //this.axisWidth;
        this.voronoiCanvas.height = 1600; //this.axisHeight;

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
        return this.voronoiCanvas.width //Math.max(this.axisWidth, this.voronoiCanvas.width)
    }

    getVoronoiDrawHeight() {
        return this.voronoiCanvas.height //Math.max(this.axisHeight, this.voronoiCanvas.height)
    }


    scale: d3.ScaleQuantize<number, never> | undefined;
    colourScale: d3.ScaleContinuousNumeric<string, string, never> | undefined;

    // TODO: Put colour bar in its own class..
    //colourMinArea: number = -1
    //colourMaxArea: number = -1

    setColourScale(colourScale: d3.ScaleContinuousNumeric<string, string, never>) {
        this.colourScale = colourScale;
        //this.colourMinArea = min;
        //this.colourMaxArea = max;
    }

    setScale(scale: d3.ScaleQuantize<number, never>) {
        this.scale = scale;
    }

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

        this.drawVoronoi(voronoiCanvasCTX, this.getVoronoiDrawWidth(), this.getVoronoiDrawHeight(), false)
        //this.drawPolygons(voronoiCanvasCTX, this.polygons);

        this.redraw()
    }


    convertVoronoiToPolygons(width: number, height: number, clipDiagonal: boolean): Polygon[] {
        let polygons: Polygon[] = [];

        let clipPolygon = new Polygon();

        if (!clipDiagonal) {
            clipPolygon.points.push({ x: this.minViewX, y: this.minViewY },
                { x: this.maxViewX, y: this.minViewY },
                { x: this.maxViewX, y: this.maxViewY },
                { x: this.minViewX, y: this.maxViewY })
        } else {
            clipPolygon.points.push({ x: this.minViewX, y: this.minViewY },
                { x: this.maxViewX, y: this.maxViewY },
                { x: this.minViewX, y: this.maxViewY })
        }


        let binSizeX = (this.maxViewX - this.minViewX) / width
        let binSizeY = (this.maxViewY - this.minViewY) / height

        for (let i = 0; i < this.voronoi.polygons.length; i++) { //this.voronoi.polygons.length
            if (this.voronoi.polygons[i].area < 14) {
                continue;
            }

            let points = this.voronoi.polygons[i].clip(clipPolygon).points

            if (points.length >= 3) {
                for (let j = 0; j < points.length; j++) {
                    points[j].y = ((points[j].y - this.minViewY) / binSizeY)
                    points[j].x = ((points[j].x - this.minViewX) / binSizeX)

                    // Remove odd edge that occurs when saving to SVG
                    // TODO: Investigate cause? Why do we need this?
                    if (points[j].y > height) {
                        points[j].y = height
                    }
                    if (points[j].x > width) {
                        points[j].x = width
                    }
                }

                let polygon = new Polygon();
                polygon.points = points;
                polygon.area = this.voronoi.polygons[i].area;
                polygon.logArea = this.voronoi.polygons[i].logArea;
                polygon.centroid = { x: ((this.voronoi.polygons[i].centroid.x - this.minViewX) / binSizeX), y: ((this.voronoi.polygons[i].centroid.y - this.minViewY) / binSizeY) };
                polygon.dataPoint = { x: ((this.voronoi.polygons[i].dataPoint.x - this.minViewX) / binSizeX), y: ((this.voronoi.polygons[i].dataPoint.y - this.minViewY) / binSizeY) };

                polygons.push(polygon)
            }

            // Need to draw the other part of the voronoi as we only kept one part of triangle
            if (this.sourceChrom == this.targetChrom) {
                // Recreate opposite polygon
                let oppPolygon = new Polygon()
                for (let j = 0; j < this.voronoi.polygons[i].points.length; j++) {
                    oppPolygon.points.push({ x: this.voronoi.polygons[i].points[j].y, y: this.voronoi.polygons[i].points[j].x })
                }

                points = oppPolygon.clip(clipPolygon).points

                if (points.length >= 3) {
                    for (let j = 0; j < points.length; j++) {
                        points[j].y = ((points[j].y - this.minViewY) / binSizeY)
                        points[j].x = ((points[j].x - this.minViewX) / binSizeX)

                        // Remove odd edge that occurs when saving to SVG
                        // TODO: Investigate cause? Why do we need this?
                        if (points[j].y > height) {
                            points[j].y = height
                        }
                        if (points[j].x > width) {
                            points[j].x = width
                        }
                    }

                    let polygon = new Polygon();
                    polygon.points = points;
                    polygon.area = this.voronoi.polygons[i].area;
                    polygon.logArea = this.voronoi.polygons[i].logArea;
                    polygon.centroid = { x: ((this.voronoi.polygons[i].centroid.x - this.minViewX) / binSizeX), y: ((this.voronoi.polygons[i].centroid.y - this.minViewY) / binSizeY) };
                    polygon.dataPoint = { x: ((this.voronoi.polygons[i].dataPoint.x - this.minViewX) / binSizeX), y: ((this.voronoi.polygons[i].dataPoint.y - this.minViewY) / binSizeY) };

                    polygons.push(polygon)
                }
            }
        }

        return polygons;
    }

    drawVoronoi(voronoiCanvasCTX: CanvasRenderingContext2D | SVGContext, width: number, height: number, clipDiagonal: boolean) {
        if (!this.scale || !this.colourScale) {
            return;
        }

        if (this.displayVoronoiEdges || this.displayCentroid) {
            voronoiCanvasCTX.fillStyle = 'rgb(0, 0, 0)'
        } else {
            voronoiCanvasCTX.fillStyle = this.colourScale(0);
        }

        if (voronoiCanvasCTX instanceof CanvasRenderingContext2D) {
            // If we are saving to SVG then we don't need or want to fill the whole area
            voronoiCanvasCTX.fillRect(0, 0, width, height);
        }

        let startTime = performance.now();
        let polygons = this.convertVoronoiToPolygons(width, height, clipDiagonal);
        let endTime = performance.now();
        console.log(`Call to convertVoronoiToPolygons took ${endTime - startTime} milliseconds`)


        if (voronoiCanvasCTX instanceof CanvasRenderingContext2D) {
            this.polygons = polygons;
        }

        startTime = performance.now();
        this.drawPolygons(voronoiCanvasCTX, polygons);
        endTime = performance.now();
        console.log(`Call to drawPolygons took ${endTime - startTime} milliseconds`)
    }

    drawPolygonsCanvas() {
        if (!this.scale || !this.colourScale) {
            return;
        }

        let voronoiCanvasCTX = <CanvasRenderingContext2D>this.voronoiCanvas.getContext("2d");
        voronoiCanvasCTX.clearRect(0, 0, this.voronoiCanvas.width, this.voronoiCanvas.height);

        if (this.displayVoronoiEdges || this.displayCentroid) {
            voronoiCanvasCTX.fillStyle = 'rgb(0, 0, 0)'
        } else {
            voronoiCanvasCTX.fillStyle = this.colourScale(0);
        }
        voronoiCanvasCTX.fillRect(0, 0, this.voronoiCanvas.width, this.voronoiCanvas.height);

        this.drawPolygons(voronoiCanvasCTX, this.polygons)

        this.redraw()
    }

    drawPolygons(voronoiCanvasCTX: CanvasRenderingContext2D | SVGContext, polygons: Polygon[]) {
        if (!this.scale || !this.colourScale) {
            return;
        }

        // Draw the polygons that are too small to be drawn with detail (between 1 and 2 pixels width/height)
        // If displaying edges, then display them with the same colour as the edges, otherwise same as the smallest value on colour scale
        if (this.displayVoronoiEdges || this.displayCentroid) {
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


        if (this.colourScale && this.scale) {
            for (let i = 0; i < polygons.length; i++) {
                voronoiCanvasCTX.fillStyle = this.colourScale(this.scale(Math.log(polygons[i].area)));

                voronoiCanvasCTX.beginPath();
                voronoiCanvasCTX.moveTo(polygons[i].points[0].x, polygons[i].points[0].y)

                for (let j = 1; j < polygons[i].points.length; j++) {
                    voronoiCanvasCTX.lineTo(polygons[i].points[j].x, polygons[i].points[j].y)
                }

                voronoiCanvasCTX.closePath();
                voronoiCanvasCTX.fill();

                if (this.displayVoronoiEdges) {
                    voronoiCanvasCTX.stroke();
                }
            }
        }
        voronoiCanvasCTX.fillStyle = 'rgb(0, 0, 0)'



        if (this.displayCentroid) {
            for (let i = 0; i < polygons.length; i++) {
                voronoiCanvasCTX.fillRect(polygons[i].centroid.x - this.dataPointSize / 2, polygons[i].centroid.y - this.dataPointSize / 2, this.dataPointSize, this.dataPointSize);

                if (this.sourceChrom == this.targetChrom) {
                    voronoiCanvasCTX.fillRect(polygons[i].centroid.x - this.dataPointSize / 2, polygons[i].centroid.y - this.dataPointSize / 2, this.dataPointSize, this.dataPointSize);
                }
            }
        }
        if (this.displayVoronoiPoints) {
            for (let i = 0; i < polygons.length; i++) {
                voronoiCanvasCTX.fillRect(polygons[i].dataPoint.x - this.dataPointSize / 2, polygons[i].dataPoint.y - this.dataPointSize / 2, this.dataPointSize, this.dataPointSize);

                if (this.sourceChrom == this.targetChrom) {
                    voronoiCanvasCTX.fillRect(polygons[i].dataPoint.x - this.dataPointSize / 2, polygons[i].dataPoint.y - this.dataPointSize / 2, this.dataPointSize, this.dataPointSize);
                }
            }
        }

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
            axisCanvasCTX.rotate(-45 * Math.PI / 180)
            axisCanvasCTX.scale(1 / Math.sqrt(2), 1 / Math.sqrt(2))
            axisCanvasCTX.imageSmoothingEnabled = true;
        } else {
            axisCanvasCTX.imageSmoothingEnabled = false;
        }
        //if()
        axisCanvasCTX.drawImage(this.voronoiCanvas, 0, 0, this.getVoronoiDrawWidth(), this.getVoronoiDrawHeight(),
            0, 0, this.axisCanvas.width, this.axisCanvas.height);

        this.drawContacts(axisCanvasCTX, axisCanvas.width, axisCanvas.height, false);

        axisCanvasCTX.restore();

        this.drawAxisCanvas();
    }
}