import * as React from "react";
import { Menu } from "./components/menu"
import { lazy, useEffect, useState } from "react"
import { Chromosome, getChromosomeFromMap, Interaction, Locus } from "./chromosome";
import { GenomeDetails } from "./genome";
import { IGViewer, ViewRequest } from "./components/IGViewer";
import { ImageView } from "./components/ImageView";
import { VoronoiView } from "./components/VoronoiView";
import { TriangleView } from "./components/TriangleView";
import { parseVoronoiAndImage } from "./server";
import { Voronoi, MinMax } from "./voronoi";
import { VoronoiPlot } from "./voronoiPlot";
import { Rectangle } from "./axis";
import { ColourBar, Histogram } from "./components/ColourBar";
import d3 = require("d3");
import { histogram } from "d3";


interface View {
    startX: number,
    endX: number,
    startY: number,
    endY: number
}

interface AppProps {
    // These three are more like properties than state
    chromosomes: Map<string, Chromosome>
    genome: GenomeDetails,

    interactions?: Map<string, Map<string, Interaction[]>>;

    sourceChrom: Chromosome,
    targetChrom: Chromosome
}

interface AppState {

    view: View

    sourceChrom: Chromosome,
    //    srcStart: number,
    //    srcEnd: number,

    targetChrom: Chromosome,
    //    tarStart: number,
    //    tarEnd: number

    intrachromosomeView: boolean

    voronoi: Voronoi | null
    histogram: Histogram | null

    // Scales for the colour map
    scale: d3.ScaleQuantize<number, never> | null
    colourScale: d3.ScaleContinuousNumeric<string, string, never> | null
}

// The number of colours to use when generating a colour scale
const NUM_COLOURS = 100;
const COLOURMAP_WIDTH = 700;

export class App extends React.Component<AppProps, AppState> {
    xRequest: ViewRequest | undefined
    yRequest: ViewRequest | undefined
    timeoutFunction: any;

    voronoiView: VoronoiView | undefined

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
            voronoi: null,
            histogram: null,
            scale: null,
            colourScale: null,
        };

        this.viewRequest = this.viewRequest.bind(this);
        this.requestViewUpdate = this.requestViewUpdate.bind(this);
        this.onRegionSelect = this.onRegionSelect.bind(this);
        this.generateHistogram = this.generateHistogram.bind(this);
    }

    // Perform once when first initialising the app: load details
    componentDidMount() {
        // Load the dataset list from server
        console.log("state", this.state)

        this.updateView(this.state.view);
    }

    componentDidUpdate(prevProps: AppProps, prevState: AppState) {
        if (this.state.view != prevState.view) {
            this.updateView(this.state.view);
        }
    }

    updateView(view: View) {
        /*lastLocus.chr = xRequest.locus.chr;
        lastLocus.start = startX;
        lastLocus.end = endX;*/

        if (!this.voronoiView || !this.voronoiView.voronoiPlot) {
            return;
        }

        let voronoiPlot: VoronoiPlot = this.voronoiView.voronoiPlot;

        // Update the URL to reflect the current view
        let nextURL = window.location.href.split('?')[0] + "?srcChrom=" + this.state.sourceChrom.name + "&srcStart=" + view.startX + "&srcEnd=" + view.endX + "&tarChrom=" + this.state.targetChrom.name + "&tarStart=" + view.startY + "&tarEnd=" + view.endY + "&triangleView=" + this.state.intrachromosomeView
        window.history.pushState({}, this.state.sourceChrom.nameWithChr() + ":" + view.startX + "-" + view.endX + " x " + this.state.targetChrom + ":" + view.startY + "-" + view.endY, nextURL);

        //imageMap.setChromPair(sourceChrom, targetChrom);
        //imageMap.updateViewLimits(startX, endX, startY, endY);

        let pixelsX = 100; // voronoiMap.getVoronoiDrawWidth()
        let pixelsY = 100; // voronoiMap.getVoronoiDrawHeight()
        let smoothingIters = 1; //voronoiMap.smoothingRepetitions
        let numBins = 200; // imageMap.numBins

        fetch('./voronoiandimage?pixelsX=' + pixelsX + '&pixelsY=' + pixelsY + '&smoothingIterations=' + smoothingIters + '&numBins=' + numBins + '&sourceChrom=' + this.state.sourceChrom.name + '&targetChrom=' + this.state.targetChrom.name + '&xStart=' + view.startX + '&xEnd=' + view.endX + '&yStart=' + view.startY + '&yEnd=' + view.endY)
            .then(
                (response) => {
                    if (response.status !== 200) {
                        console.log('Looks like there was a problem. Status Code: ' +
                            response.status);
                        return;
                    }

                    response.arrayBuffer().then((buffer: ArrayBuffer) => {
                        if (this.props.interactions) {
                            this.props.interactions.forEach((interactionMap, name, map) => {
                                let interactionSet = interactionMap.get(this.state.sourceChrom.nameWithChr() + "-" + this.state.targetChrom.nameWithChr())

                                if (interactionSet) {
                                    //imageMap.setInteractions(name, interactionSet);
                                    //voronoiMap.setInteractions(name, interactionSet);
                                } else {
                                    //imageMap.setInteractions(name, []);
                                    //voronoiMap.setInteractions(name, []);
                                }

                            })
                        }

                        voronoiPlot.setChromPair(this.state.sourceChrom, this.state.targetChrom);
                        voronoiPlot.updateViewLimits(view.startX, view.endX, view.startY, view.endY);

                        let area_scale = (voronoiPlot.getVoronoiDrawWidth() * voronoiPlot.getVoronoiDrawHeight()) / ((view.endX - view.startX) * (view.endY - view.startY));

                        let response = parseVoronoiAndImage(buffer, area_scale);
                        let histogram = this.generateHistogram(response.vor, COLOURMAP_WIDTH);

                        this.setState({
                            voronoi: response.vor,
                            histogram: histogram,
                            scale: d3.scaleQuantize().range(d3.range(NUM_COLOURS)).domain([histogram.minMax.Min, histogram.minMax.Max]),
                            colourScale: d3.scaleLinear<string>().range(["saddlebrown", "lightgreen", "steelblue"]).domain([0, NUM_COLOURS / 2, NUM_COLOURS])
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

    requestViewUpdate(request: ViewRequest) {
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
            this.timeoutFunction = setTimeout(() => {
                // Update view if no new requests in last 50 ms

                if (this.xRequest && this.yRequest) {
                    this.viewRequest(this.xRequest, this.yRequest);

                    clearTimeout(this.timeoutFunction);
                }
            }, 50);
        }
    }

    onRegionSelect(region: Rectangle) {
        this.requestViewUpdate({ dimension: "x", locus: { chr: this.state.sourceChrom.name, start: Math.round(region.min.x), end: Math.round(region.max.x) } });
        this.requestViewUpdate({ dimension: "y", locus: { chr: this.state.targetChrom.name, start: Math.round(region.min.y), end: Math.round(region.max.y) } });
    }

    generateHistogram(voronoi: Voronoi, numBins: number): Histogram {
        let minMax: MinMax = voronoi.getMinMaxArea();
        let histogram = new Histogram(numBins, minMax);

        for (let i = 0; i < voronoi.polygons.length; i++) {
            if (voronoi.polygons[i].clipped) {
                continue;
            }

            let areaBin = Math.round((Math.log(voronoi.polygons[i].area) - minMax.Min) / histogram.binWidth);
            histogram.histogram[areaBin]++
        }

        return histogram;
    }

    render() {
        return (
            <React.Fragment>
                <Menu></Menu>
                {this.state.histogram &&
                    <ColourBar scale={this.state.scale!}
                        colourScale={this.state.colourScale!}
                        histogram={this.state.histogram}
                        onScaleChange={(scale: d3.ScaleQuantize<number, never>) => {
                            this.voronoiView!.voronoiPlot!.redrawVoronoi();
                        }}
                        height={100}
                        width={COLOURMAP_WIDTH} ></ColourBar>
                }
                <div style={{ marginLeft: 40, width: "calc(100vw - 40px)", height: "100vh", display: "flex" }}>
                    <div style={{ width: "100%", height: "100%" }}>
                        <div style={{ height: "calc(50vw - 50px)", width: "calc(50vw - 50px)" }}>
                            <ImageView></ImageView>
                            <VoronoiView ref={(view: VoronoiView) => this.voronoiView = view} voronoi={this.state.voronoi} scale={this.state.scale} colourScale={this.state.colourScale!} onRegionSelect={this.onRegionSelect}></VoronoiView>
                            <TriangleView></TriangleView>
                        </div>
                        <div style={{ width: "calc(50vw - 50px)" }}>
                            <IGViewer id={"gene-browser-below"}
                                browserOptions={{
                                    palette: ['#00A0B0', '#6A4A3C', '#CC333F', '#EB6841'],
                                    locus: this.state.sourceChrom.name + ":" + this.state.view.startX + "-" + this.state.view.endX,

                                    reference: this.props.genome,
                                }} dimension="x" requestViewUpdate={this.requestViewUpdate}></IGViewer>
                        </div>
                        <div style={{ width: "calc(50vw - 50px)", position: "absolute", left: "50vw", top: "calc(50vw - 50px)" }}>
                            <IGViewer id={"gene-browser-right"} className="rotated"
                                browserOptions={{
                                    palette: ['#00A0B0', '#6A4A3C', '#CC333F', '#EB6841'],
                                    locus: this.state.targetChrom.name + ":" + this.state.view.startY + "-" + this.state.view.endY,

                                    reference: this.props.genome,
                                }} dimension="y" requestViewUpdate={this.requestViewUpdate}></IGViewer>
                        </div>
                    </div>
                </div>
            </React.Fragment >
        );
    }
}