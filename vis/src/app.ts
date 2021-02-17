//import { Delaunay } from "d3-delaunay";
//import { createGzip } from "zlib";
import { ImageMap } from "./imageMap";
import { VoronoiPlot } from "./voronoiPlot";

import * as dat from 'dat.gui';

//import 'jquery-ui-dist/jquery-ui';
import * as igv from 'igv';
import * as igvutils from 'igv-utils';

//import igv = require('igv');
//import { browser } from "igv_wrapper";
//import * as igv from 'igv_wrapper';
//import igv from 'igv.esm.min.js'

//import Delaunator from 'delaunator';

//import * as points from './data/output.json';



//http://localhost:5001/points?xStart=1000000&xEnd=1100000&yStart=1000000&yEnd=1100000

var xStart = 8e4
var xEnd = 3e6
var yStart = 8e4
var yEnd = 3e6

var numBins = 500;

let points: Uint32Array;
let normPoints: Array<number[]>;

var voronoiMap: VoronoiPlot;
var imageMap: ImageMap;

//https://s3.amazonaws.com/igv.org.genomes/genomes.json
const options: igv.IIGVBrowserOptions = {
    palette: ['#00A0B0', '#6A4A3C', '#CC333F', '#EB6841'],
    locus: 'chr4:0-1348131',

    reference: {
        id: 'dm6',
        fastaURL: 'https://s3.amazonaws.com/igv.broadinstitute.org/genomes/seq/dm6/dm6.fa',
        indexURL: 'https://s3.amazonaws.com/igv.broadinstitute.org/genomes/seq/dm6/dm6.fa.fai',
        cytobandURL: "https://s3.amazonaws.com/igv.org.genomes/dm6/cytoBandIdeo.txt.gz"
    },

    //trackDefaults: {
    //  bam: {
    //    coverageThreshold: 0.2,
    //    coverageQualityWeight: true
    //  }
    //},

    tracks: [
        {
            "name": "Ensembl Genes",
            "type": "annotation",
            "format": "ensgene",
            "displayMode": "EXPANDED",
            "url": "https://s3.dualstack.us-east-1.amazonaws.com/igv.org.genomes/dm6/ensGene.txt.gz",
            "indexURL": "https://s3.dualstack.us-east-1.amazonaws.com/igv.org.genomes/dm6/ensGene.txt.gz.tbi",
            "visibilityWindow": 20000000
        },
        {
            "name": "Repeat Masker",
            "type": "annotation",
            "format": "rmsk",
            "displayMode": "EXPANDED",
            "url": "https://s3.dualstack.us-east-1.amazonaws.com/igv.org.genomes/dm6/rmsk.txt.gz",
            "indexURL": "https://s3.dualstack.us-east-1.amazonaws.com/igv.org.genomes/dm6/rmsk.txt.gz.tbi",
            "visibilityWindow": 1000000
        },
        //        {
        //          "name": "CpG Islands",
        //          "type": "annotation",
        //          "format": "cpgIslandExt",
        //          "displayMode": "EXPANDED",
        //          "url": "https://s3.dualstack.us-east-1.amazonaws.com/igv.org.genomes/dm6/cpgIslandExt.txt.gz"
        //        }
    ]
}



// function linedraw(ax:number,ay:number, length: number)
// {
//     /*if(ay>by)
//     {
//         bx=ax+bx;  
//         ax=bx-ax;
//         bx=bx-ax;
//         by=ay+by;  
//         ay=by-ay;  
//         by=by-ay;
//     }
//     var calc=Math.atan((ay-by)/(bx-ax));
//     calc=calc*180/Math.PI;
//     var length=Math.sqrt((ax-bx)*(ax-bx)+(ay-by)*(ay-by));*/

//     let vertline = (<HTMLDivElement>document.getElementById('vertline'))
//     vertline.style.height =  length + "px";
//     vertline.style.top =  ay + "px";
//     vertline.style.left = ax + "px";

//     console.log("" + length)
//     console.log(vertline.style.height)

//     // = 'height:" + length + "px;top:" + (ay) + "px;left:" + (ax) + "px;transform:rotate(" + calc + "deg);-ms-transform:rotate(" + calc + "deg);transform-origin:0% 0%;-moz-transform:rotate(" + calc + "deg);-moz-transform-origin:0% 0%;-webkit-transform:rotate(" + calc  + "deg);-webkit-transform-origin:0% 0%;-o-transform:rotate(" + calc + "deg);-o-transform-origin:0% 0%;'

//     //document.body.innerHTML += "<div id='line' style='height:" + length + "px;width:1px;background-color:black;position:absolute;top:" + (ay) + "px;left:" + (ax) + "px;transform:rotate(" + calc + "deg);-ms-transform:rotate(" + calc + "deg);transform-origin:0% 0%;-moz-transform:rotate(" + calc + "deg);-moz-transform-origin:0% 0%;-webkit-transform:rotate(" + calc  + "deg);-webkit-transform-origin:0% 0%;-o-transform:rotate(" + calc + "deg);-o-transform-origin:0% 0%;'></div>"
// }
// linedraw(10, 10, 500)

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

var promise: Promise<igv.IGVBrowser> = igv.createBrowser(<HTMLDivElement>document.getElementById('gene-browser-below'), options);
promise.then(belowBrowser => {
    var promise: Promise<igv.IGVBrowser> = igv.createBrowser(<HTMLDivElement>document.getElementById('gene-browser-right'), options);
    promise.then(rightBrowser => {
        var HASH_PREFIX = "#/locus/";
        console.log(belowBrowser);
        belowBrowser.on('locuschange', function (referenceFrame: igv.ReferenceFrame) {
            console.log(referenceFrame)
            window.location.replace(HASH_PREFIX + referenceFrame.label);

            rightBrowser.search("chr4:727991-835841").then((referenceList) => {
                console.log("Finished searching");
                console.log(referenceList)
                let trackContainer = $(rightBrowser.trackContainer);
                console.log(trackContainer)
                console.log(rightBrowser.$root)
                //$(document).off('mousedown')
                //$(document).off('mouseup')
                rightBrowser.$root.off();
                $(rightBrowser.trackContainer).off('mousemove').on('mousemove', (event) => {
                    console.log(event)
                    event.stopPropagation();
                });
                //trackContainer.off('mouseup');

                rightBrowser.trackViews.forEach((track) => {
                    track.viewports.forEach((viewport) => {
                        console.log(viewport)

                        viewport.trackView.$viewportContainer.off().on('mousemove', (event) => {
                            event.stopPropagation();

                            let self = rightBrowser;
                            var coords, viewport, viewportWidth, referenceFrame;

                            event.preventDefault();

                            if (self.loadInProgress()) {
                                return;
                            }

                            coords = igvutils.DOMUtils.pageCoordinates(event);

                            if (self.vpMouseDown) {

                                // Determine direction,  true == horizontal
                                const horizontal = Math.abs((coords.x - self.vpMouseDown.mouseDownX)) > Math.abs((coords.y - self.vpMouseDown.mouseDownY));
                                const vertical = !horizontal;

                                viewport = self.vpMouseDown.viewport;
                                viewportWidth = <number>viewport.$viewport.width();
                                referenceFrame = viewport.referenceFrame;

                                if (!self.dragObject && !self.isScrolling) {
                                    self.dragObject = {
                                        viewport: viewport,
                                        start: referenceFrame.start
                                    };
                                }

                                if (self.dragObject) {
                                    const viewChanged = referenceFrame.shiftPixels(coords.y - self.vpMouseDown.lastMouseY, viewportWidth);
                                    if (viewChanged) {

                                        if (self.referenceFrameList.length > 1) {
                                            self.updateLocusSearchWidget(self.referenceFrameList);
                                        } else {
                                            self.updateLocusSearchWidget([self.vpMouseDown.referenceFrame]);
                                        }

                                        self.updateViews();
                                    }
                                    self.fireEvent('trackdrag');

                                    if (self.isScrolling) {
                                        const delta = self.vpMouseDown.r * (self.vpMouseDown.lastMouseY - coords.y);
                                        self.vpMouseDown.viewport.trackView.scrollBy(delta);
                                    }
                                }

                                console.log(self.dragObject)

                                self.vpMouseDown.lastMouseX = coords.x;
                                self.vpMouseDown.lastMouseY = coords.y;
                            }
                        });

                        console.log("Turning off $viewport")
                        viewport.$viewport.off().on('mousedown', (event) => {
                            console.log(event);
                            event.stopImmediatePropagation();
                            viewport.enableClick = true;

                            let coords = igvutils.DOMUtils.pageCoordinates(event);
                            rightBrowser.vpMouseDown = {
                                viewport: viewport,
                                lastMouseX: coords.x,
                                mouseDownX: coords.x,
                                lastMouseY: coords.y,
                                mouseDownY: coords.y,
                                referenceFrame: viewport.referenceFrame,
                                r: 1
                            };

                            //rightBrowser.mouseDownOnViewport(event, viewport);
                            //mouseDownCoords = igvutils.DOMUtils.pageCoordinates(event);
                        })
                        //viewport.$viewport.off('mouseup');
                    })

                    console.log(track);
                    console.log(track.$trackDragScrim)

                    if (track.$trackDragScrim) {
                        console.log("Turning off trackDragScrim")
                        track.$trackDragScrim.off(); //('mousedown');
                        //track.$trackDragScrim.off('mouseup');
                    }
                    if (track.$trackManipulationHandle) {
                        console.log("Turning off trackManipulationHandle")
                        track.$trackManipulationHandle.off(); //('mousedown');
                        //track.$trackManipulationHandle.off('mouseup');
                    }

                    //
                    $(document).off() //('mousedown' + track.namespace);
                    //$(document).off('mouseup' + track.namespace);
                })
            })
        });






        /**/

        let jQueryKeyName = Object.keys(belowBrowser.trackContainer)[0];
        //let obj = belowBrowser.trackContainer.
        console.log(jQueryKeyName)
        console.log(Object.keys(belowBrowser.trackContainer));
        console.log(belowBrowser.trackContainer);
        console.log(belowBrowser.trackViews);

        voronoiMap = new VoronoiPlot(belowBrowser, rightBrowser);
        imageMap = new ImageMap(numBins, voronoiMap);


        //imageMap.loadDensityImage(200, xStart, xEnd, yStart, yEnd, voronoiMap.loadDataForVoronoi);

        let overviewNumBins = <HTMLInputElement>document.getElementById("overviewNumBins");

        overviewNumBins.addEventListener("change", function () {
            //startXFrac = (parseFloat(minXText.value) - minX) / xDataDiff;
            //updatePoints();
            console.log(overviewNumBins.value)
            imageMap.setNumberBins(parseFloat(overviewNumBins.value));
            imageMap.updateView(imageMap.minDataX, imageMap.maxDataX, imageMap.minDataY, imageMap.maxDataY);
        });

        let percentileIntensity = <HTMLInputElement>document.getElementById("percentileIntensity");

        percentileIntensity.addEventListener("change", function () {
            //startXFrac = (parseFloat(minXText.value) - minX) / xDataDiff;
            //updatePoints();
            console.log(percentileIntensity.value)
            imageMap.setPercentile(parseFloat(percentileIntensity.value));
        });

        let intensityRange = <HTMLInputElement>document.getElementById("intensityRange");
        intensityRange.value = "950";
        intensityRange.oninput = (event: Event) => {
            imageMap.setPercentile(parseFloat(intensityRange.value) / 1000);
        }

        let displayVoronoiEdges = <HTMLInputElement>document.getElementById('displayVoronoiEdges');
        displayVoronoiEdges.onchange = (event: Event) => {
            voronoiMap.setDisplayVoronoiEdges(displayVoronoiEdges.checked);
        }

        let voronoiRepetitions = <HTMLInputElement>document.getElementById("voronoiRepetitions");
        voronoiRepetitions.value = "1";
        voronoiRepetitions.oninput = (event: Event) => {
            voronoiMap.setSmoothingRepetitions(parseInt(voronoiRepetitions.value));
        }

        let voronoiOmega = <HTMLInputElement>document.getElementById("voronoiOmega");
        voronoiOmega.value = "1000";
        voronoiOmega.oninput = (event: Event) => {
            voronoiMap.setOmega(parseFloat(voronoiOmega.value) / 1000);
        }

        (<HTMLDivElement>document.getElementById('gene-browser-right')).classList.add("rotated");//.setAttribute("class", "rotated")

        // Set up the options boxes
        const imageGUI = new dat.GUI({ name: "Image Options", autoPlace: false });
        //imageGUI.domElement.className = 'dgui main';
        document.getElementById('image-canvas-div')?.appendChild(imageGUI.domElement);
        //document.getElementById('image-canvas-div')?.insertBefore(imageGUI.domElement, document.getElementById('image-canvas'));
        imageGUI.add(imageMap, 'numBins').name('Number of bins').onChange((value) => {
            imageMap.setNumberBins(parseInt(value));
        });
        imageGUI.add(imageMap, 'percentile', 0, 1, 0.001).name('Percentile (threshold) ').onChange((value) => {
            imageMap.setPercentile(parseFloat(value));
        });

        imageMap.addContactMenu(imageGUI);


        // Set up the options for voronoi
        const voronoiGUI = new dat.GUI({ name: "Voronoi Options", autoPlace: false });
        console.log(document.getElementById('voronoi-canvas-div'))
        document.getElementById('voronoi-canvas-div')?.appendChild(voronoiGUI.domElement);

        voronoiGUI.add(voronoiMap, 'displayVoronoiEdges').name('Display edges').onChange((value) => {
            voronoiMap.drawVoronoi();
            voronoiMap.redraw();
        })

        const smoothingMenu = voronoiGUI.addFolder('Smoothing');
        smoothingMenu.add(voronoiMap, 'smoothingRepetitions', 0, 10, 1).name('Repetitions').onChange((value) => {
            voronoiMap.calculateVoronoi();
            voronoiMap.drawVoronoi();
            voronoiMap.redraw();
        })

        smoothingMenu.add(voronoiMap, 'omega', 0, 2).name('Omega').onChange((value) => {
            voronoiMap.calculateVoronoi();
            voronoiMap.drawVoronoi();
            voronoiMap.redraw();
        })

        voronoiMap.addContactMenu(voronoiGUI);
    });
});

/*
function loadDataForVoronoi(miX: number, maX: number, miY: number, maY: number) {
    minX = miX;
    maxX = maX;
    minY = miY;
    maxY = maY;

    fetch('./points?xStart=' + minX + '&xEnd=' + maxX + '&yStart=' + minY + '&yEnd=' + maxY)
    .then(
        function(response) {
        if (response.status !== 200) {
            console.log('Looks like there was a problem. Status Code: ' +
            response.status);
            return;
        }

        // Examine the text in the response
        response.arrayBuffer().then(function(byteBuffer) {
            points = new Uint32Array(byteBuffer);

            normPoints = Array<number[]>(points.length);

            for(let i = 0; i < points.length/2; i++) {
                normPoints[i*2] = Array<number>(2);

                normPoints[i*2+1] = Array<number>(2);
            }


            updatePoints();
        });
    }
    )
    .catch(function(err) {
    console.log('Fetch Error :-S', err);
    });
}



//console.log(points);

var canvas : HTMLCanvasElement
canvas = <HTMLCanvasElement>document.getElementById("figure-canvas");
console.log(canvas)
const ctx = <CanvasRenderingContext2D>canvas.getContext('2d')
console.log(ctx)


let canvasWidth = canvas.width;
let canvasHeight = canvas.height;

let axisX = 50;
let axisY = 50;
let axisWidth = canvasWidth - axisX - 50;
let axisHeight = canvasHeight - axisY - 50;

var canvasBuffer = document.createElement("canvas");
canvasBuffer.width = axisWidth;
canvasBuffer.height = axisHeight;
var canvasBufferContext = <CanvasRenderingContext2D>canvasBuffer.getContext('2d');
console.log(canvasBuffer);

let minX = xStart; //points[0][0];
let minY = yStart; //points[0][1];
let maxX = xEnd; //points[points.length-1][0];
let maxY = yEnd; //points[points.length-1][1];

let xDataDiff = maxX - minX;
let yDataDiff = maxY - minY;

let minXText = <HTMLInputElement>document.getElementById("minX");
let minYText = <HTMLInputElement>document.getElementById("minY");
minXText.value = ""+ minX;
minYText.value = ""+ minY;

minXText.addEventListener("change", function() {
    //startXFrac = (parseFloat(minXText.value) - minX) / xDataDiff;
    //updatePoints();

    xStart = parseFloat(minXText.value);
    imageMap.loadDensityImage(xStart, xEnd, yStart, yEnd, loadDataForVoronoi);
});

minYText.addEventListener("change", function() {
    //startYFrac = (parseFloat(minYText.value) - minY) / yDataDiff;
    //updatePoints();

    yStart = parseFloat(minYText.value);
    imageMap.loadDensityImage(xStart, xEnd, yStart, yEnd, loadDataForVoronoi);
});

let maxXText = <HTMLInputElement>document.getElementById("maxX");
let maxYText = <HTMLInputElement>document.getElementById("maxY");
maxXText.value = ""+ maxX;
maxYText.value = ""+ maxY;

maxXText.addEventListener("change", function() {
    //endXFrac = (parseFloat(maxXText.value) - minX) / xDataDiff;
    //updatePoints();

    xEnd = parseFloat(maxXText.value);
    imageMap.loadDensityImage(xStart, xEnd, yStart, yEnd, loadDataForVoronoi);
});

maxYText.addEventListener("change", function() {
    //endYFrac = (parseFloat(maxYText.value) - minY) / yDataDiff;
    //updatePoints();

    yEnd = parseFloat(maxYText.value);
    imageMap.loadDensityImage(xStart, xEnd, yStart, yEnd, loadDataForVoronoi);
});

console.log(xDataDiff)

let startXFrac = 0;
let startYFrac = 0;
let endXFrac = 1;
let endYFrac = 1;

interface Coordinate {
    x: number;
    y: number;
}


//var canvasX = canvas.getBoundingClientRect().left;
//var canvasY = canvas.getBoundingClientRect().top;
//var axisX = canvas.getBoundingClientRect().left + axisStartX;
//var axisY = canvas.getBoundingClientRect().top + axisStartY;
var lastMousePos:Coordinate = {x: 0, y: 0};
//var mousex = mousey = 0;
var mouseDown = false;

//Mousedown
canvas.addEventListener('mousedown', function(event: MouseEvent) {
    lastMousePos = getMousePos(canvas, event);
    mouseDown = true;
});

//Mouseup
canvas.addEventListener('mouseup', function(event: MouseEvent) {
    mouseDown = false;

    var startAxisPos = getAxisCoord(lastMousePos);
    var endAxisPos = getAxisCoord(getMousePos(canvas, event));

    let xDiff = endXFrac - startXFrac;
    let yDiff = endYFrac - startYFrac;

    let minX = Math.min(startAxisPos.x, endAxisPos.x);
    let maxX = Math.max(startAxisPos.x, endAxisPos.x);
    let minY = Math.min(startAxisPos.y, endAxisPos.y);
    let maxY = Math.max(startAxisPos.y, endAxisPos.y);

    startXFrac += minX * xDiff;
    endXFrac -= (1 - maxX) * xDiff;
    startYFrac += minY * yDiff;
    endYFrac -= (1 - maxY) * yDiff;

    // Calculate the percentage of the canvas
    //startXFrac +=  (lastMousePos.x / axisWidth) * xDiff;
    //endXFrac -= (1 - mousePos.x / axisWidth) * xDiff;
    //startYFrac +=  (lastMousePos.y / axisHeight) * yDiff;
    //endYFrac -= (1 - mousePos.y / axisHeight) * yDiff;

    updatePoints()
});



function getMousePos(canvas: HTMLCanvasElement, event: MouseEvent): Coordinate {
    var rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
}

function getAxisCoord(canvasCoord: Coordinate): Coordinate {
    var mouseX = canvasCoord.x - axisX;
    var mouseY = (canvasHeight - axisY) - canvasCoord.y;

    return {
        x: mouseX / axisWidth,
        y: mouseY / axisHeight
    };
}

//Mousemove
canvas.addEventListener('mousemove', function(event: MouseEvent) {
    var mousePos = getMousePos(canvas, event);
    var axisPos = getAxisCoord(mousePos);

    //console.log(mousePos)
    //console.log(axisPos)

    if(axisPos.x >= 0 && axisPos.x <= 1 && axisPos.y >= 0 && axisPos.y <= 1) {
        if(mouseDown) {
            // Reset the image
            drawVoroniFromBuffer();

            ctx.beginPath();
            var width = mousePos.x-lastMousePos.x;
            var height = mousePos.y-lastMousePos.y;
            ctx.rect(lastMousePos.x, lastMousePos.y, width, height);
            ctx.strokeStyle = 'blue';
            ctx.lineWidth = 2;
            ctx.stroke();
        } else {
            // Reset the image
            drawVoroniFromBuffer();

            ctx.beginPath();
            ctx.moveTo(axisX, mousePos.y);
            ctx.lineTo(mousePos.x, mousePos.y);
            ctx.lineTo(mousePos.x, canvasHeight-axisX);
            ctx.strokeStyle = 'red';
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        // Always draw the box, even when zooming
        let boxHeight = 30;
        let boxWidth = 175;

        let margin = 5;

        ctx.fillStyle = "lightblue";
        ctx.fillRect(mousePos.x + margin, mousePos.y-boxHeight/2, boxWidth, boxHeight);

        let xDiff = endXFrac - startXFrac;
        let yDiff = endYFrac - startYFrac;
        var xPosition = (startXFrac + axisPos.x * xDiff) * xDataDiff + minX;
        var yPosition = (startYFrac + axisPos.y * yDiff) * yDataDiff + minY;

        ctx.font = "19px Arial";
        ctx.fillStyle = "black";
        ctx.textBaseline = "middle";
        ctx.textAlign = "left";
        ctx.fillText("" +xPosition.toFixed(0) + ", " + yPosition.toFixed(0), mousePos.x + margin*2, mousePos.y);
    }
});

canvas.addEventListener('dblclick', function(){
    startXFrac = 0;
    startYFrac = 0;
    endXFrac = 1;
    endYFrac = 1;

    updatePoints()
});

function drawVoroniFromBuffer() {
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    ctx.fillStyle = "lightgray";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.transform(1, 0, 0, -1, 0, canvas.height)
    ctx.drawImage(canvasBuffer, axisX, axisY);
    ctx.restore();

    ctx.save();

    // Draw ticks on axis
    ctx.font = "14px Arial";
    ctx.fillStyle = "black";
    ctx.textBaseline = 'top';
    ctx.textAlign = "center";

    ctx.strokeStyle = 'black';
    ctx.lineWidth = 1;

    let numTicks = 5
    let tickPct = 1 / (numTicks-1);

    let xDiff = endXFrac - startXFrac;
    let yDiff = endYFrac - startYFrac;

    // Draw x-axis ticks
    for(let i = 0; i < numTicks; i++) {
        let curTickPct = i * tickPct;
        let xPos = axisX+(axisWidth * curTickPct);
        let yPos = canvasHeight - axisY;

        var xPosition = (startXFrac + xDiff*curTickPct) * xDataDiff + minX;

        ctx.beginPath();
        ctx.moveTo(xPos, yPos);
        ctx.lineTo(xPos, yPos+10);
        ctx.stroke();
        ctx.fillText("" + xPosition.toFixed(0), xPos, yPos + 25);
    }

    // Draw y-axis ticks
    for(let i = 0; i < numTicks; i++) {
        ctx.save();

        let curTickPct = i * tickPct;
        let xPos = axisX;
        let yPos = canvasHeight - axisY - (axisHeight * curTickPct);

        var yPosition = (startYFrac + yDiff*curTickPct) * yDataDiff + minY;

        ctx.translate(xPos, yPos);
        ctx.rotate(-Math.PI/2);

        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -10);
        ctx.stroke();
        ctx.fillText("" + yPosition.toFixed(0), 0, -35);

        ctx.restore();
    }

    ctx.restore();
}

function updatePoints() { //minX: number, minY: number, maxX: number, maxY: number) {
    // TODO: Sort this out..
    //minX = xStart;
    //maxX = xEnd;
    //minY = yStart;
    //maxY = yEnd;

    let startX = minX + startXFrac*xDataDiff;
    let endX = maxX - (1-endXFrac)*xDataDiff;
    let startY = minY + startYFrac*yDataDiff;
    let endY = maxY - (1-endYFrac)*yDataDiff;

    console.log("Start (" + startX + ", " + startY + ") End (" + endX + ", " + endY + ")");

    minXText.value = "" + startX.toFixed(0);
    maxXText.value = "" + endX.toFixed(0);
    minYText.value = "" + startY.toFixed(0);
    maxYText.value = "" + endY.toFixed(0);

    for(let i = 0; i < points.length/2; i++) {
        normPoints[i*2][0] = ((points[i*2] - startX) / (endX - startX)) * canvasBuffer.width;
        normPoints[i*2][1] = ((points[i*2+1] - startY) / (endY - startY)) * canvasBuffer.height;
        normPoints[i*2+1][0] = ((points[i*2+1] - startX) / (endX - startX)) * canvasBuffer.width;
        normPoints[i*2+1][1] = ((points[i*2] - startY) / (endY - startY)) * canvasBuffer.height;
        //normPoints[i*2+1][0] = canvasWidth - normPoints[i*2][0];
        //normPoints[i*2+1][1] = canvasHeight - normPoints[i*2][1];
    }

    //const points = [[0, 0], [0, 1], [1, 0], [1, 1]];
    const delaunay = Delaunay.from(normPoints);
    const voronoi = delaunay.voronoi([0, 0, canvasBuffer.width, canvasBuffer.height]);


    canvasBufferContext.clearRect(0, 0, canvasBuffer.width, canvasBuffer.height);

    canvasBufferContext.fillStyle = "darkblue";
    canvasBufferContext.beginPath();
    voronoi.delaunay.renderPoints(canvasBufferContext, 1);
    canvasBufferContext.fill();

    canvasBufferContext.strokeStyle = 'RoyalBlue';

    canvasBufferContext.beginPath();
    canvasBufferContext.lineWidth = 1;
    //voronoi.renderBounds(canvasBufferContext);
    voronoi.render(canvasBufferContext)
    canvasBufferContext.stroke();

    drawVoroniFromBuffer();

    console.log(voronoi)
}

*/
