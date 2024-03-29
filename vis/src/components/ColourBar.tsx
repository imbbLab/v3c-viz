import d3 = require("d3");
import React = require("react");
import { SVGContext } from "../canvas2svg";
import { MinMax } from "../voronoi";

export class Histogram {
    minMax: MinMax
    binWidth: number

    histogram: Uint32Array

    transform: (value: number) => number;

    constructor(numBins: number, minMax: MinMax, transform: (value: number) => number) {
        this.minMax = minMax;
        this.histogram = new Uint32Array(numBins);
        this.transform = transform;

        this.binWidth = (minMax.Max - minMax.Min) / numBins;
    }

    maxCount(): number {
        let max = 0;

        for (let i = 0; i < this.histogram.length; i++) {
            if (this.histogram[i] > max) {
                max = this.histogram[i];
            }
        }

        return max;
    }
}

interface ColourBarProps {
    scale: d3.ScaleQuantize<number, never>
    colourScale: d3.ScaleContinuousNumeric<string, string, never>

    //histogram: (numBins: number) => Histogram | null
    histogram: Histogram | null

    height: number;
    width: number;

    onScaleChange: (scale: d3.ScaleQuantize<number, never>) => void
}

interface ColourBarState {
    colourDomain: number[];
}

export class ColourBar extends React.Component<ColourBarProps, ColourBarState> {

    constructor(props: ColourBarProps) {
        super(props);

        this.state = {
            colourDomain: props.colourScale.domain()
        }
    }

    canvas: HTMLCanvasElement | undefined

    componentDidMount() {
        if (this.canvas) {
            // Remove the context menu so that we can right click in peace
            this.canvas.oncontextmenu = function (e) { e.preventDefault(); e.stopPropagation(); }
            this.canvas.addEventListener('mousedown', (event: MouseEvent) => {
                if (!this.canvas || !this.props.histogram) {
                    return;
                }

                var rect = this.canvas.getBoundingClientRect();
                let x = event.clientX - rect.left - 5;
                let y = event.clientY - rect.top

                if (x < 0) {
                    x = 0;
                }
                if (x > (this.props.width - 10)) {
                    x = this.props.width - 10;
                }

                let [minScale, maxScale] = this.props.scale.domain();

                if (event.button == 0) {
                    minScale = this.props.histogram.binWidth * x + this.props.histogram.minMax.Min;
                } else {
                    maxScale = this.props.histogram.binWidth * x + this.props.histogram.minMax.Min;
                }

                this.setState({ colourDomain: [minScale, maxScale] })
            });

            let ctx = this.canvas.getContext("2d");
            if (ctx) {
                this.renderColourBar(ctx, this.props.width, this.props.height);
            }
        }
    }

    componentDidUpdate(prevProps: ColourBarProps, prevState: ColourBarState) {
        if (this.canvas && this.canvas.width != this.props.width) {
            this.canvas.width = this.props.width;

            let ctx = this.canvas.getContext("2d");
            if (ctx) {
                this.renderColourBar(ctx, this.props.width, this.props.height);
            }
        }

        if (prevProps.scale != this.props.scale || prevProps.colourScale != this.props.colourScale || prevProps.histogram != this.props.histogram) {
            if (this.canvas) {
                let ctx = this.canvas.getContext("2d");
                if (ctx) {
                    this.renderColourBar(ctx, this.props.width, this.props.height);
                }
            }
        }

        if (this.state.colourDomain != prevState.colourDomain) {
            this.props.scale.domain(this.state.colourDomain);
            this.props.onScaleChange(this.props.scale);

            if (this.canvas) {
                let ctx = this.canvas.getContext("2d");
                if (ctx) {
                    this.renderColourBar(ctx, this.props.width, this.props.height);
                }
            }
        }
    }

    renderColourBar(ctx: CanvasRenderingContext2D | SVGContext, width: number, height: number) {
        if (!ctx) {
            return;
        }


        ctx.clearRect(0, 0, width, height)

        let histogramY = height - 10

        let histogram = this.props.histogram;

        // If there is no data loaded, then we don't need to draw the histogram
        if (!histogram) {
            return;
        }
        let bins = histogram.histogram;

        //this.scale = d3.scaleQuantize()
        //    .range(d3.range(this.colours))
        //    .domain([histogram.minMax.Min, histogram.minMax.Max]);

        let maxBin = histogram.maxCount();

        for (let i = 0; i < bins.length; i++) {
            ctx.strokeStyle = 'rgb(0, 0, 0)'
            ctx.beginPath();
            ctx.moveTo(i + 5, histogramY);
            ctx.lineTo(i + 5, histogramY - (Math.log(bins[i]) / Math.log(maxBin) * histogramY))
            //colourCanvasCTX.lineTo(i, histogramY - (areaBins[i] / maxBin * colourCanvas.height))
            ctx.stroke();

            ctx.strokeStyle = this.props.colourScale(this.props.scale(histogram.binWidth * i + histogram.minMax.Min))
            ctx.beginPath();
            ctx.moveTo(i + 5, height);
            ctx.lineTo(i + 5, histogramY)
            ctx.stroke();
        }

        let [minScale, maxScale] = this.props.scale.domain();

        ctx.strokeStyle = 'rgb(0, 0, 0)'
        let minScaleX = (minScale - histogram.minMax.Min) / histogram.binWidth + 5
        ctx.beginPath();
        ctx.moveTo(minScaleX, histogramY);
        ctx.lineTo(minScaleX - 5, height);
        ctx.lineTo(minScaleX + 5, height);
        ctx.fill();
        let maxScaleX = (maxScale - histogram.minMax.Min) / histogram.binWidth + 5
        ctx.beginPath();
        ctx.moveTo(maxScaleX, histogramY);
        ctx.lineTo(maxScaleX - 5, height);
        ctx.lineTo(maxScaleX + 5, height);
        ctx.fill();
    }

    render() {
        return (
            <div> {/* id="voronoi-colour-controls" style={{ position: "absolute", left: "0px", top: "0px" }}*/}
                <canvas ref={(canvas: HTMLCanvasElement) => this.canvas = canvas} width={this.props.width} height={this.props.height}></canvas>
            </div>
        )
    }
}