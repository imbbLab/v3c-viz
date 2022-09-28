import React = require("react");
import GUI from 'lil-gui';
import { Rectangle } from "../axis";
import { Voronoi } from "../voronoi";
import { VoronoiPlot } from "../voronoiPlot";
import { Chromosome } from "../chromosome";
import { View } from "../App";

interface VoronoiViewProps {
    voronoi: Voronoi | null

    view: View

    sourceChrom: Chromosome,
    targetChrom: Chromosome,

    intrachromosomeView: boolean

    scale: d3.ScaleQuantize<number, never> | null
    colourScale: d3.ScaleContinuousNumeric<string, string, never> | null

    onRegionSelect: (region: Rectangle) => void
    onSetSmoothing: (numSmoothing: number) => void
    onSetFilterDistance: (filterDistance: number) => void
}

interface VoronoiViewState {
}

export class VoronoiView extends React.Component<VoronoiViewProps, VoronoiViewState> {
    parentDiv: HTMLDivElement | undefined
    menuDiv: HTMLDivElement | undefined

    voronoiPlot: VoronoiPlot | undefined
    canvas: HTMLCanvasElement | undefined

    voronoiGUI: GUI | undefined

    componentDidMount() {
        this.resizeCanvas();

        if (this.canvas) {
            this.voronoiPlot = new VoronoiPlot(this.canvas);
            //this.voronoiPlot.onAxisSizeChange = this.props.onAxisSizeChange;
            this.voronoiPlot.addRegionSelectEventListener(this.props.onRegionSelect);
            this.voronoiPlot.updateViewLimits(this.props.view.startX, this.props.view.endX, this.props.view.startY, this.props.view.endY);
            this.voronoiPlot.setChromPair(this.props.sourceChrom, this.props.targetChrom);
            this.voronoiPlot.setIntrachromosomeView(this.props.intrachromosomeView);

            if (this.props.colourScale && this.props.scale) {
                this.voronoiPlot.setColourScale(this.props.colourScale)
                this.voronoiPlot.setScale(this.props.scale)
            }
            if (this.props.voronoi) {
                this.voronoiPlot.setVoronoi(this.props.voronoi);
            }

            // Set up the options for voronoi
            this.voronoiGUI = new GUI({ title: "Voronoi Options", autoPlace: false });
            this.menuDiv!.appendChild(this.voronoiGUI.domElement);

            this.voronoiGUI.add(this.voronoiPlot, 'displayVoronoiEdges').name('Display edges').onChange(() => {
                this.voronoiPlot!.drawPolygonsCanvas();
            })
            this.voronoiGUI.add(this.voronoiPlot, 'displayVoronoiPoints').name('Display data').onChange(() => {
                this.voronoiPlot!.drawPolygonsCanvas();
            })
            this.voronoiGUI.add(this.voronoiPlot, 'displayCentroid').name('Display centroid').onChange(() => {
                this.voronoiPlot!.drawPolygonsCanvas();
            })
            this.voronoiGUI.add(this.voronoiPlot, 'dataPointSize', 0, 10, 0.1).name('Point size').onChange(() => {
                this.voronoiPlot!.drawPolygonsCanvas();
            })

            const smoothingMenu = this.voronoiGUI.addFolder('Smoothing');
            smoothingMenu.add(this.voronoiPlot, 'smoothingRepetitions', 0, 20, 1).name('Repetitions').onChange((value: number) => {
                this.props.onSetSmoothing(value)
            })

            const filteringMenu = this.voronoiGUI.addFolder('Filtering');
            filteringMenu.add(this.voronoiPlot, 'filterDistance', 0).name('Filter distance (x-y)').onFinishChange((value: number) => {
                this.props.onSetFilterDistance(value)
            })

            this.voronoiGUI.close();
        }
    }

    componentDidUpdate(prevProps: VoronoiViewProps, prevState: VoronoiViewState) {
        this.resizeCanvas();

        if (this.voronoiPlot) {
            let requiresUpdate = false;

            if (this.props.colourScale && this.props.scale &&
                (this.props.colourScale != prevProps.colourScale || this.props.scale != prevProps.scale)) {
                this.voronoiPlot.setColourScale(this.props.colourScale)
                this.voronoiPlot.setScale(this.props.scale)

                requiresUpdate = true;
            }
            if (this.props.view != prevProps.view) {
                this.voronoiPlot.updateViewLimits(this.props.view.startX, this.props.view.endX, this.props.view.startY, this.props.view.endY);
            }
            if (this.props.sourceChrom != prevProps.sourceChrom || this.props.targetChrom != prevProps.targetChrom) {
                this.voronoiPlot.setChromPair(this.props.sourceChrom, this.props.targetChrom);
            }
            if (this.props.intrachromosomeView != prevProps.intrachromosomeView) {
                this.voronoiPlot.setIntrachromosomeView(this.props.intrachromosomeView);
                this.resizeCanvas();
            }
            if (this.props.voronoi != prevProps.voronoi && this.props.voronoi) {
                // Don't need to explicitly update as setVoronoi redraws the voronoi anyway
                requiresUpdate = false;
                this.voronoiPlot.setVoronoi(this.props.voronoi);
            }

            if (requiresUpdate) {
                this.voronoiPlot.redrawVoronoi();
            }

            this.voronoiPlot.redraw();
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

                if (this.voronoiPlot) {
                    this.voronoiPlot.setDimensions(newWidth, newHeight);
                }
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
