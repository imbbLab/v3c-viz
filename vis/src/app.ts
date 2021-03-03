//import { Delaunay } from "d3-delaunay";
//import { createGzip } from "zlib";
import { ImageMap } from "./imageMap";
import { VoronoiPlot } from "./voronoiPlot";

import * as dat from 'dat.gui';

//import 'jquery-ui-dist/jquery-ui';
import * as igv from 'igv';
import * as igvutils from 'igv-utils';
import { Locus, Chromosome, Interaction } from "./chromosome";
import { Rectangle } from "./axis";


import * as d3 from 'd3';

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

var chromosomes: Map<string, Chromosome> = new Map();
var interactions: Map<string, Interaction[]> = new Map();
var sourceChrom: Chromosome;
var targetChrom: Chromosome;

var bottomBrowser: igv.IGVBrowser;
var rightBrowser: igv.IGVBrowser;

var displayImageMap = true;
var igvHeight = 230;
var viewWidth = 400;

let hideButton = <HTMLInputElement>document.getElementById('hideButton');
hideButton.addEventListener('click', (event) => {
    displayImageMap = !displayImageMap;

    if (!displayImageMap) {
        hideButton.value = 'Show'
    } else {
        hideButton.value = 'Hide'
    }

    reposition();
});

function reposition() {
    // TODO: Only reposition maximum once every 50 ms as this requires loading data (voronoi)

    let imageCanvasDiv = <HTMLDivElement>document.getElementById('image-canvas-div');
    let voronoiCanvasDiv = <HTMLDivElement>document.getElementById('voronoi-canvas-div');
    let geneBrowserBelow = <HTMLDivElement>document.getElementById('gene-browser-below');
    let geneBrowserRight = <HTMLDivElement>document.getElementById('gene-browser-right');
    let numDisplayedViews = 1

    if (displayImageMap) {
        imageCanvasDiv.style.display = 'block'
        numDisplayedViews += 1
    } else {
        imageCanvasDiv.style.display = 'none'
    }

    let maxWidth = window.innerWidth;
    let maxHeight = window.innerHeight;

    maxWidth -= igvHeight;
    maxHeight -= igvHeight;

    viewWidth = Math.min(maxHeight, maxWidth / numDisplayedViews);

    imageMap.setDimensions(viewWidth, viewWidth)
    imageMap.redraw();

    geneBrowserBelow.style.top = viewWidth + "px";
    geneBrowserBelow.style.left = (imageMap.axisOffsetX - 10) + (viewWidth * (numDisplayedViews - 1)) + "px";
    geneBrowserBelow.style.width = imageMap.axisWidth + "px"
    geneBrowserRight.style.top = (viewWidth - (imageMap.axisOffsetX - 10)) + "px";
    geneBrowserRight.style.left = (viewWidth * numDisplayedViews) + "px";

    voronoiCanvasDiv.style.left = (viewWidth * (numDisplayedViews - 1)) + "px";
    voronoiMap.setDimensions(viewWidth, viewWidth)
    voronoiMap.redraw();


    let hideButton = <HTMLInputElement>document.getElementById('hideButton');
    hideButton.style.top = viewWidth + "px";

    let controls = <HTMLDivElement>document.getElementById('controls');
    controls.style.top = (viewWidth + 50) + "px";

    let voronoiControls = <HTMLDivElement>document.getElementById('voronoi-controls');
    voronoiControls.style.left = Math.max(voronoiMap.axisOffsetX, viewWidth - 250) + "px";
    let imageControls = <HTMLDivElement>document.getElementById('image-controls');
    imageControls.style.left = Math.max(imageMap.axisOffsetX, viewWidth - 250) + "px";


    let geneBrowsers = <HTMLCollectionOf<HTMLDivElement>>document.getElementsByClassName('gene-browser');
    for (let geneBrowser of geneBrowsers) {
        //geneBrowser.style.width = (imageMap.axisWidth) + "px";
    }

    let igvRootDivs = <HTMLCollectionOf<HTMLDivElement>>document.getElementsByClassName('igv-root-div');
    for (let rootDiv of igvRootDivs) {
        rootDiv.style.width = (imageMap.axisWidth) + "px";
    }

    let viewports = <HTMLCollectionOf<HTMLDivElement>>document.getElementsByClassName('igv-viewport');
    for (let viewport of viewports) {
        viewport.style.width = (imageMap.axisWidth) + "px";
    }

    resizeTracks();

    let navBars = <HTMLCollectionOf<HTMLDivElement>>document.getElementsByClassName('igv-navbar');
    for (let navBar of navBars) {
        navBar.style.width = (viewWidth - 25) + "px";
    }

    let zoomWidgets = <HTMLCollectionOf<HTMLDivElement>>document.getElementsByClassName('igv-zoom-widget-900')
    for (let zoomWidget of zoomWidgets) {
        zoomWidget.style.marginRight = 5 + "px";
    }

}

function resizeTracks() {
    let tracks = <HTMLCollectionOf<HTMLDivElement>>document.getElementsByClassName('igv-track');
    for (let track of tracks) {
        track.style.width = (imageMap.axisWidth) + "px";
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
            let newSourceChrom = <Chromosome>chromosomes.get(xRequest.locus.chr)
            let newTargetChrom = <Chromosome>chromosomes.get(yRequest.locus.chr)

            let startX = parseInt(xRequest.locus.start)
            let endX = parseInt(xRequest.locus.initialEnd)

            let startY = parseInt(yRequest.locus.start)
            let endY = parseInt(yRequest.locus.initialEnd)

            if(startX < 0) {
                startX = 0;
            }
            if(startY < 0) {
                startY = 0;
            }

            if (sourceChrom != newSourceChrom || targetChrom != newTargetChrom) {
                startX = 0
                endX = newSourceChrom.length
                sourceChrom = newSourceChrom

                startY = 0
                endY = newTargetChrom.length
                targetChrom = newTargetChrom
            }

            voronoiMap.setChromPair(sourceChrom, targetChrom);
            voronoiMap.updateViewLimits(startX, endX, startY, endY);
            imageMap.setChromPair(sourceChrom, targetChrom);
            imageMap.updateViewLimits(startX, endX, startY, endY);

            let interactionSet = interactions.get(sourceChrom.name + "-" + targetChrom.name)
            if (interactionSet) {
                imageMap.setInteractions(interactionSet);
                voronoiMap.setInteractions(interactionSet);
            } else {
                imageMap.setInteractions([])
                voronoiMap.setInteractions([]);
            }

            fetch('./voronoiandimage?pixelsX=' + voronoiMap.getVoronoiDrawWidth() + '&pixelsY=' + voronoiMap.getVoronoiDrawHeight() + '&smoothingIterations=' + voronoiMap.smoothingRepetitions + '&numBins=' + imageMap.numBins + '&sourceChrom=' + sourceChrom.name + '&targetChrom=' + targetChrom.name + '&xStart=' + startX + '&xEnd=' + endX + '&yStart=' + startY + '&yEnd=' + endY)
                .then(
                    (response) => {
                        if (response.status !== 200) {
                            console.log('Looks like there was a problem. Status Code: ' +
                                response.status);
                            return;
                        }

                        response.json().then(data => {

                            // Update the colour

                            let polygons = data['Voronoi']['Polygons']
                            if(polygons) {
                                let colourCanvas = <HTMLCanvasElement>document.getElementById('voronoi-colour');
                                colourCanvas.width = imageMap.canvas.width;
                                let colourCanvasCTX = <CanvasRenderingContext2D>colourCanvas.getContext("2d");
                                let histogramY = colourCanvas.height - 10
                                let numBins = colourCanvas.width
                                let areaBins = new Uint32Array(numBins);

                                let minArea = -1;
                                let maxArea = -1;

                                for (let i = 0; i < polygons.length; i++) {
                                    let area = Math.log(polygons[i]['Area'])

                                    if(minArea == -1 || area < minArea) {
                                        minArea = area
                                    }
                                    if(maxArea == -1 || area > maxArea) {
                                        maxArea = area
                                    }
                                }

                                let binWidth = (maxArea - minArea) / (numBins-1)
                                let maxBin = 0

                                for (let i = 0; i < polygons.length; i++) {
                                    let areaBin = Math.round((Math.log(polygons[i]['Area']) - minArea) / binWidth)
                                    areaBins[areaBin]++

                                    if(areaBins[areaBin] > maxBin) {
                                        maxBin = areaBins[areaBin]
                                    }
                                }
                                
                                voronoiMap.scale = d3.scaleQuantize()
                                    .range(d3.range(voronoiMap.colours))
                                    .domain([minArea, maxArea]);
                                
                                for(let i = 0; i < numBins; i++) {
                                    colourCanvasCTX.strokeStyle = 'rgb(0, 0, 0)'
                                    colourCanvasCTX.beginPath();
                                    colourCanvasCTX.moveTo(i, histogramY);
                                    colourCanvasCTX.lineTo(i, histogramY - (areaBins[i] / maxBin * colourCanvas.height))
                                    colourCanvasCTX.stroke();

                                    colourCanvasCTX.strokeStyle = voronoiMap.colourScale(voronoiMap.scale(binWidth * i + minArea))
                                    colourCanvasCTX.beginPath();
                                    colourCanvasCTX.moveTo(i, colourCanvas.height);
                                    colourCanvasCTX.lineTo(i, histogramY)
                                    colourCanvasCTX.stroke();
                                }

                                //Mousedown
                                let processMin = true;
                                colourCanvas.oncontextmenu = function(e) { e.preventDefault(); e.stopPropagation(); }
                                colourCanvas.addEventListener('mousedown', function (event: MouseEvent) {
                                    let colourCanvas = <HTMLCanvasElement>document.getElementById('voronoi-colour');
                                    let colourCanvasCTX = <CanvasRenderingContext2D>colourCanvas.getContext("2d");
                                    colourCanvasCTX.clearRect(0, 0, colourCanvas.width, colourCanvas.height)

                                    var rect = colourCanvas.getBoundingClientRect();
                                    let x = event.clientX - rect.left
                                    let y = event.clientY - rect.top

                                    let [minScale, maxScale] = voronoiMap.scale.domain();
                                    
                                    if(event.button == 0) {
                                        voronoiMap.scale.domain([binWidth * x + minArea, maxScale]);
                                    } else {
                                        voronoiMap.scale.domain([minScale, binWidth * x + minArea]);
                                    } 

                                    for(let i = 0; i < numBins; i++) {
                                        colourCanvasCTX.strokeStyle = 'rgb(0, 0, 0)'
                                        colourCanvasCTX.beginPath();
                                        colourCanvasCTX.moveTo(i, histogramY);
                                        colourCanvasCTX.lineTo(i, histogramY - (areaBins[i] / maxBin * colourCanvas.height))
                                        colourCanvasCTX.stroke();
    
                                        colourCanvasCTX.strokeStyle = voronoiMap.colourScale(voronoiMap.scale(binWidth * i + minArea))
                                        colourCanvasCTX.beginPath();
                                        colourCanvasCTX.moveTo(i, colourCanvas.height);
                                        colourCanvasCTX.lineTo(i, histogramY)
                                        colourCanvasCTX.stroke();
                                    }

                                    processMin = !processMin;

                                    voronoiMap.redrawVoronoi();
                                });
                            }



                            let buf = Buffer.from(Uint8Array.from(atob(data['Image']), c => c.charCodeAt(0)));
                            imageMap.updateFromArray(new Uint32Array(buf.buffer, buf.byteOffset, buf.byteLength / Uint32Array.BYTES_PER_ELEMENT))
                            voronoiMap.updateFromJSON(data['Voronoi'])
                                
                        })
                    });

            //imageMap.requestView(sourceChrom, targetChrom, startX, endX, startY, endY)
            //voronoiMap.requestView(sourceChrom, targetChrom, startX, endX, startY, endY)
        }

        clearTimeout(timeoutFunction);
    }, 50);
}

window.addEventListener('resize', (event) => {
    reposition();
})

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
                console.log(details);

                //var sourceChromSelect = <HTMLSelectElement>document.getElementById('sourceChromSelect');
                //var targetChromSelect = <HTMLSelectElement>document.getElementById('targetChromSelect');
                // Clear all options 
                //var i, L = sourceChromSelect.options.length - 1;
                //for(i = L; i >= 0; i--) {
                //    sourceChromSelect.remove(i);
                //    targetChromSelect.remove(i);
                //}

                var chromosomeDetails = details['Chromosomes'];
                chromosomeDetails.forEach((chromosome: any) => {
                    //sourceChromSelect.options.add(new Option(chromosome['Name'], chromosome['Name']));
                    //targetChromSelect.options.add(new Option(chromosome['Name'], chromosome['Name']));

                    chromosomes.set(chromosome['Name'], Chromosome.fromJSON(chromosome))
                });
                /*sourceChromSelect.addEventListener("change", (event) => {
                    sourceChrom = <Chromosome>chromosomes.get(sourceChromSelect.value);

                    imageMap.setChromPair(sourceChrom, targetChrom)
                    let interactionSet = interactions.get(sourceChrom.name+"-"+targetChrom.name)
                    if(interactionSet) {
                        imageMap.setInteractions(interactionSet);
                    } else {
                        imageMap.setInteractions([])
                    }
                })
                targetChromSelect.addEventListener("change", (event) => {
                    targetChrom = <Chromosome>chromosomes.get(targetChromSelect.value);

                    imageMap.setChromPair(sourceChrom, targetChrom)
                    let interactionSet = interactions.get(sourceChrom.name+"-"+targetChrom.name)
                    if(interactionSet) {
                        imageMap.setInteractions(interactionSet);
                    } else {
                        imageMap.setInteractions([])
                    }
                })*/


                sourceChrom = <Chromosome>chromosomes.get(details['Chromosomes'][0]['Name'])
                targetChrom = sourceChrom

                const locus = sourceChrom.name + ":0-" + sourceChrom.length; //'chr4:0-1348131'

                // Set up the options
                const options: igv.IIGVBrowserOptions = {
                    palette: ['#00A0B0', '#6A4A3C', '#CC333F', '#EB6841'],
                    locus: locus,

                    reference: {
                        id: details['Genome'],
                        fastaURL: 'https://s3.amazonaws.com/igv.broadinstitute.org/genomes/seq/' + details['Genome'] + '/' + details['Genome'] + '.fa',
                        indexURL: 'https://s3.amazonaws.com/igv.broadinstitute.org/genomes/seq/' + details['Genome'] + '/' + details['Genome'] + '.fa.fai',
                        //cytobandURL: "https://s3.amazonaws.com/igv.org.genomes/dm6/cytoBandIdeo.txt.gz"
                    },

                    //trackDefaults: {
                    //  bam: {
                    //    coverageThreshold: 0.2,
                    //    coverageQualityWeight: true
                    //  }
                    //},

                    // tracks: [
                    //     {
                    //         "name": "Ensembl Genes",
                    //         "type": "annotation",
                    //         "format": "ensgene",
                    //         "displayMode": "EXPANDED",
                    //         "url": "https://s3.dualstack.us-east-1.amazonaws.com/igv.org.genomes/" + details['Genome'] + "/ensGene.txt.gz",
                    //         "indexURL": "https://s3.dualstack.us-east-1.amazonaws.com/igv.org.genomes/" + details['Genome'] + "/ensGene.txt.gz.tbi",
                    //         "visibilityWindow": 20000000
                    //     },
                    //     {
                    //         "name": "Repeat Masker",
                    //         "type": "annotation",
                    //         "format": "rmsk",
                    //         "displayMode": "EXPANDED",
                    //         "url": "https://s3.dualstack.us-east-1.amazonaws.com/igv.org.genomes/" + details['Genome'] + "/rmsk.txt.gz",
                    //         "indexURL": "https://s3.dualstack.us-east-1.amazonaws.com/igv.org.genomes/" + details['Genome'] + "/rmsk.txt.gz.tbi",
                    //         "visibilityWindow": 1000000
                    //     },
                    //     //        {
                    //     //          "name": "CpG Islands",
                    //     //          "type": "annotation",
                    //     //          "format": "cpgIslandExt",
                    //     //          "displayMode": "EXPANDED",
                    //     //          "url": "https://s3.dualstack.us-east-1.amazonaws.com/igv.org.genomes/dm6/cpgIslandExt.txt.gz"
                    //     //        }
                    // ]
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



                var promise: Promise<igv.IGVBrowser> = igv.createBrowser(<HTMLDivElement>document.getElementById('gene-browser-below'), options);
                promise.then(belowBrowser => {
                    bottomBrowser = belowBrowser;
                    // Override the method for updating search widget when resizing
                    bottomBrowser._updateLocusSearchWidget = bottomBrowser.updateLocusSearchWidget;
                    bottomBrowser.updateLocusSearchWidget = function (referenceFrameList: igv.ReferenceFrame[]): void {
                        bottomBrowser._updateLocusSearchWidget(referenceFrameList);

                        requestViewUpdate({ dimension: "x", locus: referenceFrameList[0] }) //, callback: () =>{console.log(referenceFrameList); 

                    }

                    var promise: Promise<igv.IGVBrowser> = igv.createBrowser(<HTMLDivElement>document.getElementById('gene-browser-right'), options);
                    promise.then(browser => {
                        rightBrowser = browser;
                        rightBrowser._updateLocusSearchWidget = rightBrowser.updateLocusSearchWidget;
                        rightBrowser.updateLocusSearchWidget = function (referenceFrameList: igv.ReferenceFrame[]): void {
                            rightBrowser._updateLocusSearchWidget(referenceFrameList)

                            requestViewUpdate({ dimension: "y", locus: referenceFrameList[0] })
                        }


                        belowBrowser.search(sourceChrom.name + ":0-" + sourceChrom.length);
                        rightBrowser.search(targetChrom.name + ":0-" + targetChrom.length);

                        let fileSelector = <HTMLInputElement>document.getElementById('file-selector')
                        fileSelector.addEventListener('change', (event) => {


                            console.log(event)
                            console.log(fileSelector.files)
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
                                        const extension = filename.split('.').pop();
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
                                                url: location,
                                                name: filename
                                            }).then(track => {
                                                resizeTracks()
                                            })
                                            rightBrowser.loadTrack({
                                                type: type,
                                                format: format,
                                                //sourceType: "file",
                                                url: location,
                                                name: filename
                                            }).then(track => {
                                                resizeTracks()
                                            })
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
                        });
                        imageGUI.add(imageMap, 'percentile', 0, 1, 0.001).name('Percentile (threshold) ').onChange((value) => {
                            imageMap.setPercentile(parseFloat(value));
                        });

                        imageMap.addContactMenu(imageGUI);


                        // Set up the options for voronoi
                        const voronoiGUI = new dat.GUI({ name: "Voronoi Options", autoPlace: false });
                        console.log(document.getElementById('voronoi-canvas-div'))
                        document.getElementById('voronoi-controls')?.appendChild(voronoiGUI.domElement);

                        //voronoiGUI.add(voronoiMap, 'generateVoronoiOnServer').name("Server Voronoi")

                        voronoiGUI.add(voronoiMap, 'displayVoronoiEdges').name('Display edges').onChange((value) => {
                            //voronoiMap.drawVoronoi();
                            //voronoiMap.redraw();
                            voronoiMap.redrawVoronoi();
                        })
                        voronoiGUI.add(voronoiMap, 'displayCentroid').name('Display centroid').onChange((value) => {
                            voronoiMap.redrawVoronoi();
                        })

                        const smoothingMenu = voronoiGUI.addFolder('Smoothing');
                        smoothingMenu.add(voronoiMap, 'smoothingRepetitions', 0, 10, 1).name('Repetitions').onChange((value) => {
                            requestViewUpdate({ dimension: "x", locus: bottomBrowser.referenceFrameList[0] })
                            requestViewUpdate({ dimension: "y", locus: rightBrowser.referenceFrameList[0] })
                            /*voronoiMap.calculateVoronoi();
                            voronoiMap.drawVoronoi();
                            voronoiMap.redraw();*/
                        })

                        /*smoothingMenu.add(voronoiMap, 'omega', 0, 2).name('Omega').onChange((value) => {
                            voronoiMap.calculateVoronoi();
                            voronoiMap.drawVoronoi();
                            voronoiMap.redraw();
                        })*/

                        voronoiMap.addContactMenu(voronoiGUI);

                        // Reposition the interface
                        reposition();

                        if (details['hasInteract']) {
                            fetch('./interact').then((response) => {
                                if (response.status !== 200) {
                                    console.log('Looks like there was a problem. Status Code: ' +
                                        response.status);
                                    return;
                                }

                                response.json().then(interact => {

                                    for (var chromPair in interact['Interactions']) {
                                        var interactionArray: Interaction[] = [];
                                        interact['Interactions'][chromPair].forEach((interaction: any) => {
                                            interactionArray.push(Interaction.fromJSON(interaction, chromosomes));
                                        });

                                        interactions.set(chromPair, interactionArray)
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
