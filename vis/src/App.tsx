import * as React from "react";
import { Menu, UploadedTrack } from "./components/menu"
import { lazy, useEffect, useState } from "react"
import { Chromosome, getChromosomeFromMap, Interaction, Locus } from "./chromosome";
import { GenomeDetails } from "./genome";
import { IGViewer, ViewRequest } from "./components/IGViewer";
import { ImageView } from "./components/ImageView";
import { VoronoiView } from "./components/VoronoiView";
import { parseVoronoiAndImage, Image } from "./server";
import { Voronoi, MinMax } from "./voronoi";
import { VoronoiPlot } from "./voronoiPlot";
import { Rectangle } from "./axis";
import { ColourBar, Histogram } from "./components/ColourBar";
import d3 = require("d3");
import { exportToImage } from "./exportToImage";


export interface View {
    startX: number,
    endX: number,
    startY: number,
    endY: number
}

interface AppProps {
    // These three are more like properties than state
    chromosomes: Map<string, Chromosome>
    genome: GenomeDetails,

    hasInteract: boolean

    sourceChrom: Chromosome,
    targetChrom: Chromosome
}

interface AppState {
    view: View

    sourceChrom: Chromosome,
    targetChrom: Chromosome,

    tracks: UploadedTrack[]

    intrachromosomeView: boolean
    hideImageMap: boolean

    interactions?: Map<string, Map<string, Interaction[]>>;

    smoothingIterations: number,

    maxNumBins: number,
    imageBinSize: number,
    binSizeX: number,
    binSizeY: number

    voronoi: Voronoi | null
    imageData: Image | null
    histogram: Histogram | null
    imageHistogram: Histogram | null

    // Scales for the colour map
    scale: d3.ScaleQuantize<number, never> | null
    colourScale: d3.ScaleContinuousNumeric<string, string, never> | null
    imageScale: d3.ScaleQuantize<number, never> | null
    imageColourScale: d3.ScaleContinuousNumeric<string, string, never> | null

    colourMapVisible: boolean
}

// The number of colours to use when generating a colour scale
const NUM_COLOURS = 100;
const COLOURMAP_WIDTH = 700;
const COLOURMAP_HEIGHT = 100;

const IMAGE_MAP_DATA_TRANSFORM = (value: number) => { return Math.log(1 + value); };

export class App extends React.Component<AppProps, AppState> {
    belowBrowser: IGViewer | undefined
    rightBrowser: IGViewer | undefined

    xRequest: ViewRequest | undefined
    yRequest: ViewRequest | undefined
    timeoutFunction: any;

    voronoiView: VoronoiView | undefined
    imageView: ImageView | undefined

    // Keep track of the last request to avoid duplicates

    constructor(props: AppProps) {
        super(props);

        this.state = {
            sourceChrom: props.sourceChrom,
            targetChrom: props.targetChrom,

            view: {
                startX: 0, endX: props.sourceChrom.length,
                startY: 0, endY: props.targetChrom.length
            },

            intrachromosomeView: false,
            hideImageMap: false,
            smoothingIterations: 1,
            maxNumBins: 500,
            imageBinSize: 5000,
            binSizeX: 0,
            binSizeY: 0,
            tracks: new Array(),
            voronoi: null,
            imageData: null,
            histogram: null,
            imageHistogram: null,
            scale: null,
            colourScale: null,
            imageScale: null,
            imageColourScale: null,
            colourMapVisible: false,
        };

        this.viewRequest = this.viewRequest.bind(this);
        this.requestViewUpdate = this.requestViewUpdate.bind(this);
        this.onRegionSelect = this.onRegionSelect.bind(this);
        this.setSmoothingIterations = this.setSmoothingIterations.bind(this);
        this.generateHistogram = this.generateHistogram.bind(this);
        this.generateImageHistogram = this.generateImageHistogram.bind(this);
        this.canvasWidth = this.canvasWidth.bind(this);
        this.browserWidth = this.browserWidth.bind(this);
        this.rotatedBrowserWidth = this.rotatedBrowserWidth.bind(this);
    }

    // Perform once when first initialising the app: load details
    componentDidMount() {
        if (this.props.hasInteract) {
            fetch('./interact').then((response) => {
                if (response.status !== 200) {
                    console.log('Looks like there was a problem. Status Code: ' +
                        response.status);
                    return;
                }

                response.json().then(interactFiles => {
                    let interactions: Map<string, Map<string, Interaction[]>> = new Map();

                    for (const [name, interact] of Object.entries<any>(interactFiles)) {
                        if (interact == null) {
                            continue
                        }

                        this.imageView!.imageMap!.addContactMenu(name, this.imageView!.imageGUI!);
                        this.voronoiView!.voronoiPlot!.addContactMenu(name, this.voronoiView!.voronoiGUI!);

                        let serverInteractions = new Map<string, Interaction[]>();

                        for (var chromPair in interact['Interactions']) {

                            var interactionArray: Interaction[] = [];
                            interact['Interactions'][chromPair].forEach((interaction: any) => {
                                interactionArray.push(Interaction.fromJSON(interaction, this.props.chromosomes));
                            });

                            serverInteractions.set(chromPair, interactionArray)
                        }

                        interactions.set(name, serverInteractions)
                    }

                    this.setState({ interactions: interactions })
                })
            });
        }

        this.updateView(this.state.view);
    }

    componentDidUpdate(prevProps: AppProps, prevState: AppState) {
        if (this.state.intrachromosomeView != prevState.intrachromosomeView) {
            // If we have swapped view, then we might need to update the view parameters
            this.requestViewUpdate({ dimension: "x", locus: { chr: this.state.sourceChrom.name, start: this.state.view.startX, end: this.state.view.endX } });
            this.requestViewUpdate({ dimension: "y", locus: { chr: this.state.sourceChrom.name, start: this.state.view.startX, end: this.state.view.endX } });
        } else if (this.state.view != prevState.view || this.state.smoothingIterations != prevState.smoothingIterations || this.state.imageBinSize != prevState.imageBinSize) {
            this.updateView(this.state.view);
        }
    }

    updateView(view: View) {
        /*lastLocus.chr = xRequest.locus.chr;
        lastLocus.start = startX;
        lastLocus.end = endX;*/


        if (!this.voronoiView || !this.voronoiView.voronoiPlot || (!this.state.hideImageMap && (!this.imageView || !this.imageView.imageMap))) {
            return;
        }

        let voronoiPlot: VoronoiPlot = this.voronoiView.voronoiPlot;

        // Update the URL to reflect the current view
        let nextURL = window.location.href.split('?')[0] + "?srcChrom=" + this.state.sourceChrom.name + "&srcStart=" + view.startX + "&srcEnd=" + view.endX + "&tarChrom=" + this.state.targetChrom.name + "&tarStart=" + view.startY + "&tarEnd=" + view.endY + "&triangleView=" + this.state.intrachromosomeView
        window.history.pushState({}, this.state.sourceChrom.nameWithChr() + ":" + view.startX + "-" + view.endX + " x " + this.state.targetChrom + ":" + view.startY + "-" + view.endY, nextURL);

        //imageMap.setChromPair(sourceChrom, targetChrom);
        //imageMap.updateViewLimits(startX, endX, startY, endY);

        //let pixelsX = 100; // voronoiMap.getVoronoiDrawWidth()
        //let pixelsY = 100; // voronoiMap.getVoronoiDrawHeight()
        //pixelsX=' + pixelsX + '&pixelsY=' + pixelsY + '&

        let numBinsX = Math.round((view.endX - view.startX) / this.state.imageBinSize);
        let numBinsY = Math.round((view.endY - view.startY) / this.state.imageBinSize);

        if (numBinsX > this.state.maxNumBins) {
            numBinsX = this.state.maxNumBins
        }
        if (numBinsY > this.state.maxNumBins) {
            numBinsY = this.state.maxNumBins
        }
        let binSizeX = Math.floor((view.endX - view.startX) / numBinsX);
        let binSizeY = Math.floor((view.endY - view.startY) / numBinsY);

        if (binSizeX < this.state.imageBinSize) {
            binSizeX = this.state.imageBinSize
        }
        if (binSizeY < this.state.imageBinSize) {
            binSizeY = this.state.imageBinSize
        }

        fetch('./voronoiandimage?smoothingIterations=' + this.state.smoothingIterations + '&binSizeX=' + binSizeX + '&binSizeY=' + binSizeY + '&sourceChrom=' + this.state.sourceChrom.name + '&targetChrom=' + this.state.targetChrom.name + '&xStart=' + view.startX + '&xEnd=' + view.endX + '&yStart=' + view.startY + '&yEnd=' + view.endY)
            .then(
                (response) => {
                    if (response.status !== 200) {
                        console.log('Looks like there was a problem. Status Code: ' +
                            response.status);
                        return;
                    }

                    response.arrayBuffer().then((buffer: ArrayBuffer) => {
                        if (this.state.interactions) {
                            this.state.interactions.forEach((interactionMap, name, map) => {
                                let interactionSet = interactionMap.get(this.state.sourceChrom.nameWithChr() + "-" + this.state.targetChrom.nameWithChr())

                                if (interactionSet) {
                                    this.imageView!.imageMap!.setInteractions(name, interactionSet);
                                    this.voronoiView!.voronoiPlot!.setInteractions(name, interactionSet);
                                } else {
                                    this.imageView!.imageMap!.setInteractions(name, []);
                                    this.voronoiView!.voronoiPlot!.setInteractions(name, []);
                                }

                            })
                        }

                        /*voronoiPlot.setChromPair(this.state.sourceChrom, this.state.targetChrom);
                        voronoiPlot.updateViewLimits(view.startX, view.endX, view.startY, view.endY);

                        if (this.imageView && this.imageView.imageMap) {
                            this.imageView.imageMap.setChromPair(this.state.sourceChrom, this.state.targetChrom);
                            this.imageView.imageMap.updateViewLimits(view.startX, view.endX, view.startY, view.endY);
                        }*/

                        let area_scale = (voronoiPlot.getVoronoiDrawWidth() * voronoiPlot.getVoronoiDrawHeight()) / ((view.endX - view.startX) * (view.endY - view.startY));

                        let response = parseVoronoiAndImage(buffer, area_scale);
                        let histogram = this.generateHistogram(response.vor, this.canvasWidth() - 10);
                        let imageHistogram = this.generateImageHistogram(response.overviewImage, this.canvasWidth() - 10, IMAGE_MAP_DATA_TRANSFORM);
                        this.imageView?.imageMap?.setDataTransform(IMAGE_MAP_DATA_TRANSFORM);

                        this.setState({
                            voronoi: response.vor,
                            imageData: response.overviewImage,
                            histogram: histogram,
                            imageHistogram: imageHistogram,
                            binSizeX: binSizeX,
                            binSizeY: binSizeY,
                            scale: d3.scaleQuantize().range(d3.range(NUM_COLOURS)).domain([histogram.minMax.Min, histogram.minMax.Max]),
                            colourScale: d3.scaleLinear<string>().range(["saddlebrown", "lightgreen", "steelblue"]).domain([0, NUM_COLOURS / 2, NUM_COLOURS]),
                            imageScale: d3.scaleQuantize().range(d3.range(NUM_COLOURS)).domain([imageHistogram.minMax.Min, imageHistogram.minMax.Max]),
                            imageColourScale: d3.scaleLinear<string>().range(["black", "white"]).domain([0, NUM_COLOURS]),
                        });
                    })
                });
    }


    viewRequest(xRequest: ViewRequest, yRequest: ViewRequest) {

        let newSourceChrom = getChromosomeFromMap(this.props.chromosomes, xRequest.locus.chr)
        var newTargetChrom: Chromosome

        let startX = xRequest.locus.start
        let endX = xRequest.locus.end

        var startY: number
        var endY: number

        if (this.state.intrachromosomeView) {
            newTargetChrom = newSourceChrom
            startY = startX
            endY = endX
        } else {
            newTargetChrom = getChromosomeFromMap(this.props.chromosomes, yRequest.locus.chr)
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

        if (this.state.sourceChrom != newSourceChrom || this.state.targetChrom != newTargetChrom) {
            startX = 0
            endX = newSourceChrom.length
            //sourceChrom = newSourceChrom

            startY = 0
            endY = newTargetChrom.length
            //targetChrom = newTargetChrom

        }

        // TODO: Update state?
        console.log("setting state")
        this.setState({ view: { startX, endX, startY, endY }, sourceChrom: newSourceChrom, targetChrom: newTargetChrom })


        //imageMap.requestView(sourceChrom, targetChrom, startX, endX, startY, endY)
        //voronoiMap.requestView(sourceChrom, targetChrom, startX, endX, startY, endY)

    }

    requestViewUpdate(request: ViewRequest, timeout?: number) {
        let validRequest = false;

        if (request.dimension == "x") {
            // Check that there is an update to do
            if (this.state.sourceChrom.name != request.locus.chr || this.state.view.startX != request.locus.start || this.state.view.endX != request.locus.end) {
                this.xRequest = request;

                validRequest = true;
            }
        } else if (request.dimension == "y") {
            // Check that there is an update to do
            if (this.state.targetChrom.name != request.locus.chr || this.state.view.startY != request.locus.start || this.state.view.endY != request.locus.end) {
                this.yRequest = request;

                validRequest = true;
            }
        }

        clearTimeout(this.timeoutFunction);
        if (validRequest) {
            if (!timeout) {
                timeout = 50;
            }

            this.timeoutFunction = setTimeout(() => {
                // Update view if no new requests in last 50 ms

                if (this.xRequest && this.yRequest) {
                    this.viewRequest(this.xRequest, this.yRequest);

                    clearTimeout(this.timeoutFunction);
                }
            }, timeout);
        }
    }

    onRegionSelect(region: Rectangle) {
        this.requestViewUpdate({ dimension: "x", locus: { chr: this.state.sourceChrom.name, start: Math.round(region.min.x), end: Math.round(region.max.x) } });
        this.requestViewUpdate({ dimension: "y", locus: { chr: this.state.targetChrom.name, start: Math.round(region.min.y), end: Math.round(region.max.y) } });
    }

    setSmoothingIterations(iterations: number) {
        this.setState({ smoothingIterations: iterations })
    }

    generateHistogram(voronoi: Voronoi, numBins: number): Histogram {
        let minMax: MinMax = voronoi.getMinMaxArea();
        let histogram = new Histogram(numBins, minMax, Math.log);

        for (let i = 0; i < voronoi.polygons.length; i++) {
            if (voronoi.polygons[i].clipped) {
                continue;
            }

            let areaBin = Math.round((Math.log(voronoi.polygons[i].area) - minMax.Min) / histogram.binWidth);
            histogram.histogram[areaBin]++
        }

        return histogram;
    }

    generateImageHistogram(image: Image, numBins: number, transform: (value: number) => number): Histogram {
        let min = transform(image.data[0]);
        let max = transform(image.data[0]);

        for (let value of image.data) {
            let trasformedValue = transform(value);

            if (trasformedValue < min) {
                min = trasformedValue;
            }
            if (trasformedValue > max) {
                max = trasformedValue;
            }
        }

        let minMax = { Min: min, Max: max };
        let histogram = new Histogram(numBins, minMax, transform);

        for (let value of image.data) {
            let areaBin = Math.round((transform(value) - minMax.Min) / histogram.binWidth);
            histogram.histogram[areaBin]++
        }

        return histogram;
    }

    canvasWidth(): number {
        let vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);

        if (this.state.hideImageMap) {
            return 0.5 * vw - 50//"calc(50vw - 50px)"
        } else {
            return (vw / 3) - 25//"calc(33vw - 25px)"
        }
    }

    browserWidth(): string {
        if (this.state.hideImageMap) {
            return "calc(50vw - 80px)"
        } else {
            return "calc(33vw - 55px)"
        }
    }


    rotatedBrowserWidth(): string {
        if (this.state.hideImageMap) {
            return "calc(50vw - 80px)"
        } else {
            return "calc(33vw - 55px)"
        }
    }

    browserRightPosition(): string {
        if (this.state.hideImageMap) {
            return "50vw"
        } else {
            return "66vw"
        }
    }

    browserTopPosition(): string {
        let extraShift = "";
        if (this.state.colourMapVisible) {
            extraShift = " + " + COLOURMAP_HEIGHT + "px";
        }

        if (this.state.hideImageMap) {
            return "calc(50vw - 65px" + extraShift + ")"
        } else {
            return "calc(33vw - 41px" + extraShift + ")"
        }
    }

    render() {
        return (
            <React.Fragment>
                <Menu onColourButtonClicked={() => this.setState({ colourMapVisible: !this.state.colourMapVisible })}
                    onHideImageButtonClicked={() => this.setState({ hideImageMap: !this.state.hideImageMap }, () => {
                        if (this.belowBrowser) {
                            this.belowBrowser.refresh();
                        }
                        if (this.rightBrowser) {
                            this.rightBrowser.refresh();
                        }
                    })}
                    onTriangleButtonClicked={() => this.setState({ intrachromosomeView: !this.state.intrachromosomeView })}

                    loadUploadedTrack={(uploadedTrack: UploadedTrack) => {
                        this.setState({ tracks: this.state.tracks.concat(uploadedTrack) })
                    }}

                    onSaveToSVGClicked={() => {
                        console.log("Exporting")
                        exportToImage(true, this.voronoiView!.voronoiPlot!, this.belowBrowser!.browser!, this.rightBrowser?.browser)
                    }}
                ></Menu>
                <div style={{ marginLeft: 40, width: "calc(100vw - 40px)", height: "100vh" }}>
                    <div style={{ display: "flex" }}>
                        {
                            this.state.colourMapVisible && !this.state.hideImageMap &&
                            <ColourBar scale={this.state.imageScale!}
                                colourScale={this.state.imageColourScale!}
                                histogram={this.state.imageHistogram}
                                onScaleChange={(scale: d3.ScaleQuantize<number, never>) => {
                                    console.log(this.imageView)
                                    this.imageView!.imageMap!.recolourImage();
                                    this.imageView!.imageMap!.redraw()
                                }}
                                height={COLOURMAP_HEIGHT}
                                width={this.canvasWidth()} ></ColourBar>
                        }
                        {
                            this.state.colourMapVisible && this.state.histogram &&
                            <ColourBar scale={this.state.scale!}
                                colourScale={this.state.colourScale!}
                                histogram={this.state.histogram}
                                onScaleChange={(scale: d3.ScaleQuantize<number, never>) => {
                                    this.voronoiView!.voronoiPlot!.drawPolygonsCanvas();
                                }}
                                height={COLOURMAP_HEIGHT}
                                width={this.canvasWidth()} ></ColourBar>
                        }
                    </div>
                    <div style={{ width: "100%" }}>
                        {!this.state.hideImageMap &&
                            <div style={{ width: this.canvasWidth(), display: "inline-block" }}>
                                <ImageView ref={(view: ImageView) => this.imageView = view}
                                    imageData={this.state.imageData}
                                    view={this.state.view}
                                    sourceChrom={this.state.sourceChrom}
                                    targetChrom={this.state.targetChrom}
                                    numBins={200}
                                    intrachromosomeView={this.state.intrachromosomeView}
                                    scale={this.state.imageScale}
                                    colourScale={this.state.imageColourScale!}
                                    onRegionSelect={this.onRegionSelect}
                                    onSetBinSize={(binSize: number) => { this.setState({ imageBinSize: binSize }) }}></ImageView>
                                <p style={{ float: "left" }}>Bin size: {this.state.binSizeX} x {this.state.binSizeY}</p>
                            </div>
                        }
                        <div style={{ width: this.canvasWidth(), display: "inline-block" }}>
                            <VoronoiView ref={(view: VoronoiView) => this.voronoiView = view}
                                voronoi={this.state.voronoi}
                                view={this.state.view}
                                sourceChrom={this.state.sourceChrom}
                                targetChrom={this.state.targetChrom}
                                intrachromosomeView={this.state.intrachromosomeView}
                                scale={this.state.scale}
                                colourScale={this.state.colourScale!}
                                onRegionSelect={this.onRegionSelect}
                                onSetSmoothing={this.setSmoothingIterations}
                            ></VoronoiView>
                        </div>
                    </div>
                    <div style={{ width: "100%", height: "100%" }}>
                        {!this.state.hideImageMap &&
                            <div style={{ width: this.canvasWidth(), display: "inline-block" }}></div>
                        }
                        <div style={{ paddingLeft: "16px", width: this.browserWidth(), display: "inline-block" }}>
                            <IGViewer id={"gene-browser-below"}
                                ref={(viewer: IGViewer) => { this.belowBrowser = viewer }}
                                browserOptions={{
                                    palette: ['#00A0B0', '#6A4A3C', '#CC333F', '#EB6841'],
                                    locus: this.state.sourceChrom.name + ":" + this.state.view.startX + "-" + this.state.view.endX,

                                    reference: this.props.genome,
                                }} dimension="x"
                                tracks={this.state.tracks}
                                requestViewUpdate={this.requestViewUpdate}></IGViewer>
                        </div>
                        <div style={{ width: this.rotatedBrowserWidth(), position: "absolute", left: this.browserRightPosition(), top: this.browserTopPosition(), visibility: this.state.intrachromosomeView ? "hidden" : "visible" }}>
                            <IGViewer id={"gene-browser-right"} className="rotated"
                                ref={(viewer: IGViewer) => { this.rightBrowser = viewer }}
                                browserOptions={{
                                    palette: ['#00A0B0', '#6A4A3C', '#CC333F', '#EB6841'],
                                    locus: this.state.targetChrom.name + ":" + this.state.view.startY + "-" + this.state.view.endY,

                                    reference: this.props.genome,
                                }} dimension="y"
                                tracks={this.state.tracks}
                                requestViewUpdate={this.requestViewUpdate}></IGViewer>
                        </div>
                    </div>

                    <div id='vertline' style={{ height: "1px", backgroundColor: "black", position: "absolute" }}></div>
                    <div id='horline' style={{ height: "1px", backgroundColor: "black", position: "absolute" }}></div>
                </div>
            </React.Fragment >
        );
    }
}