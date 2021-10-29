import { Axis } from './axis'
import { Locus, Chromosome } from './chromosome'
//import { Delaunay, Voronoi } from "d3-delaunay";
import * as igv from 'igv';
import * as d3 from 'd3';
import { SVGContext } from './canvas2svg';

export class Point {
    x: number
    y: number

    constructor(x: number, y: number) {
        this.x = x;
        this.y = y;
    }
}

export class Polygon {
    points: Point[] = []
    area: number = 0
    logArea: number = 0
    clipped: boolean = false;
    centroid: Point = new Point(0, 0)
    dataPoint: Point = new Point(0, 0)

    clip(clipPolygon: Polygon): Polygon {
        var cp1: Point, cp2: Point, s: Point, e: Point

        var inputPolygon: Polygon, outputPolygon: Polygon
        inputPolygon = new Polygon();
        outputPolygon = new Polygon();

        this.points.forEach(point => {
            outputPolygon.points.push({ x: Math.round(point.x), y: Math.round(point.y) })
        });

        let newPolygonSize = this.points.length

        for (let j = 0; j < clipPolygon.points.length; j++) {
            // copy new polygon to input polygon & set counter to 0
            inputPolygon.points = []

            for (let k = 0; k < newPolygonSize; k++) {
                inputPolygon.points.push(outputPolygon.points[k])
                //inputPolygon.Points = append(inputPolygon.Points, outputPolygon.Points[k])
            }

            let counter = 0
            outputPolygon.points = []

            // get clipping polygon edge
            cp1 = clipPolygon.points[j]
            cp2 = clipPolygon.points[(j + 1) % (clipPolygon.points.length)]

            for (let i = 0; i < newPolygonSize; i++) {
                // get subject polygon edge
                s = inputPolygon.points[i]
                e = inputPolygon.points[(i + 1) % newPolygonSize]

                // Case 1: Both vertices are inside:
                // Only the second vertex is added to the output list
                if (inside(s, cp1, cp2) && inside(e, cp1, cp2)) {
                    outputPolygon.points.push(e)
                    counter++

                    // Case 2: First vertex is outside while second one is inside:
                    // Both the point of intersection of the edge with the clip boundary
                    // and the second vertex are added to the output list
                } else if (!inside(s, cp1, cp2) && inside(e, cp1, cp2)) {
                    outputPolygon.points.push(intersection(cp1, cp2, s, e))
                    outputPolygon.points.push(e)
                    counter++
                    counter++

                    // Case 3: First vertex is inside while second one is outside:
                    // Only the point of intersection of the edge with the clip boundary
                    // is added to the output list
                } else if (inside(s, cp1, cp2) && !inside(e, cp1, cp2)) {
                    outputPolygon.points.push(intersection(cp1, cp2, s, e))
                    counter++

                    // Case 4: Both vertices are outside
                    //} else if !inside(s, cp1, cp2) && !inside(e, cp1, cp2) {
                    // No vertices are added to the output list
                }
            }
            // set new polygon size
            newPolygonSize = counter
        }

        return outputPolygon
    }
}

function inside(p: Point, p1: Point, p2: Point): boolean {
    return (p2.y - p1.y) * p.x + (p1.x - p2.x) * p.y + (p2.x * p1.y - p1.x * p2.y) < 0
}

function intersection(cp1: Point, cp2: Point, s: Point, e: Point): Point {
    let dc = { x: cp1.x - cp2.x, y: cp1.y - cp2.y }
    let dp = { x: s.x - e.x, y: s.y - e.y }

    let n1 = cp1.x * cp2.y - cp1.y * cp2.x
    let n2 = s.x * e.y - s.y * e.x

    let n3 = 1.0 / (dc.x * dp.y - dc.y * dp.x)

    return { x: (n1 * dp.x - n2 * dc.x) * n3, y: (n1 * dp.y - n2 * dc.y) * n3 }

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

    belowBrowser: igv.Browser
    rightBrowser: igv.Browser

    displayVoronoiEdges: boolean;
    displayCentroid: boolean = false;
    displayVoronoiPoints: boolean = false;

    generateVoronoiOnServer: boolean = true

    boxesToDraw: Array<number[]>;

    //axis: Axis;
    points: Uint32Array
    normPoints: Array<number[]>

    //voronoi: Voronoi<Delaunay.Point>;
    voronoi: Voronoi;
    voronoiCanvas: HTMLCanvasElement;
    polygons: Polygon[] = []


    constructor(belowBrowser: igv.Browser, rightBrowser: igv.Browser) {
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

    colours = 100
    scale: d3.ScaleQuantize<number, never> = d3.scaleQuantize()
        .range(d3.range(this.colours))
        .domain([Math.log(1e20), Math.log(1e50)]);
    colourScale: d3.ScaleContinuousNumeric<string, string, never> = d3.scaleLinear<string>()
        .range(["saddlebrown", "lightgreen", "steelblue"])
        .domain([0, this.colours / 2, this.colours]);

    // TODO: Put colour bar in its own class..
    colourMinArea: number = -1
    colourMaxArea: number = -1

    setColourRange(min: number, max: number) {
        this.scale.domain([min, max]);
        this.colourMinArea = min;
        this.colourMaxArea = max;
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

        this.drawVoronoi(voronoiCanvasCTX, 0, 0, this.getVoronoiDrawWidth(), this.getVoronoiDrawHeight(), false, false)
        //this.drawPolygons(voronoiCanvasCTX, this.polygons);

        this.redraw()
    }


    convertVoronoiToPolygons(xOffset: number, yOffset: number, width: number, height: number, invertY: boolean, clipDiagonal: boolean): Polygon[] {
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
            if(this.voronoi.polygons[i].area < 14) {
                continue;
            }

            let points = this.voronoi.polygons[i].clip(clipPolygon).points

            if (points.length >= 3) {
                for (let j = 0; j < points.length; j++) {
                    points[j].y = ((points[j].y - this.minViewY) / binSizeY)
                    points[j].x = xOffset + ((points[j].x - this.minViewX) / binSizeX)
                    if (invertY) {
                        points[j].y = height - points[j].y + yOffset
                    }

                    // Remove odd edge that occurs when saving to SVG
                    // TODO: Investigate cause? Why do we need this?
                    if (points[j].y > height + yOffset) {
                        points[j].y = height + yOffset
                    }
                    if (points[j].x > width + xOffset) {
                        points[j].x = width + xOffset
                    }
                }

                let polygon = new Polygon();
                polygon.points = points;
                polygon.area = this.voronoi.polygons[i].area;
                polygon.logArea = this.voronoi.polygons[i].logArea;
                polygon.centroid = { x: xOffset + ((this.voronoi.polygons[i].centroid.x - this.minViewX) / binSizeX), y: yOffset + ((this.voronoi.polygons[i].centroid.y - this.minViewY) / binSizeY) };
                polygon.dataPoint = { x: xOffset + ((this.voronoi.polygons[i].dataPoint.x - this.minViewX) / binSizeX), y: yOffset + ((this.voronoi.polygons[i].dataPoint.y - this.minViewY) / binSizeY) };

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
                        points[j].x = xOffset + ((points[j].x - this.minViewX) / binSizeX)
                        if (invertY) {
                            points[j].y = height - points[j].y + yOffset
                        }

                        // Remove odd edge that occurs when saving to SVG
                        // TODO: Investigate cause? Why do we need this?
                        if (points[j].y > height + yOffset) {
                            points[j].y = height + yOffset
                        }
                        if (points[j].x > width + xOffset) {
                            points[j].x = width + xOffset
                        }
                    }

                    let polygon = new Polygon();
                    polygon.points = points;
                    polygon.area = this.voronoi.polygons[i].area;
                    polygon.logArea = this.voronoi.polygons[i].logArea;
                    polygon.centroid = { x: xOffset + ((this.voronoi.polygons[i].centroid.x - this.minViewX) / binSizeX), y: yOffset + ((this.voronoi.polygons[i].centroid.y - this.minViewY) / binSizeY) };
                    polygon.dataPoint = { x: xOffset + ((this.voronoi.polygons[i].dataPoint.x - this.minViewX) / binSizeX), y: yOffset + ((this.voronoi.polygons[i].dataPoint.y - this.minViewY) / binSizeY) };

                    polygons.push(polygon)
                }
            }
        }

        return polygons;
    }

    drawVoronoi(voronoiCanvasCTX: CanvasRenderingContext2D | SVGContext, xOffset: number, yOffset: number, width: number, height: number, invertY: boolean, clipDiagonal: boolean) {
        let startTime = performance.now();
        let polygons = this.convertVoronoiToPolygons(xOffset, yOffset, width, height, invertY, clipDiagonal);
        let endTime = performance.now();
        console.log(`Call to convertVoronoiToPolygons took ${endTime - startTime} milliseconds`)


        if (voronoiCanvasCTX instanceof CanvasRenderingContext2D) {
            this.polygons = polygons;
        }

        startTime = performance.now();
        this.drawPolygons(voronoiCanvasCTX, polygons);
        endTime = performance.now();
        console.log(`Call to convertVoronoiToPolygons took ${endTime - startTime} milliseconds`)
    }

    drawPolygonsCanvas() {
        let voronoiCanvasCTX = <CanvasRenderingContext2D>this.voronoiCanvas.getContext("2d");
        voronoiCanvasCTX.clearRect(0, 0, this.voronoiCanvas.width, this.voronoiCanvas.height);

        this.drawPolygons(voronoiCanvasCTX, this.polygons)

        this.redraw()
    }

    drawPolygons(voronoiCanvasCTX: CanvasRenderingContext2D | SVGContext, polygons: Polygon[]) {
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

        let pointSize = 5

        if (this.displayCentroid) {
            for (let i = 0; i < polygons.length; i++) {
                voronoiCanvasCTX.fillRect(polygons[i].centroid.x - pointSize / 2, polygons[i].centroid.y - pointSize / 2, pointSize, pointSize);

                if (this.sourceChrom == this.targetChrom) {
                    voronoiCanvasCTX.fillRect(polygons[i].centroid.x - pointSize / 2, polygons[i].centroid.y - pointSize / 2, pointSize, pointSize);
                }
            }
        }
        if (this.displayVoronoiPoints) {
            for (let i = 0; i < polygons.length; i++) {
                voronoiCanvasCTX.fillRect(polygons[i].dataPoint.x - pointSize / 2, polygons[i].dataPoint.y - pointSize / 2, pointSize, pointSize);

                if (this.sourceChrom == this.targetChrom) {
                    voronoiCanvasCTX.fillRect(polygons[i].dataPoint.x - pointSize / 2, polygons[i].dataPoint.y - pointSize / 2, pointSize, pointSize);
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

        this.drawContacts();

        axisCanvasCTX.restore();

        this.drawAxisCanvas();
    }
}