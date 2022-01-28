import { GUI } from "dat.gui";
import React = require("react");
import { View } from "../App";
import { Rectangle } from "../axis";
import { Chromosome } from "../chromosome";
import { ImageMap } from "../imageMap";

interface ImageViewProps {
    numBins: number
    imageData: Uint32Array | null

    view: View

    sourceChrom: Chromosome,
    targetChrom: Chromosome,

    intrachromosomeView: boolean

    scale: d3.ScaleQuantize<number, never> | null
    colourScale: d3.ScaleContinuousNumeric<string, string, never> | null

    onRegionSelect: (region: Rectangle) => void
    onSetSmoothing: (numSmoothing: number) => void
}

interface ImageViewState {
}

export class ImageView extends React.Component<ImageViewProps, ImageViewState> {
    parentDiv: HTMLDivElement | undefined
    menuDiv: HTMLDivElement | undefined

    imageMap: ImageMap | undefined
    canvas: HTMLCanvasElement | undefined

    voronoiGUI: GUI | undefined

    componentDidMount() {
        this.resizeCanvas();

        if (this.canvas) {
            this.imageMap = new ImageMap(this.canvas, this.props.numBins);
            this.imageMap.addRegionSelectEventListener(this.props.onRegionSelect);
            this.imageMap.setIntrachromosomeView(this.props.intrachromosomeView);
            this.imageMap.updateViewLimits(this.props.view.startX, this.props.view.endX, this.props.view.startY, this.props.view.endY);
            this.imageMap.setChromPair(this.props.sourceChrom, this.props.targetChrom);

            if (this.props.imageData) {
                this.imageMap.updateFromArray(this.props.imageData)
            }
        }
    }


    componentDidUpdate(prevProps: ImageViewProps, prevState: ImageViewState) {
        this.resizeCanvas();

        if (this.imageMap) {
            let requiresUpdate = false;

            if (this.props.colourScale && this.props.scale &&
                (this.props.colourScale != prevProps.colourScale || this.props.scale != prevProps.scale)) {
                //this.imageMap.setColourScale(this.props.colourScale)
                //this.imageMap.setScale(this.props.scale)

                requiresUpdate = true;
            }
            if (this.props.view != prevProps.view) {
                this.imageMap.updateViewLimits(this.props.view.startX, this.props.view.endX, this.props.view.startY, this.props.view.endY);
            }
            if (this.props.sourceChrom != prevProps.sourceChrom || this.props.targetChrom != prevProps.targetChrom) {
                this.imageMap.setChromPair(this.props.sourceChrom, this.props.targetChrom);
            }
            if (this.props.intrachromosomeView != prevProps.intrachromosomeView) {
                this.imageMap.setIntrachromosomeView(this.props.intrachromosomeView);
                this.resizeCanvas();
            }
            if (this.props.imageData != prevProps.imageData && this.props.imageData) {
                // Don't need to explicitly update as setVoronoi redraws the voronoi anyway
                requiresUpdate = false;

                this.imageMap.updateFromArray(this.props.imageData)
            }

            /*if (requiresUpdate) {
                this.voronoiPlot.redrawVoronoi();
            }*/


            this.imageMap.redraw();
        }

        this.positionMenu();
    }

    positionMenu() {
        // Make sure that the menu is always at the top right of the canvas
        if (this.menuDiv && this.voronoiGUI && this.canvas) {
            let canvasPosition = this.canvas.getBoundingClientRect();
            let menuPosition = this.voronoiGUI.domElement.getBoundingClientRect();

            this.menuDiv.style.position = 'absolute';
            this.menuDiv.style.left = ((canvasPosition.left + canvasPosition.width) - menuPosition.width) + 'px';
            this.menuDiv.style.top = (canvasPosition.top + window.scrollY) + 'px';
        }
    }

    resizeCanvas() {
        if (this.canvas && this.parentDiv) {
            let parentPosition = this.parentDiv.getBoundingClientRect();
            let newWidth = parentPosition.width;
            let newHeight = parentPosition.width;

            if (this.props.intrachromosomeView) {
                newHeight = parentPosition.width * 0.5;
            }

            if (this.canvas.width != newWidth || this.canvas.height != newHeight) {
                this.canvas.width = newWidth;
                this.canvas.height = newHeight;

                this.parentDiv.style.height = newHeight + "px";
            }
        }

        this.positionMenu();
    }

    render() {
        return (
            <div ref={(parentDiv: HTMLDivElement) => this.parentDiv = parentDiv} style={{ width: "100%", height: "100%" }} >
                <div ref={(menuDiv: HTMLDivElement) => this.menuDiv = menuDiv}></div>
                <canvas ref={(canvas: HTMLCanvasElement) => this.canvas = canvas} />
            </div>
        )
    }
}