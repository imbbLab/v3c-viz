//import { Delaunay } from "d3-delaunay";
//import { createGzip } from "zlib";
import { ImageMap } from "./imageMap";
import { Point, Polygon, Voronoi, VoronoiPlot } from "./voronoiPlot";

import * as dat from 'dat.gui';

//import 'jquery-ui-dist/jquery-ui';
import * as igv from 'igv';
import * as igvutils from 'igv-utils';
import { Locus, Chromosome, Interaction, getChromosomeFromMap } from "./chromosome";
import { Rectangle } from "./axis";
import { SVGContext } from "./canvas2svg"


import * as d3 from 'd3';
import { start } from "node:repl";

//import igv = require('igv');
//import { browser } from "igv_wrapper";
//import * as igv from 'igv_wrapper';
//import igv from 'igv.esm.min.js'

//import Delaunator from 'delaunator';

//import * as points from './data/output.json';


var numBins = 500;


var voronoiMap: VoronoiPlot;
var imageMap: ImageMap;

var chromosomes: Map<string, Chromosome> = new Map();
var interactions: Map<string, Map<string, Interaction[]>> = new Map();
var sourceChrom: Chromosome;
var targetChrom: Chromosome;

var bottomBrowser: igv.Browser;
var rightBrowser: igv.Browser;

// If parameters set as part of URL, then load that region of the chromosome, otherwise just load the whole of the first chromosome
const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);
var intrachromosomeView: boolean = false

let viewChangeButton = <HTMLInputElement>document.getElementById('viewChangeButton');

const triangleViewParam = urlParams.get('triangleView')
if (triangleViewParam) {
    intrachromosomeView = triangleViewParam.localeCompare("true") == 0

    if (intrachromosomeView) {
        viewChangeButton.value = "Full view"
    }
}

var displayImageMap = true;
var displayColourControls = false;
var igvHeight = 300;
var viewWidth = 400;
var viewHeight = 400;
var lastLocus: Locus = { chr: "", start: 0, end: 0 }

// Add hover events for load track menu
let loadTrackButton = <HTMLSpanElement>document.getElementById('loadTrack')
let loadTrackMenu = <HTMLSpanElement>document.getElementById('loadTrackMenu')
loadTrackButton.addEventListener('mouseenter', (event) => {
    let dropdown = <HTMLDivElement>document.getElementById('loadTrackMenu');
    let buttonPosition = loadTrackButton.getBoundingClientRect()
    dropdown.style.display = 'block';
    dropdown.style.top = buttonPosition.top + "px"
})
loadTrackButton.addEventListener('mouseleave', (event) => {
    let dropdown = <HTMLDivElement>document.getElementById('loadTrackMenu');

    dropdown.style.display = 'none';
})
loadTrackMenu.addEventListener('mouseenter', (event) => {
    let dropdown = <HTMLDivElement>document.getElementById('loadTrackMenu');
    let buttonPosition = loadTrackButton.getBoundingClientRect()
    dropdown.style.display = 'block';
    dropdown.style.top = buttonPosition.top + "px"
})
loadTrackMenu.addEventListener('mouseleave', (event) => {
    let dropdown = <HTMLDivElement>document.getElementById('saveImageMenu');

    dropdown.style.display = 'none';
})

// Add hover events for save image menu
let saveImageButton = <HTMLSpanElement>document.getElementById('saveButton')
let saveImageMenu = <HTMLSpanElement>document.getElementById('saveImageMenu')
saveImageButton.addEventListener('mouseenter', (event) => {
    let dropdown = <HTMLDivElement>document.getElementById('saveImageMenu');
    let buttonPosition = saveImageButton.getBoundingClientRect()
    dropdown.style.display = 'block';
    dropdown.style.top = buttonPosition.top + "px"
})
saveImageButton.addEventListener('mouseleave', (event) => {
    let dropdown = <HTMLDivElement>document.getElementById('saveImageMenu');

    dropdown.style.display = 'none';
})
saveImageMenu.addEventListener('mouseenter', (event) => {
    let dropdown = <HTMLDivElement>document.getElementById('saveImageMenu');
    let buttonPosition = saveImageButton.getBoundingClientRect()
    dropdown.style.display = 'block';
    dropdown.style.top = buttonPosition.top + "px"
})
saveImageMenu.addEventListener('mouseleave', (event) => {
    let dropdown = <HTMLDivElement>document.getElementById('saveImageMenu');

    dropdown.style.display = 'none';
})

let editColourmapButton = <HTMLInputElement>document.getElementById('editColourmapButton');
editColourmapButton.addEventListener('click', (event) => {
    displayColourControls = !displayColourControls;

    if (!displayColourControls) {
        editColourmapButton.style.filter = ''
    } else {
        editColourmapButton.style.filter = 'sepia(51%)'
    }

    reposition();
});

let hideButton = <HTMLInputElement>document.getElementById('hideButton');
hideButton.addEventListener('click', (event) => {
    displayImageMap = !displayImageMap;

    if (!displayImageMap) {
        hideButton.style.filter = 'sepia(51%)'
    } else {
        hideButton.style.filter = ''
    }

    reposition();
});

viewChangeButton.addEventListener('click', (event) => {
    intrachromosomeView = !intrachromosomeView

    if (!intrachromosomeView) {
        viewChangeButton.style.filter = ''
    } else {
        viewChangeButton.style.filter = 'sepia(51%)'
    }

    reposition();

    voronoiMap.setIntrachromosomeView(intrachromosomeView);
    imageMap.setIntrachromosomeView(intrachromosomeView);


    // Perform search again to ensure the IGV browsers are updated to the correct size
    bottomBrowser.search(lastLocus.chr + ":" + lastLocus.start + "-" + lastLocus.end);
    rightBrowser.search(lastLocus.chr + ":" + lastLocus.start + "-" + lastLocus.end);
})

let saveSVGButton = <HTMLInputElement>document.getElementById('saveSVGButton');
saveSVGButton.addEventListener('click', (event) => {
    exportToImage(true);
})

let savePNGButton = <HTMLInputElement>document.getElementById('savePNGButton');
savePNGButton.addEventListener('click', (event) => {
    exportToImage(false);
})

function exportToImage(drawSVG: boolean): void {
    let downloadCanvas = <HTMLCanvasElement>document.getElementById('downloadCanvas');
    voronoiMap.redraw();

    let trackSizesBelow = 0;
    let trackSizesRight = 0;

    console.log(bottomBrowser)
    bottomBrowser.trackViews.forEach((trackView: igv.TrackView) => {
        console.log(trackView.viewports[0])
        if (trackView.viewports[0].canvas) {
            trackSizesBelow += trackView.viewports[0].canvas.height;
        }
    })

    rightBrowser.trackViews.forEach((trackView: igv.TrackView) => {
        console.log(trackView.viewports[0])
        if (trackView.viewports[0].canvas) {
            trackSizesRight += trackView.viewports[0].canvas.height;
        }
    })

    downloadCanvas.width = voronoiMap.canvas.width + trackSizesRight;
    downloadCanvas.height = voronoiMap.canvas.height + trackSizesBelow;

    if (!drawSVG) {
        let downloadCanvasCTX = <CanvasRenderingContext2D>downloadCanvas.getContext("2d");

        downloadCanvasCTX.drawImage(voronoiMap.canvas, 0, 0);

        let lastY = voronoiMap.canvas.height;

        console.log("DRAWING!!")
        
        bottomBrowser.trackViews.forEach((trackView: igv.TrackView) => {
            const visibleViewports = trackView.viewports.filter(vp => vp.isVisible())


            visibleViewports.forEach((viewport) => {
                const viewportHeight = <number>viewport.$viewport.height()
                console.log(viewport.referenceFrame)

                lastY += 50
                
                downloadCanvasCTX.save();
                downloadCanvasCTX.translate(0, lastY);
                viewport.trackView.track.draw({ 
                    context: downloadCanvasCTX, 
                    referenceFrame: viewport.referenceFrame, 
                    pixelTop: Math.max(0, -(viewport.$content.position().top) - viewportHeight),
                    bpStart: 0,
                    bpEnd: 10000,
                    bpPerPixel: 100,
                    pixelWidth: viewport.$viewport.width(),
                    pixelHeight: viewport.$viewport.height(),
                    viewport: viewport,
                    viewportWidth: viewport.$viewport.width()})
                downloadCanvasCTX.restore();
            })
            //trackView.track.draw()
           /* let trackCanvas = trackView.viewports[0].canvas

            if (trackCanvas && trackCanvas.width > 0) {
                let canvasXOffset = 0;

                if (trackCanvas.style.left != "") {
                    canvasXOffset = -parseInt(trackCanvas.style.left.replace("px", ""))
                }

                downloadCanvasCTX.drawImage(trackCanvas, canvasXOffset, 0, voronoiMap.axisWidth, trackCanvas.height, voronoiMap.axisOffsetX, lastY, voronoiMap.axisWidth, trackCanvas.height);
                lastY += trackView.viewports[0].canvas.height;
            }*/
        })

        let lastX = voronoiMap.canvas.width;
        rightBrowser.trackViews.forEach((trackView: igv.TrackView) => {
            let trackCanvas = trackView.viewports[0].canvas

            if (trackCanvas && trackCanvas.width > 0) {
                let canvasXOffset = 0;

                if (trackCanvas.style.left != "") {
                    canvasXOffset = -parseInt(trackCanvas.style.left.replace("px", ""))
                }
                downloadCanvasCTX.save();
                downloadCanvasCTX.translate(lastX, voronoiMap.canvas.height - voronoiMap.axisOffsetY);
                downloadCanvasCTX.rotate(270 * Math.PI / 180);
                downloadCanvasCTX.drawImage(trackCanvas, canvasXOffset, 0, voronoiMap.axisWidth, trackCanvas.height, 0, 0, voronoiMap.axisWidth, trackCanvas.height);
                downloadCanvasCTX.restore();
                lastX += trackView.viewports[0].canvas.height;
            }
        })

        var link = <HTMLAnchorElement>document.getElementById('link');
        link.setAttribute('download', 'voronoiImage.png');
        link.setAttribute('href', downloadCanvas.toDataURL("image/png").replace("image/png", "image/octet-stream"));
        link.click();
    } else {
        const multiLocusGapDivWidth = 1
        const multiLocusGapMarginWidth = 2

        const multiLocusGapWidth = (2 * multiLocusGapMarginWidth) + multiLocusGapDivWidth

        let downloadCanvasCTX = new SVGContext(
            {

                width: downloadCanvas.width,
                height: downloadCanvas.height,

                backdropColor: 'white',

                multiLocusGap: multiLocusGapWidth,
                pixelWidth: 2,
                viewbox:
                {
                    x: 0,
                    y: 0,
                    width: downloadCanvas.width,
                    height: downloadCanvas.height
                }

            });

        downloadCanvasCTX.save()
        downloadCanvasCTX.lineWidth = 0.25
        if (intrachromosomeView) {
            downloadCanvasCTX.translate(voronoiMap.axisWidth / 2 + voronoiMap.axisOffsetX, -voronoiMap.axisOffsetY)
            downloadCanvasCTX.rotate(45 * Math.PI / 180)
            downloadCanvasCTX.scale(1 / Math.sqrt(2), 1 / Math.sqrt(2))
            downloadCanvasCTX.imageSmoothingEnabled = true;
            voronoiMap.drawVoronoi(downloadCanvasCTX, voronoiMap.axisOffsetX, voronoiMap.axisOffsetY, voronoiMap.axisWidth, voronoiMap.axisWidth, true, true)
        } else {
            downloadCanvasCTX.imageSmoothingEnabled = false;
            voronoiMap.drawVoronoi(downloadCanvasCTX, voronoiMap.axisOffsetX, voronoiMap.axisOffsetY, voronoiMap.axisWidth, voronoiMap.axisHeight, true, false)
        }
        downloadCanvasCTX.restore()
        voronoiMap.drawTicks(downloadCanvasCTX)

        // Resize the browser so that the ticks display nicely
        //let tempWidth = voronoiMap.axisWidth * 1.25
        //resizeIGVElements(tempWidth);

        var mySerializedSVG = downloadCanvasCTX.getSerializedSvg(true);
        var parser = new DOMParser();
        var voronoiElement = parser.parseFromString(mySerializedSVG, "image/svg+xml");

        let bottomBrowserSVG = bottomBrowser.toSVG()
        var bottomBrowserElement = parser.parseFromString(bottomBrowserSVG, "image/svg+xml");

        // Specify the transformation first so that the definitions are created
        bottomBrowserElement.documentElement.setAttribute('transform', "translate(" + voronoiMap.axisOffsetX + " " + voronoiMap.canvas.height + ")")
        mergeSVG(voronoiElement, bottomBrowserElement, "translate(" + voronoiMap.axisOffsetX + " " + voronoiMap.canvas.height + ")")

        if (!intrachromosomeView) {
            // Have to remove the CSS rotation, otherwise SVG export produces odd results
            (<HTMLDivElement>document.getElementById('gene-browser-right')).classList.remove("rotated");
            let rightBrowserSVG = rightBrowser.toSVG();
            (<HTMLDivElement>document.getElementById('gene-browser-right')).classList.add("rotated");
            var rightBrowserDocument = parser.parseFromString(rightBrowserSVG, "image/svg+xml");

            // Specify the transformation first so that the definitions are created
            //rightBrowserDocument.documentElement.setAttribute('viewport', '')
            rightBrowserDocument.documentElement.setAttribute('transform', "translate(" + voronoiMap.canvas.width + " " + (voronoiMap.canvas.height - voronoiMap.axisOffsetY) + ") rotate(-90)")
            mergeSVG(voronoiElement, rightBrowserDocument, "translate(" + voronoiMap.canvas.width + " " + (voronoiMap.canvas.height - voronoiMap.axisOffsetY) + ") rotate(-90)")
        }

        resizeIGVElements(voronoiMap.axisWidth);

        var s = new XMLSerializer();
        mySerializedSVG = s.serializeToString(voronoiElement.documentElement)

        var link = <HTMLAnchorElement>document.getElementById('link');
        link.setAttribute('download', 'voronoiImage.svg');
        link.setAttribute('href', "data:image/svg+xml;charset=utf-8," + encodeURIComponent(mySerializedSVG));
        link.click();
    }
}

let numProcessedSVGs = 1;

function mergeSVG(mainDocument: Document, browserDocument: Document, transform: string) { //clipWidth: number, 
    let mainDefs = mainDocument.getElementsByTagName('defs')[0];
    let browserDefs = browserDocument.getElementsByTagName('defs')[0];

    // Copy over all new definitions to the main document
    for (let defIndex = 0; defIndex < browserDefs.children.length; defIndex++) {
        let curDef = browserDefs.children[defIndex];

        if (curDef && !mainDocument.getElementById(curDef.id)) {
            mainDefs.appendChild(curDef)
        }
    }

    // Copy over the root group to the main document
    let groupElement = <HTMLElement>browserDocument.getElementById('root-group');

    // Update the name of the element so that it remains unique in new document
    groupElement.id = groupElement + "-" + numProcessedSVGs
    numProcessedSVGs += 1

    // Set the specified transformation for the group being added
    groupElement.setAttribute('transform', transform)

    mainDocument.documentElement.appendChild(groupElement)
}


function renderSVGAxis(context: SVGContext, track: igv.ITrack, axisCanvas: HTMLCanvasElement, deltaX: number, deltaY: number) {
    console.log(track)
    if (typeof track.paintAxis === 'function') {

        const { y, width, height } = axisCanvas.getBoundingClientRect()

        const str = track.name || track.id
        if (str) {
            context.addTrackGroupWithTranslationAndClipRect((`${str.replace(/\\W/g, '')}_axis`), deltaX, y + deltaY, width, height, 0)

            context.save()
            track.paintAxis(context, width, height)
            context.restore()
        }
    }

}

function reposition() {
    if(!imageMap) {
        return
    }
    // TODO: Only reposition maximum once every 50 ms as this requires loading data (voronoi)

    let navBarDiv = <HTMLDivElement>document.getElementById('menubar-div');

    let imageCanvasDiv = <HTMLDivElement>document.getElementById('image-canvas-div');
    let voronoiCanvasDiv = <HTMLDivElement>document.getElementById('voronoi-canvas-div');
    let voronoiColourControls = <HTMLDivElement>document.getElementById('voronoi-colour-controls')
    let geneBrowserBelow = <HTMLDivElement>document.getElementById('gene-browser-below');
    let geneBrowserRight = <HTMLDivElement>document.getElementById('gene-browser-right');
    let numDisplayedViews = 1

    if (displayImageMap) {
        imageCanvasDiv.style.display = 'block'
        numDisplayedViews += 1
    } else {
        imageCanvasDiv.style.display = 'none'
    }

    let startTop = 0;

    if (displayColourControls) {
        startTop += 100
    }

    let maxWidth = window.innerWidth - navBarDiv.clientWidth;
    let maxHeight = window.innerHeight - startTop;

    if (!intrachromosomeView) {
        maxWidth -= igvHeight;
    } else {
        maxWidth -= 20 * (3 - numDisplayedViews);
    }
    maxHeight -= igvHeight;

    if (intrachromosomeView) {
        viewWidth = maxWidth / numDisplayedViews;
        viewHeight = viewWidth / 2;
    } else {
        viewWidth = Math.min(maxHeight, maxWidth);
        viewHeight = viewWidth
    }

    imageCanvasDiv.style.top = startTop + "px"
    imageCanvasDiv.style.left = (navBarDiv.clientWidth) + "px";
    imageMap.setDimensions(viewWidth, viewHeight)
    imageMap.redraw();

    geneBrowserBelow.style.top = startTop + viewHeight + "px";
    geneBrowserBelow.style.left = navBarDiv.clientWidth + (imageMap.axisOffsetX - 10) + (viewWidth * (numDisplayedViews - 1)) + "px";
    geneBrowserBelow.style.width = imageMap.axisWidth + "px"

    if (intrachromosomeView) {
        geneBrowserRight.style.display = "none";
    } else {
        geneBrowserRight.style.display = "block";
        geneBrowserRight.style.top = (startTop + viewHeight - (imageMap.axisOffsetX - 10)) + "px";
        geneBrowserRight.style.left = navBarDiv.clientWidth + (viewWidth * numDisplayedViews) + "px";
    }

    voronoiCanvasDiv.style.top = startTop + "px"
    voronoiCanvasDiv.style.left = navBarDiv.clientWidth + (viewWidth * (numDisplayedViews - 1)) + "px";
    voronoiColourControls.style.left = voronoiCanvasDiv.style.left
    voronoiMap.setDimensions(viewWidth, viewHeight)
    voronoiMap.redraw();


    let hideButton = <HTMLInputElement>document.getElementById('hideButton');
    hideButton.style.top = viewHeight + "px";
    hideButton.style.left = navBarDiv.clientWidth + "px";

    //let controls = <HTMLDivElement>document.getElementById('controls');
    //controls.style.top = (viewHeight + 50) + "px";
    //controls.style.left = navBarDiv.clientWidth + "px";

    let voronoiControls = <HTMLDivElement>document.getElementById('voronoi-controls');
    voronoiControls.style.left = Math.max(voronoiMap.axisOffsetX, viewWidth - 250) + "px";
    let imageControls = <HTMLDivElement>document.getElementById('image-controls');
    imageControls.style.left = Math.max(imageMap.axisOffsetX, viewWidth - 250) + "px";


    // let geneBrowsers = <HTMLCollectionOf<HTMLDivElement>>document.getElementsByClassName('gene-browser');
    // for (let geneBrowser of geneBrowsers) {
    //     //geneBrowser.style.width = (imageMap.axisWidth) + "px";
    // }


    resizeIGVElements(voronoiMap.axisWidth);


    //bottomBrowser.updateViews()

}

function resizeIGVElements(size: number) {
    let igvRootDivs = <HTMLCollectionOf<HTMLDivElement>>document.getElementsByClassName('igv-root-div');
    for (let rootDiv of igvRootDivs) {
        rootDiv.style.width = (size) + "px";
    }

    let viewports = <HTMLCollectionOf<HTMLDivElement>>document.getElementsByClassName('igv-viewport');
    for (let viewport of viewports) {
        viewport.style.width = (size) + "px";
    }

    let tracks = <HTMLCollectionOf<HTMLDivElement>>document.getElementsByClassName('igv-track');
    for (let track of tracks) {
        track.style.width = (size) + "px";
    }

    //let canvases = <HTMLCollectionOf<HTMLCanvasElement>>document.getElementsByClassName('igv-canvas');
    //for (let canvas of canvases) {
    //    canvas.style.width = (imageMap.axisWidth) + "px";
    //}

    let navBars = <HTMLCollectionOf<HTMLDivElement>>document.getElementsByClassName('igv-navbar');
    for (let navBar of navBars) {
        navBar.style.width = (size + 40) + "px";
    }

    let zoomWidgets = <HTMLCollectionOf<HTMLDivElement>>document.getElementsByClassName('igv-zoom-widget-900')
    for (let zoomWidget of zoomWidgets) {
        zoomWidget.style.marginRight = 5 + "px";
    }

    for (let trackView of bottomBrowser.trackViews) {
        trackView.updateViews(true);
    }
    for (let trackView of rightBrowser.trackViews) {
        trackView.updateViews(true);
    }
}


interface ViewRequest {
    dimension: "x" | "y"
    locus: Locus

    //    callback?: Function
}

var xRequest: ViewRequest | null
var yRequest: ViewRequest | null
var timeoutFunction: any;
var redrawTimeoutFunction: any;

interface MinMax {
    Min: number
    Max: number
}

function polygonArea(polygon: any) {
    let points = polygon['Points']
    let area = 0;   // Accumulates area 
    let j = 0;

    for (let i = 2; i < points.length; i += 2) {
        //area += (polygon[j][0]+polygon[i][0]) * (polygon[j][1]+polygon[i][1]); 
        var crossProduct = polygon[j + 0] * polygon[i + 1] - polygon[j + 1] * polygon[i + 0];
        area += crossProduct;
        j = i;  //j is previous vertex to i
    }
    return area / 2;
}

function getMinMaxArea(voronoi: Voronoi): MinMax {
    var minMax: MinMax = { Min: -1, Max: -1 };


    let maxIndex = 0;

    for (let i = 0; i < voronoi.polygons.length; i++) {
        //let centroid = voronoi.polygons[i]['DataPoint']
        //if (polygons[i]['Clipped'] || centroid[0] > voronoiMap.getVoronoiDrawWidth() || centroid[1] > voronoiMap.getVoronoiDrawHeight()) {
        //    continue;
        //}
        if (voronoi.polygons[i].clipped) {
            continue;
        }

        let area = Math.log(voronoi.polygons[i].area)

        if (minMax.Min == -1 || area < minMax.Min) {
            minMax.Min = area
        }
        if (minMax.Max == -1 || area > minMax.Max) {
            maxIndex = i
            minMax.Max = area
        }
    }

    return minMax
}

function binAreas(voronoi: Voronoi, binWidth: number, numBins: number, minMaxArea: MinMax): Uint32Array {
    let areaBins = new Uint32Array(numBins);
    for (let i = 0; i < areaBins.length; i++) {
        areaBins[i] = 0
    }

    for (let i = 0; i < voronoi.polygons.length; i++) {
        //let centroid = voronoi.polygons[i]['DataPoint']
        //if (voronoi.polygons[i]['Clipped'] || centroid[0] > voronoiMap.getVoronoiDrawWidth() || centroid[1] > voronoiMap.getVoronoiDrawHeight()) {
        //    continue;
        //}
        if (voronoi.polygons[i].clipped) {
            continue;
        }

        let areaBin = Math.round((Math.log(voronoi.polygons[i].area) - minMaxArea.Min) / binWidth)
        areaBins[areaBin]++
    }


    return areaBins
}

function getLocusFromBrowser(browser: igv.Browser): Locus {
    let value = browser.$searchInput.val();
    if (value) {
        let searchValue = <string>value.toString();
        let parts = searchValue.split(':');
        let chrParts = parts[1].split('-');

        return { chr: parts[0], start: parseInt(chrParts[0].replaceAll(',', '')), end: parseInt(chrParts[1].replaceAll(',', '')) };
    }

    return { chr: "", start: 0, end: 0 }
}

function requestViewUpdate(request: ViewRequest) {
    if (request.dimension == "x") {
        xRequest = request;

        //        if(xRequest.callback) {
        //            xRequest.callback();
        //        }
    } else if (request.dimension == "y") {
        yRequest = request;

        //        if(yRequest.callback) {
        //            yRequest.callback();
        //        }
    }

    clearTimeout(timeoutFunction);

    timeoutFunction = setTimeout(() => {
        // Update view if no new requests in last 50 ms

        if (xRequest && yRequest) {
            let newSourceChrom = getChromosomeFromMap(chromosomes, xRequest.locus.chr)
            var newTargetChrom: Chromosome

            let startX = xRequest.locus.start
            let endX = xRequest.locus.end

            var startY: number
            var endY: number

            if (intrachromosomeView) {
                newTargetChrom = newSourceChrom
                startY = startX
                endY = endX
            } else {
                newTargetChrom = getChromosomeFromMap(chromosomes, yRequest.locus.chr)
                startY = yRequest.locus.start
                endY = yRequest.locus.end
            }

            if (startX < 0) {
                startX = 0;
            }
            if (startY < 0) {
                startY = 0;
            }

            if (isNaN(startY) || isNaN(endY)) {
                startY = startX
                endY = endX
            }

            if (sourceChrom != newSourceChrom || targetChrom != newTargetChrom) {
                startX = 0
                endX = newSourceChrom.length
                sourceChrom = newSourceChrom

                startY = 0
                endY = newTargetChrom.length
                targetChrom = newTargetChrom
            }

            lastLocus.chr = xRequest.locus.chr;
            lastLocus.start = startX;
            lastLocus.end = endX;

            // Update the URL to reflect the current view
            let nextURL = window.location.href.split('?')[0] + "?srcChrom=" + sourceChrom.name + "&srcStart=" + startX + "&srcEnd=" + endX + "&tarChrom=" + targetChrom.name + "&tarStart=" + startY + "&tarEnd=" + endY + "&triangleView=" + intrachromosomeView
            window.history.pushState({}, sourceChrom.nameWithChr() + ":" + startX + "-" + endX + " x " + targetChrom + ":" + startY + "-" + endY, nextURL);

            voronoiMap.setChromPair(sourceChrom, targetChrom);
            voronoiMap.updateViewLimits(startX, endX, startY, endY);
            imageMap.setChromPair(sourceChrom, targetChrom);
            imageMap.updateViewLimits(startX, endX, startY, endY);
            //
            fetch('./voronoiandimage?pixelsX=' + voronoiMap.getVoronoiDrawWidth() + '&pixelsY=' + voronoiMap.getVoronoiDrawHeight() + '&smoothingIterations=' + voronoiMap.smoothingRepetitions + '&numBins=' + imageMap.numBins + '&sourceChrom=' + sourceChrom.name + '&targetChrom=' + targetChrom.name + '&xStart=' + startX + '&xEnd=' + endX + '&yStart=' + startY + '&yEnd=' + endY)
                .then(
                    (response) => {
                        if (response.status !== 200) {
                            console.log('Looks like there was a problem. Status Code: ' +
                                response.status);
                            return;
                        }

                        response.arrayBuffer().then((buffer: ArrayBuffer) => {
                            if(interactions) {
                                interactions.forEach((interactionMap, name, map) => {
                                    let interactionSet = interactionMap.get(sourceChrom.nameWithChr() + "-" + targetChrom.nameWithChr())

                                    if (interactionSet) {
                                        imageMap.setInteractions(name, interactionSet);
                                        voronoiMap.setInteractions(name, interactionSet);
                                    } else {
                                        imageMap.setInteractions(name, []);
                                        voronoiMap.setInteractions(name, []);
                                    }

                                })
                            }

                            let dataView = new DataView(buffer);
                            let offset = 0;
                            let numBinsImage = dataView.getUint32(offset);
                            offset += 4;

                            let imageSize = numBinsImage * numBinsImage;
                            let overviewImage = new Uint32Array(imageSize);

                            for (let i = 0; i < imageSize; i++) {
                                overviewImage[i] = dataView.getUint32(offset);
                                offset += 4;
                            }
                            imageMap.updateFromArray(overviewImage);

                            // TODO: Create voronoi representation from binary data
                            let vor = new Voronoi();

                            let numPolygons = dataView.getUint32(offset);
                            offset += 4;
                            for (let i = 0; i < numPolygons; i++) {
                                let polygon = new Polygon();
                                let numPoints = dataView.getUint32(offset);
                                offset += 4;

                                polygon.area = dataView.getFloat64(offset);
                                offset += 8;

                                //polygon.logArea = Math.log(polygon.area)

                                polygon.clipped = dataView.getUint8(offset) == 1;
                                offset += 1

                                polygon.dataPoint = new Point(dataView.getFloat64(offset), dataView.getFloat64(offset + 8))
                                offset += 16;

                                polygon.centroid = new Point(dataView.getFloat64(offset), dataView.getFloat64(offset + 8))
                                offset += 16;

                                for (let j = 0; j < numPoints; j++) {
                                    polygon.points.push(new Point(dataView.getFloat64(offset), dataView.getFloat64(offset + 8)))
                                    offset += 16;
                                }

                                vor.polygons.push(polygon)
                            }

                            minMaxArea = getMinMaxArea(vor);

                            let colourCanvas = <HTMLCanvasElement>document.getElementById('voronoi-colour');
                            colourCanvas.width = imageMap.canvas.width;
                            let colourCanvasCTX = <CanvasRenderingContext2D>colourCanvas.getContext("2d");
                            let histogramY = colourCanvas.height - 10
                            let numBins = colourCanvas.width


                            let maxBin = 0

                            let binWidth = (minMaxArea.Max - minMaxArea.Min) / (numBins)
                            let areaBins = binAreas(vor, binWidth, numBins, minMaxArea);

                            for (let i = 0; i < areaBins.length; i++) {
                                if (areaBins[i] > maxBin) {
                                    maxBin = areaBins[i]
                                }
                            }

                            let lastMin = voronoiMap.colourMinArea;
                            let lastMax = voronoiMap.colourMaxArea;

                            voronoiMap.scale = d3.scaleQuantize()
                                .range(d3.range(voronoiMap.colours))
                                .domain([minMaxArea.Min, minMaxArea.Max]);

                            if (lastMin != -1 && lastMax != -1) {
                                voronoiMap.setColourRange(lastMin, lastMax);
                            }

                            for (let i = 0; i < numBins; i++) {
                                colourCanvasCTX.strokeStyle = 'rgb(0, 0, 0)'
                                colourCanvasCTX.beginPath();
                                colourCanvasCTX.moveTo(i, histogramY);
                                colourCanvasCTX.lineTo(i, histogramY - (Math.log(areaBins[i]) / Math.log(maxBin) * histogramY))
                                //colourCanvasCTX.lineTo(i, histogramY - (areaBins[i] / maxBin * colourCanvas.height))
                                colourCanvasCTX.stroke();

                                colourCanvasCTX.strokeStyle = voronoiMap.colourScale(voronoiMap.scale(binWidth * i + minMaxArea.Min))
                                colourCanvasCTX.beginPath();
                                colourCanvasCTX.moveTo(i, colourCanvas.height);
                                colourCanvasCTX.lineTo(i, histogramY)
                                colourCanvasCTX.stroke();
                            }

                            let [minScale, maxScale] = voronoiMap.scale.domain();

                            colourCanvasCTX.strokeStyle = 'rgb(0, 0, 0)'
                            let minScaleX = (minScale - minMaxArea.Min) / binWidth
                            colourCanvasCTX.beginPath();
                            colourCanvasCTX.moveTo(minScaleX, histogramY);
                            colourCanvasCTX.lineTo(minScaleX - 5, colourCanvas.height);
                            colourCanvasCTX.lineTo(minScaleX + 5, colourCanvas.height);
                            colourCanvasCTX.fill();
                            let maxScaleX = (maxScale - minMaxArea.Min) / binWidth
                            colourCanvasCTX.beginPath();
                            colourCanvasCTX.moveTo(maxScaleX, histogramY);
                            colourCanvasCTX.lineTo(maxScaleX - 5, colourCanvas.height);
                            colourCanvasCTX.lineTo(maxScaleX + 5, colourCanvas.height);
                            colourCanvasCTX.fill();

                            voronoiMap.setVoronoi(vor);
                        })
                    });

            //imageMap.requestView(sourceChrom, targetChrom, startX, endX, startY, endY)
            //voronoiMap.requestView(sourceChrom, targetChrom, startX, endX, startY, endY)
        }

        clearTimeout(timeoutFunction);
    }, 50);
}


//Mousedown
var minMaxArea: MinMax
let colourCanvas = <HTMLCanvasElement>document.getElementById('voronoi-colour');
colourCanvas.oncontextmenu = function (e) { e.preventDefault(); e.stopPropagation(); }
colourCanvas.addEventListener('mousedown', function (event: MouseEvent) {
    let colourCanvas = <HTMLCanvasElement>document.getElementById('voronoi-colour');
    let colourCanvasCTX = <CanvasRenderingContext2D>colourCanvas.getContext("2d");

    let numBins = colourCanvas.width
    let histogramY = colourCanvas.height - 10
    let binWidth = (minMaxArea.Max - minMaxArea.Min) / (numBins)

    // Clear the colour bar region
    colourCanvasCTX.clearRect(0, histogramY, colourCanvas.width, colourCanvas.height)

    var rect = colourCanvas.getBoundingClientRect();
    let x = event.clientX - rect.left
    let y = event.clientY - rect.top

    let [minScale, maxScale] = voronoiMap.scale.domain();

    if (event.button == 0) {
        //voronoiMap.scale.domain([binWidth * x + minMaxArea.Min, maxScale]);
        voronoiMap.setColourRange(binWidth * x + minMaxArea.Min, maxScale);
    } else {
        //voronoiMap.scale.domain([minScale, binWidth * x + minMaxArea.Min]);
        voronoiMap.setColourRange(minScale, binWidth * x + minMaxArea.Min);
    }

    [minScale, maxScale] = voronoiMap.scale.domain();

    for (let i = 0; i < numBins; i++) {
        colourCanvasCTX.strokeStyle = voronoiMap.colourScale(voronoiMap.scale(binWidth * i + minMaxArea.Min))
        colourCanvasCTX.beginPath();
        colourCanvasCTX.moveTo(i, colourCanvas.height);
        colourCanvasCTX.lineTo(i, histogramY)
        colourCanvasCTX.stroke();
    }


    colourCanvasCTX.strokeStyle = 'rgb(0, 0, 0)'
    let minScaleX = (minScale - minMaxArea.Min) / binWidth
    colourCanvasCTX.beginPath();
    colourCanvasCTX.moveTo(minScaleX, histogramY);
    colourCanvasCTX.lineTo(minScaleX - 5, colourCanvas.height);
    colourCanvasCTX.lineTo(minScaleX + 5, colourCanvas.height);
    colourCanvasCTX.fill();
    let maxScaleX = (maxScale - minMaxArea.Min) / binWidth
    colourCanvasCTX.beginPath();
    colourCanvasCTX.moveTo(maxScaleX, histogramY);
    colourCanvasCTX.lineTo(maxScaleX - 5, colourCanvas.height);
    colourCanvasCTX.lineTo(maxScaleX + 5, colourCanvas.height);
    colourCanvasCTX.fill();


    voronoiMap.drawPolygonsCanvas();
});


window.addEventListener('resize', (event) => {
    reposition();
})


let fileSelector = <HTMLInputElement>document.getElementById('file-selector')
fileSelector.addEventListener('change', (event) => {
    if (fileSelector.files) {
        let data = new FormData();
        data.append('myFile', fileSelector.files[0]);

        let filename = fileSelector.files[0].name;

        // send fetch along with cookies
        fetch('/upload', {
            method: 'POST',
            credentials: 'same-origin',
            body: data
        }).then((response) => {
            if (response.status !== 200) {
                console.log('Looks like there was a problem. Status Code: ' +
                    response.status);
                return;
            }

            response.text().then((location: string) => {
                var tracksString = window.sessionStorage.getItem("loadedTracks");
                var tracks: UploadedTrack[]

                if (!tracksString) {
                    tracks = []
                } else {
                    tracks = JSON.parse(tracksString);
                }

                let newTrack: UploadedTrack = { filename: filename, location: location };
                tracks.push(newTrack);
                window.sessionStorage.setItem("loadedTracks", JSON.stringify(tracks));

                loadUploadedTrack(newTrack);
            });
        });


        /*const reader = new FileReader();
        
        } else if (extension?.localeCompare("bw") == 0) {
            type = 'wig'
            format = 'bigwig';
 
            // Need to copy the file to the server and then load a link
        }
 
 
        reader.readAsDataURL(fileSelector.files[0])*/
    }
});

interface TrackDetails {
    format: string
    name: string
    url: string
    indexURL: string
    order: number
    removable: boolean
    visibilityWindow: number
}

interface GenomeDetails {
    id: string
    name: string
    fastaURL: string
    indexURL: string
    cytobandURL: string

    tracks: TrackDetails[]
}

interface UploadedTrack {
    filename: string
    location: string
}




function loadUploadedTrack(uploadedTrack: UploadedTrack) {

    const extension = uploadedTrack.filename.split('.').pop();
    console.log(extension);
    var format: string = 'unknown'
    var type: 'annotation' | 'wig' | 'alignment' | 'variant' | 'seg' = 'annotation'
    if (extension?.localeCompare("bed") == 0) {
        type = 'annotation';
        format = 'bed';
    } else if (extension?.localeCompare("bw") == 0) {
        type = 'wig';
        format = 'bigwig';
    }

    bottomBrowser.loadTrack({
        type: type,
        format: format,
        url: uploadedTrack.location,
        name: uploadedTrack.filename
    }).then(track => {
        resizeIGVElements(voronoiMap.axisWidth)
    })
    rightBrowser.loadTrack({
        type: type,
        format: format,
        //sourceType: "file",
        url: uploadedTrack.location,
        name: uploadedTrack.filename
    }).then(track => {
        resizeIGVElements(voronoiMap.axisWidth)
    })
}

function getGenomeDetails(genome: string): GenomeDetails | undefined {
    return genomes.get(genome)
    // switch(genome) {
    //     case "dm6":
    //         return {fastaURL: "https://s3.amazonaws.com/igv.broadinstitute.org/genomes/seq/dm6/dm6.fa", indexURL: "https://s3.amazonaws.com/igv.broadinstitute.org/genomes/seq/dm6/dm6.fa.fai"}
    //     case "hg19":
    //         return {fastaURL: "https://s3.amazonaws.com/igv.broadinstitute.org/genomes/seq/hg19/hg19.fasta", indexURL: "https://s3.amazonaws.com/igv.broadinstitute.org/genomes/seq/hg19/hg19.fasta.fai"}
    //     case "hg38":
    //         return {fastaURL: "https://s3.amazonaws.com/igv.broadinstitute.org/genomes/seq/hg38/hg38.fa", indexURL: "https://s3.amazonaws.com/igv.broadinstitute.org/genomes/seq/hg38/hg38.fa.fai"}
    // }
    // // TODO: Unknown genome - should ask the user for the fasta files?

    // // Try a default
    // return {fastaURL: "https://s3.amazonaws.com/igv.broadinstitute.org/genomes/seq/" + genome + "/" + genome + ".fa", indexURL: "https://s3.amazonaws.com/igv.broadinstitute.org/genomes/seq/" + genome + "/" + genome + ".fa.fai"}
}


var genomes: Map<string, GenomeDetails> = new Map();

// Get genome information from server
fetch('./genomes.json').then((response) => {
    if (response.status !== 200) {
        console.log('Looks like there was a problem. Status Code: ' +
            response.status);
        return;
    }

    response.json().then(genomeDetails => {
        for (let i = 0; i < genomeDetails.length; i++) {
            var genome: GenomeDetails = {
                id: genomeDetails[i]['id'],
                name: genomeDetails[i]['name'],
                fastaURL: genomeDetails[i]['fastaURL'],
                indexURL: genomeDetails[i]['indexURL'],
                cytobandURL: genomeDetails[i]['cytobandURL'],

                tracks: [],
            }

            for (let j = 0; j < genomeDetails[i]['tracks'].length; j++) {
                var track: TrackDetails = {
                    format: genomeDetails[i]['tracks'][j]['format'],
                    name: genomeDetails[i]['tracks'][j]['name'],
                    url: genomeDetails[i]['tracks'][j]['url'],
                    indexURL: genomeDetails[i]['tracks'][j]['indexURL'],
                    order: genomeDetails[i]['tracks'][j]['order'],
                    removable: genomeDetails[i]['tracks'][j]['removable'],
                    visibilityWindow: genomeDetails[i]['tracks'][j]['visibilityWindow'],
                }

                genome.tracks.push(track)
            }

            genomes.set(genome.id, genome)
        }



        // First get the details of the chromosome from the server
        fetch('./details')
            .then(
                (response) => {
                    if (response.status !== 200) {
                        console.log('Looks like there was a problem. Status Code: ' +
                            response.status);
                        return;
                    }

                    response.json().then(details => {
                        var chromosomeDetails = details['Chromosomes'];
                        chromosomeDetails.forEach((chromosome: any) => {
                            chromosomes.set(chromosome['Name'], Chromosome.fromJSON(chromosome))
                        });

                        var locusBottom: string
                        var locusRight: string


                        const srcChrom = urlParams.get('srcChrom');
                        const tarChrom = urlParams.get('tarChrom');
                        const srcStart = urlParams.get('srcStart');
                        const srcEnd = urlParams.get('srcEnd');
                        const tarStart = urlParams.get('tarStart');
                        const tarEnd = urlParams.get('tarEnd');


                        if (srcChrom && srcStart && srcEnd && tarChrom && tarStart && tarEnd) {
                            sourceChrom = getChromosomeFromMap(chromosomes, srcChrom)
                            targetChrom = getChromosomeFromMap(chromosomes, tarChrom)

                            locusBottom = sourceChrom.name + ":" + srcStart + "-" + srcEnd;
                            locusRight = targetChrom.name + ":" + tarStart + "-" + tarEnd;
                        } else {
                            sourceChrom = getChromosomeFromMap(chromosomes, details['Chromosomes'][0]['Name'])
                            targetChrom = sourceChrom

                            locusBottom = sourceChrom.name + ":0-" + sourceChrom.length; //'chr4:0-1348131'
                            locusRight = locusBottom
                        }
                        console.log(locusBottom)

                        let genomeDetails = <GenomeDetails>getGenomeDetails(details['Genome']);
                        console.log(genomeDetails)

                        // Set up the options
                        const optionsBottom: igv.IIGVBrowserOptions = {
                            palette: ['#00A0B0', '#6A4A3C', '#CC333F', '#EB6841'],
                            locus: locusBottom,

                            reference: genomeDetails,
                        }
                        const optionsRight: igv.IIGVBrowserOptions = {
                            palette: ['#00A0B0', '#6A4A3C', '#CC333F', '#EB6841'],
                            locus: locusRight,

                            reference: genomeDetails,
                        }


                        function overrideMouse() {
                            //let trackContainer = $(rightBrowser.trackContainer);
                            //console.log(trackContainer)
                            //console.log(rightBrowser.$root)
                            //$(document).off('mousedown')
                            //$(document).off('mouseup')
                            rightBrowser.$root.off();
                            $(rightBrowser.trackContainer).off('mousemove').on('mousemove', (event) => {
                                console.log(event)
                                event.stopPropagation();
                            });
                            $(rightBrowser.trackContainer).off('mouseup').on('mouseup', (event) => {
                                console.log(event)
                                event.stopPropagation();
                            });
                            //trackContainer.off('mouseup');

                            rightBrowser.trackViews.forEach((track) => {
                                track.viewports.forEach((viewport) => {
                                    //console.log(viewport)

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

                                            //console.log(self.dragObject)

                                            self.vpMouseDown.lastMouseX = coords.x;
                                            self.vpMouseDown.lastMouseY = coords.y;
                                        }
                                    });

                                    viewport.trackView.$viewportContainer.on('mouseup', (event) => {
                                        console.log(event);
                                        event.stopPropagation();
                                    })

                                    //console.log("HERE")
                                    //console.log(viewport.$viewport)
                                    viewport.$viewport.off().on('mouseup', (event) => {
                                        //console.log("MOUSE UP" + event);
                                        event.stopPropagation();
                                    })

                                    /*console.log("Turning off $viewport")
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
                                    })*/
                                    //viewport.$viewport.off('mouseup');
                                })

                                /*console.log(track);
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
                                */
                            })
                        }



                        var promise: Promise<igv.Browser> = igv.createBrowser(<HTMLDivElement>document.getElementById('gene-browser-below'), optionsBottom);
                        promise.then(belowBrowser => {
                            bottomBrowser = belowBrowser;
                            // Override the method for updating search widget when resizing
                            bottomBrowser._updateLocusSearchWidget = bottomBrowser.updateLocusSearchWidget;
                            bottomBrowser.updateLocusSearchWidget = function (referenceFrameList: igv.ReferenceFrame[]): void {
                                bottomBrowser._updateLocusSearchWidget(referenceFrameList);

                                requestViewUpdate({ dimension: "x", locus: getLocusFromBrowser(bottomBrowser) })

                            }

                            var promise: Promise<igv.Browser> = igv.createBrowser(<HTMLDivElement>document.getElementById('gene-browser-right'), optionsRight);
                            promise.then(browser => {
                                rightBrowser = browser;
                                rightBrowser._updateLocusSearchWidget = rightBrowser.updateLocusSearchWidget;
                                rightBrowser.updateLocusSearchWidget = function (referenceFrameList: igv.ReferenceFrame[]): void {
                                    rightBrowser._updateLocusSearchWidget(referenceFrameList)

                                    requestViewUpdate({ dimension: "y", locus: getLocusFromBrowser(rightBrowser) })
                                }


                                belowBrowser.search(locusBottom);
                                rightBrowser.search(locusRight);

                                // Load existing tracks
                                var tracksString = window.sessionStorage.getItem("loadedTracks");
                                var tracks: UploadedTrack[]

                                if (!tracksString) {
                                    tracks = []
                                } else {
                                    tracks = JSON.parse(tracksString);
                                }

                                for (let i = 0; i < tracks.length; i++) {
                                    loadUploadedTrack(tracks[i])
                                }



                                // Override the events for controlling scrolling
                                overrideMouse();

                                //var HASH_PREFIX = "#/locus/";
                                //console.log(belowBrowser);
                                //belowBrowser.on('locuschange', function (referenceFrame: igv.ReferenceFrame) {
                                //console.log(referenceFrame)
                                //window.location.replace(HASH_PREFIX + referenceFrame.label);

                                //console.log(parseInt(referenceFrame.start.replace(',', '')))
                                //    voronoiMap.requestView(sourceChrom, targetChrom, parseInt(referenceFrame.start.replace(/,/g, '')), parseInt(referenceFrame.end.replace(/,/g, '')), voronoiMap.minViewY, voronoiMap.maxViewY)
                                //});
                                //rightBrowser.on('locuschange', (referenceFrame: igv.ReferenceFrame) => {
                                //    voronoiMap.requestView(sourceChrom, targetChrom, voronoiMap.minViewX, voronoiMap.maxViewX, parseInt(referenceFrame.start.replace(/,/g, '')), parseInt(referenceFrame.end.replace(/,/g, '')))
                                //});


                                /**/

                                let jQueryKeyName = Object.keys(belowBrowser.trackContainer)[0];
                                //let obj = belowBrowser.trackContainer.
                                //console.log(jQueryKeyName)
                                //console.log(Object.keys(belowBrowser.trackContainer));
                                //console.log(belowBrowser.trackContainer);
                                //console.log(belowBrowser.trackViews);

                                voronoiMap = new VoronoiPlot(belowBrowser, rightBrowser);
                                imageMap = new ImageMap(numBins, voronoiMap);

                                voronoiMap.setIntrachromosomeView(intrachromosomeView)
                                imageMap.setIntrachromosomeView(intrachromosomeView)

                                voronoiMap.addRegionSelectEventListener((region: Rectangle) => {
                                    belowBrowser.search(voronoiMap.sourceChrom.name + ":" + region.min.x + "-" + region.max.x);
                                    rightBrowser.search(voronoiMap.targetChrom.name + ":" + region.min.y + "-" + region.max.y);
                                })
                                voronoiMap.addDoubleClickEventListener(() => {
                                    belowBrowser.search(voronoiMap.sourceChrom.name + ":0-" + voronoiMap.sourceChrom.length);
                                    rightBrowser.search(voronoiMap.targetChrom.name + ":0-" + voronoiMap.targetChrom.length);
                                })
                                imageMap.addRegionSelectEventListener((region: Rectangle) => {
                                    belowBrowser.search(imageMap.sourceChrom.name + ":" + region.min.x + "-" + region.max.x);
                                    rightBrowser.search(imageMap.targetChrom.name + ":" + region.min.y + "-" + region.max.y);
                                })
                                imageMap.addDoubleClickEventListener(() => {
                                    belowBrowser.search(voronoiMap.sourceChrom.name + ":0-" + voronoiMap.sourceChrom.length);
                                    rightBrowser.search(voronoiMap.targetChrom.name + ":0-" + voronoiMap.targetChrom.length);
                                })

                                /*imageMap.setOnImageLoad((minX, maxX, minY, maxY) => {
                                    belowBrowser.search(sourceChrom.name + ":" + minX + "-" + maxX);
                                    rightBrowser.search(targetChrom.name + ":" + minY + "-" + maxY);
                                    //requestViewUpdate({dimension: "x", locus: {chr: sourceChrom.name, start: ""+minX, end: ""+maxX}})
                                    //requestViewUpdate({dimension: "y", locus: {chr: targetChrom.name, start: ""+minY, end: ""+maxY}})
                                    //belowBrowser.search(sourceChrom.name + ":" + minX + "-" + maxX).then(() => {
                                    //    rightBrowser.search(targetChrom.name + ":" + minY + "-" + maxY).then(() => {
                                    //        voronoiMap.requestView(sourceChrom, targetChrom, minX, maxX, minY, maxY);
                                    //    })
                                    //})
                                })*/
                                //imageMap.loadDensityImage(200, xStart, xEnd, yStart, yEnd, voronoiMap.loadDataForVoronoi);

                                imageMap.setChromPair(sourceChrom, targetChrom);

                                (<HTMLDivElement>document.getElementById('gene-browser-right')).classList.add("rotated");//.setAttribute("class", "rotated")

                                // Set up the options boxes
                                const imageGUI = new dat.GUI({ name: "Image Options", autoPlace: false });
                                //imageGUI.domElement.className = 'dgui main';
                                document.getElementById('image-controls')?.appendChild(imageGUI.domElement);
                                //document.getElementById('image-canvas-div')?.insertBefore(imageGUI.domElement, document.getElementById('image-canvas'));
                                imageGUI.add(imageMap, 'numBins').name('Number of bins').onChange((value) => {
                                    imageMap.setNumberBins(parseInt(value));
                                    requestViewUpdate({ dimension: "x", locus: getLocusFromBrowser(bottomBrowser) })
                                });
                                imageGUI.add(imageMap, 'percentile', 0, 1, 0.001).name('Percentile (threshold) ').onChange((value) => {
                                    imageMap.setPercentile(parseFloat(value));
                                });



                                // Set up the options for voronoi
                                const voronoiGUI = new dat.GUI({ name: "Voronoi Options", autoPlace: false });
                                console.log(document.getElementById('voronoi-canvas-div'))
                                document.getElementById('voronoi-controls')?.appendChild(voronoiGUI.domElement);

                                //voronoiGUI.add(voronoiMap, 'generateVoronoiOnServer').name("Server Voronoi")

                                voronoiGUI.add(voronoiMap, 'displayVoronoiEdges').name('Display edges').onChange((value) => {
                                    //voronoiMap.drawVoronoi();
                                    //voronoiMap.redraw();
                                    voronoiMap.drawPolygonsCanvas();
                                })
                                voronoiGUI.add(voronoiMap, 'displayVoronoiPoints').name('Display data').onChange((value) => {
                                    voronoiMap.drawPolygonsCanvas();
                                })
                                voronoiGUI.add(voronoiMap, 'displayCentroid').name('Display centroid').onChange((value) => {
                                    voronoiMap.drawPolygonsCanvas();
                                })

                                const smoothingMenu = voronoiGUI.addFolder('Smoothing');
                                smoothingMenu.add(voronoiMap, 'smoothingRepetitions', 0, 10, 1).name('Repetitions').onChange((value) => {
                                    requestViewUpdate({ dimension: "x", locus: getLocusFromBrowser(bottomBrowser) })
                                    requestViewUpdate({ dimension: "y", locus: getLocusFromBrowser(rightBrowser) })
                                    /*voronoiMap.calculateVoronoi();
                                    voronoiMap.drawVoronoi();
                                    voronoiMap.redraw();*/
                                })

                                /*smoothingMenu.add(voronoiMap, 'omega', 0, 2).name('Omega').onChange((value) => {
                                    voronoiMap.calculateVoronoi();
                                    voronoiMap.drawVoronoi();
                                    voronoiMap.redraw();
                                })*/


                                // Hide the menus
                                imageGUI.close();
                                voronoiGUI.close();

                                // Reposition the interface
                                reposition();

                                if (details['hasInteract']) {
                                    fetch('./interact').then((response) => {
                                        if (response.status !== 200) {
                                            console.log('Looks like there was a problem. Status Code: ' +
                                                response.status);
                                            return;
                                        }

                                        response.json().then(interactFiles => {

                                            for (const [name, interact] of Object.entries<any>(interactFiles)) {
                                                if (interact == null) {
                                                    continue
                                                }

                                                imageMap.addContactMenu(name, imageGUI);
                                                voronoiMap.addContactMenu(name, voronoiGUI);

                                                let serverInteractions = new Map<string, Interaction[]>();

                                                for (var chromPair in interact['Interactions']) {

                                                    var interactionArray: Interaction[] = [];
                                                    interact['Interactions'][chromPair].forEach((interaction: any) => {
                                                        interactionArray.push(Interaction.fromJSON(interaction, chromosomes));
                                                    });

                                                    serverInteractions.set(chromPair, interactionArray)
                                                }

                                                interactions.set(name, serverInteractions)
                                            }

                                            /*interact['Interactions'].forEach((interaction: any) => {
                                                imageMap.addContact(interaction['SourceStart'], interaction['TargetStart']);
                                                voronoiMap.addContact(interaction['SourceStart'], interaction['TargetStart']);
                                            });
        
                                            imageMap.redraw();
                                            voronoiMap.redraw();*/
                                        })
                                    });
                                }
                            });
                        });
                    });
                });

    })
});
//https://s3.amazonaws.com/igv.org.genomes/genomes.json




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
