import { Browser, TrackView } from "igv";
import { SVGContext } from "./canvas2svg";
import { ColourBar } from "./components/ColourBar";
import { VoronoiPlot } from "./voronoiPlot";

const downloadCanvas: HTMLCanvasElement = document.createElement("canvas");
let link: HTMLAnchorElement = document.createElement("a")

export function exportToImage(drawSVG: boolean, voronoiMap: VoronoiPlot, colourBar: ColourBar, bottomBrowser: Browser, rightBrowser: Browser | undefined): void {
    //let downloadCanvas = <HTMLCanvasElement>document.getElementById('downloadCanvas');
    voronoiMap.redraw();

    let trackSizesBelow = 0;
    let trackSizesRight = 0;

    console.log(bottomBrowser)
    bottomBrowser.trackViews.forEach((trackView: TrackView) => {
        console.log(trackView.viewports[0])
        if (trackView.viewports[0].canvas) {
            trackSizesBelow += trackView.viewports[0].canvas.height;
        }
    })

    if (rightBrowser) {
        rightBrowser.trackViews.forEach((trackView: TrackView) => {
            console.log(trackView.viewports[0])
            if (trackView.viewports[0].canvas) {
                trackSizesRight += trackView.viewports[0].canvas.height;
            }
        })
    }

    downloadCanvas.width = voronoiMap.canvas.width + trackSizesRight;
    downloadCanvas.height = voronoiMap.canvas.height + trackSizesBelow;

    if (!drawSVG) {
        let downloadCanvasCTX = <CanvasRenderingContext2D>downloadCanvas.getContext("2d");

        downloadCanvasCTX.drawImage(voronoiMap.canvas, 0, 0);

        let lastY = voronoiMap.canvas.height;

        bottomBrowser.trackViews.forEach((trackView: TrackView) => {
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
                    viewportWidth: viewport.$viewport.width()
                })
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

        if (rightBrowser) {
            rightBrowser.trackViews.forEach((trackView: TrackView) => {
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
        }

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

        let baseYOffset = 100;
        downloadCanvasCTX.save()
        colourBar.renderColourBar(downloadCanvasCTX, voronoiMap.axisWidth, baseYOffset);
        downloadCanvasCTX.restore()

        downloadCanvasCTX.transform(1, 0, 0, 1, 0, baseYOffset);

        downloadCanvasCTX.save()
        downloadCanvasCTX.lineWidth = 0.25

        // Flip canvas (SVG is opposite to canvas) and move to start of axis
        downloadCanvasCTX.transform(1, 0, 0, -1, voronoiMap.axisOffsetX, voronoiMap.axisHeight + voronoiMap.axisOffsetY)

        if (voronoiMap.intrachromosomeView) {
            // Transformation for triangle view
            downloadCanvasCTX.transform(0.5, -0.5, 0.5, 0.5, 0, 0)

            voronoiMap.drawVoronoi(downloadCanvasCTX, voronoiMap.axisWidth, voronoiMap.axisWidth, true);
            voronoiMap.drawContacts(downloadCanvasCTX, voronoiMap.axisWidth, voronoiMap.axisWidth, true);
        } else {
            downloadCanvasCTX.imageSmoothingEnabled = false;
            voronoiMap.drawVoronoi(downloadCanvasCTX, voronoiMap.axisWidth, voronoiMap.axisHeight, false)
            voronoiMap.drawContacts(downloadCanvasCTX, voronoiMap.axisWidth, voronoiMap.axisHeight, false);
        }
        downloadCanvasCTX.restore()
        voronoiMap.drawTicks(downloadCanvasCTX)

        // Resize the browser so that the ticks display nicely
        //let tempWidth = voronoiMap.axisWidth * 1.25
        //resizeIGVElements(tempWidth, bottomBrowser, rightBrowser);

        var mySerializedSVG = downloadCanvasCTX.getSerializedSvg(true);
        var parser = new DOMParser();
        var voronoiElement = parser.parseFromString(mySerializedSVG, "image/svg+xml");

        let bottomBrowserSVG = bottomBrowser.toSVG()
        var bottomBrowserElement = parser.parseFromString(bottomBrowserSVG, "image/svg+xml");

        // Specify the transformation first so that the definitions are created
        bottomBrowserElement.documentElement.setAttribute('transform', "translate(" + voronoiMap.axisOffsetX + " " + (voronoiMap.canvas.height + baseYOffset) + ")")
        mergeSVG(voronoiElement, bottomBrowserElement, "translate(" + voronoiMap.axisOffsetX + " " + (voronoiMap.canvas.height + baseYOffset) + ")")

        if (!voronoiMap.intrachromosomeView && rightBrowser) {
            // Have to remove the CSS rotation, otherwise SVG export produces odd results
            (<HTMLDivElement>document.getElementById('gene-browser-right')).classList.remove("rotated");
            let rightBrowserSVG = rightBrowser.toSVG();
            (<HTMLDivElement>document.getElementById('gene-browser-right')).classList.add("rotated");
            var rightBrowserDocument = parser.parseFromString(rightBrowserSVG, "image/svg+xml");

            // Specify the transformation first so that the definitions are created
            //rightBrowserDocument.documentElement.setAttribute('viewport', '')
            rightBrowserDocument.documentElement.setAttribute('transform', "translate(" + voronoiMap.canvas.width + " " + (voronoiMap.canvas.height - voronoiMap.axisOffsetY + baseYOffset) + ") rotate(-90)")
            mergeSVG(voronoiElement, rightBrowserDocument, "translate(" + voronoiMap.canvas.width + " " + (voronoiMap.canvas.height - voronoiMap.axisOffsetY + baseYOffset) + ") rotate(-90)")
        }

        //resizeIGVElements(voronoiMap.axisWidth, bottomBrowser, rightBrowser);

        var s = new XMLSerializer();
        mySerializedSVG = s.serializeToString(voronoiElement.documentElement)

        console.log(mySerializedSVG)

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



export function resizeIGVElements(size: number, bottomBrowser: Browser, rightBrowser: Browser | undefined) {
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
    if (rightBrowser) {
        for (let trackView of rightBrowser.trackViews) {
            trackView.updateViews(true);
        }
    }
}