import React = require("react");
import { Chromosome, Locus } from "../chromosome";
import { GenomeDetails } from "../genome";
import * as igv from 'igv';
import { UploadedTrack } from "./menu";


export interface ViewRequest {
    dimension: "x" | "y"
    locus: Locus
}

interface IGViewerProps {
    id: string;
    className?: string;
    dimension: "x" | "y"
    browserOptions: igv.IIGVBrowserOptions

    tracks: UploadedTrack[]

    requestViewUpdate: (request: ViewRequest) => void;
}

interface IGViewerState {
    genome: GenomeDetails,

    sourceChrom: Chromosome,
    srcStart: number,
    srcEnd: number,

    targetChrom: Chromosome,
    tarStart: number,
    tarEnd: number
}

export class IGViewer extends React.Component<IGViewerProps, IGViewerState> {
    div: HTMLDivElement | undefined;
    browser: igv.Browser | undefined;

    constructor(props: IGViewerProps) {
        super(props);
    }

    getLocus(): Locus {
        if (!this.browser) {
            return { chr: "", start: 0, end: 0 }
        }

        let value = this.browser.$searchInput.val(); //this.props.browserOptions.locus;//
        if (value) {
            let searchValue = value.toString();
            let parts = searchValue.split(':');
            let chrParts = parts[1].split('-');

            return { chr: parts[0], start: parseInt(chrParts[0].replaceAll(',', '')), end: parseInt(chrParts[1].replaceAll(',', '')) };
        }

        return { chr: "", start: 0, end: 0 }
    }

    addTrack(track: UploadedTrack) {
        if (!this.browser) {
            return;
        }

        const extension = track.filename.split('.').pop();
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

        this.browser.loadTrack({
            type: type,
            format: format,
            //sourceType: "file",
            url: track.location,
            name: track.filename
        })
    }

    componentDidMount() {
        let self = this;

        if (this.div) {
            var promise: Promise<igv.Browser> = igv.createBrowser(this.div, this.props.browserOptions);
            promise.then(belowBrowser => {
                self.browser = belowBrowser;

                // Make sure that the correct locus is set
                self.browser.search(self.props.browserOptions.locus);

                // Override the method for updating search widget when resizing
                self.browser._updateLocusSearchWidget = self.browser.updateLocusSearchWidget;
                self.browser.updateLocusSearchWidget = function (referenceFrameList: igv.ReferenceFrame[]): void {
                    self.browser!._updateLocusSearchWidget(referenceFrameList);

                    self.props.requestViewUpdate({ dimension: self.props.dimension, locus: self.getLocus() })

                }

                for (let track of self.props.tracks) {
                    self.addTrack(track)
                }
            });
        }
    }

    componentDidUpdate(prevProps: IGViewerProps, prevState: IGViewerState) {
        if (!this.browser) {
            return;
        }

        if (prevProps.browserOptions.locus != this.props.browserOptions.locus) {
            this.browser.search(this.props.browserOptions.locus);
        }

        if (prevProps.tracks != this.props.tracks) {
            // Only add new tracks
            let difference = this.props.tracks.filter(x => !prevProps.tracks.includes(x));

            for (let track of difference) {
                this.addTrack(track)
            }
        }
    }

    refresh() {
        if (this.browser) {
            this.browser.search(this.props.browserOptions.locus);
        }
    }

    setSize(size: number) {
        let igvRootDivs = document.getElementsByClassName('igv-root-div') as HTMLCollectionOf<HTMLDivElement>;
        for (let rootDiv of igvRootDivs) {
            rootDiv.style.width = (size) + "px";
        }

        let viewports = document.getElementsByClassName('igv-viewport') as HTMLCollectionOf<HTMLDivElement>;
        for (let viewport of viewports) {
            viewport.style.width = (size) + "px";
        }

        let tracks = document.getElementsByClassName('igv-track') as HTMLCollectionOf<HTMLDivElement>;
        for (let track of tracks) {
            track.style.width = (size) + "px";
        }

        //let canvases = <HTMLCollectionOf<HTMLCanvasElement>>document.getElementsByClassName('igv-canvas');
        //for (let canvas of canvases) {
        //    canvas.style.width = (imageMap.axisWidth) + "px";
        //}

        let navBars = document.getElementsByClassName('igv-navbar') as HTMLCollectionOf<HTMLDivElement>;
        for (let navBar of navBars) {
            navBar.style.width = (size + 40) + "px";
        }

        let zoomWidgets = document.getElementsByClassName('igv-zoom-widget-900') as HTMLCollectionOf<HTMLDivElement>;
        for (let zoomWidget of zoomWidgets) {
            zoomWidget.style.marginRight = 5 + "px";
        }

        if (this.browser) {
            for (let trackView of this.browser.trackViews) {
                trackView.updateViews(true);
            }
        }
    }

    render() {
        return (
            <div id={this.props.id} className={"gene-browser " + this.props.className} ref={(div: HTMLDivElement) => this.div = div} />
        )
    }
}