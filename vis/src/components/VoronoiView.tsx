import React = require("react");
import { Rectangle } from "../axis";
import { Voronoi } from "../voronoi";
import { VoronoiPlot } from "../voronoiPlot";

interface VoronoiViewProps {
    voronoi: Voronoi | null

    scale: d3.ScaleQuantize<number, never> | null
    colourScale: d3.ScaleContinuousNumeric<string, string, never> | null

    onRegionSelect: (region: Rectangle) => void
}

interface VoronoiViewState {
}

export class VoronoiView extends React.Component<VoronoiViewProps, VoronoiViewState> {
    voronoiPlot: VoronoiPlot | undefined
    canvas: HTMLCanvasElement | undefined

    componentDidMount() {
        this.resizeCanvas();

        if (this.canvas) {
            this.voronoiPlot = new VoronoiPlot(this.canvas);
            this.voronoiPlot.addRegionSelectEventListener(this.props.onRegionSelect);

            if (this.props.colourScale && this.props.scale) {
                this.voronoiPlot.setColourScale(this.props.colourScale)
                this.voronoiPlot.setScale(this.props.scale)
            }
            if (this.props.voronoi) {
                this.voronoiPlot.setVoronoi(this.props.voronoi);
            }
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
            if (this.props.voronoi != prevProps.voronoi && this.props.voronoi) {
                // Don't need to explicitly update as setVoronoi redraws the voronoi anyway
                requiresUpdate = false;
                this.voronoiPlot.setVoronoi(this.props.voronoi);
            }

            if (requiresUpdate) {
                this.voronoiPlot.redrawVoronoi();
            }
        }
    }

    resizeCanvas() {
        if (this.canvas && (this.canvas.width != this.canvas.offsetWidth || this.canvas.height != this.canvas.offsetHeight)) {
            this.canvas.width = this.canvas.offsetWidth;
            this.canvas.height = this.canvas.offsetHeight;
        }
    }

    render() {
        return (
            <canvas style={{ width: "100%", height: "100%" }} ref={(canvas: HTMLCanvasElement) => this.canvas = canvas} />
        )
    }
}