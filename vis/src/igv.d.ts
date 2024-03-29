// igv.d.ts
declare module 'igv' {
  //////////////////////////
  // browser.js
  //////////////////////////
  export class Browser {
    config: any
    guid: any
    namespace: string

    parent: HTMLElement

    $root: JQuery
    $searchInput: JQuery
    trackContainer: any

    trackViews: TrackView[]
    trackLabelsVisible: boolean
    isCenterGuideVisible: boolean

    sampleNamesVisible: boolean

    cursorGuideVisible: boolean
    constants: any

    eventHandlers: any

    $spinner: JQuery
    $trackContainer: JQuery

    dragObject: IGVObject
    isScrolling: boolean
    vpMouseDown: IGVMouseEvent

    referenceFrameList: ReferenceFrame[]

    constructor(options: any, parentDiv: HTMLElement)
    initialize(options: any): void;
    getSampleNameViewportWidth(): number
    startSpinner(): void
    stopSpinner(): void
    isMultiLocusMode(): boolean
    addTrackToFactory(name: string, track: Track): void
    isMultiLocusWholeGenomeView(): boolean

    toSVG(): string // Promise<string>
    saveSVGtoFile(): Promise<null>

    loadSession(options: any): Promise<any>
    loadSessionObject(session: any): Promise<null>

    loadGenome(idOrConfig: any, initialLocus: string, update: boolean): Promise<null>

    updateUIWithReferenceFrameListChange(referenceFrameList: any): void
    setTrackLabelName(trackView: TrackView, name: string): void

    hideTrackLabels(): void
    showTrackLabels(): void
    hideCursorGuide(): void
    showCursorGuide(): void
    setCustomCursorGuideMouseHandler(mouseHandler: any): void
    hideCenterGuide(): void
    showCenterGuide(): void

    loadTrackList(configList: any): Promise<any>
    loadROI(config: any): Promise<any>
    removeROI(roiToRemove: any): void
    clearROIs(): void
    loadTrack(config: any, noSpinner?: boolean): Promise<any>
    createTrack(config: any): Promise<any>
    addTrack(track: Track): Promise<any>
    reorderTracks(): void
    getTrackOrder(): any
    removeTrackByName(name: string): void
    removeTrack(track: Track): void
    removeAllTracks(): void
    findTracks(property: any, value: any): any
    setTrackHeight(newHeight: number): void
    visibilityChange(): Promise<null>

    resize(): Promise<null>

    updateViews(referenceFrame?: any, trackViews?: any, force?: boolean): Promise<null>

    loadInProgress(): boolean
    updateLocusSearchWidget(referenceFrameList: ReferenceFrame[]): void
    _updateLocusSearchWidget(referenceFrameList: ReferenceFrame[]): void

    getViewportContainerWidth(): number
    computeViewportWidth(referenceFrameListLength: any, viewportContainerWidth: number): number
    getViewportWidth(): number
    minimumBases(): any
    updateZoomSlider($slider: any): any
    zoom(scaleFactor: number): void
    zoomIn(): void
    zoomOut(): void
    zoomWithRangePercentage(percentage: number): void
    zoomWithScaleFactor(scaleFactor: number, centerBPOrUndefined: any, viewportOrUndefined: Viewport | undefined): void
    presentSplitScreenMultiLocusPanel(alignment: any, leftMatePairReferenceFrame: any): void
    selectMultiLocusPanelWithReferenceFrame(referenceFrame: ReferenceFrame): void
    removeMultiLocusPanelWithReferenceFrame(referenceFrame: ReferenceFrame, doResize: boolean): void
    addMultiLocusPanelWithReferenceFrameIndex(referenceFrame: ReferenceFrame, index: number, viewportWidth: number): void
    getViewportWithGUID(guid: any): number

    goto(chr: string, start: number, end: number): Promise<any>
    search(string: string, init?: boolean): Promise<any>
    loadSampleInformation(url: any): void

    on(eventName: string, fn: any): void
    un(eventName: string, fn: any): void
    off(eventName: string, fn: any): void

    fireEvent(eventName: string, args?: any, thisObj?: any): void

    dispose(): void
    toJSON(): any

    compressedSession(): string
    sessionURL(): string
    currentLoci(): any

    mouseDownOnViewport(e: MouseEvent, viewport: any): void
    cancelTrackPan(): void
    startTrackDrag(trackView: any): void
    updateTrackDrag(dragDestination: any): void
    endTrackDrag(): void
    addMouseHandlers(): void

    getDriveFileInfo(googleDriveURL: any): Promise<any>

    static uncompressSession(url: any): string
  }

  export function toggleTrackLabels(trackViews: any, isVisible: boolean): void
  export function isLocusString(browser: Browser, locus: any): boolean
  export function searchWebService(browser: Browser, locus: any, searchConfig: any): Promise<any>


  //////////////////////////
  // trackView.js
  //////////////////////////
  export class TrackView {
    browser: Browser
    track: Track

    trackDiv: HTMLDivElement

    namespace: string

    $viewportContainer: JQuery
    $axis: JQuery

    viewports: Viewport[]

    constructor(browser: Browser, $container: JQuery, track: Track)

    populateViewportContainer(browser: Browser, referenceFrameList: any): void
    renderSVGContext(context: SVGRenderingContext2D, options: any): void
    attachScrollbar($track: JQuery, $viewportContainer: JQuery, viewports: any): void
    removeViewportForReferenceFrame(referenceFrame: any): void
    updateViewportForMultiLocus(): void
    createAxis($viewportContainer: JQuery): void
    dataRange(): any
    setDataRange(min: number, max: number): void
    presentColorPicker(option: any): void
    setTrackHeight(newHeight: number, force: boolean): void

    isLoading(): boolean
    resize(viewportWidth: number): void
    repaintViews(): void
    repaintSamples(): void

    updateViews(force: boolean): Promise<null>
    getInViewFeatures(force: boolean): Promise<any>
    checkContentHeight(): void
    adjustTrackHeight(): void
    resizeAxisCanvas($axis: JQuery, width: number, height: number): void
    attachDragWidget($track: JQuery, $viewportContainer: JQuery): void
    viewportsToReload(force: boolean): any
    dispose(): void
    scrollBy(delta: number): void
    appendRightHandGutter($parent: JQuery): void
    createTrackGearPopup($parent: JQuery): void
    static computeViewportWidth(browser: Browser, viewportContainerWidth: number): void
  }

  //export function renderSVGAxis(context, track, axisCanvas, deltaX, deltaY);
  export function setSampleNameViewportVisibility(browser: Browser): void
  export function emptyViewportContainers(trackViews: TrackView[]): void
  export function updateViewportShims(viewports: any, $viewportContainer: JQuery): void
  //export function documentOffset(el)
  export function maxViewportContentHeight(viewports: any): void


  //////////////////////////
  // track
  //////////////////////////

  export abstract class Track {
    type: string
    browser: Browser
    removable: boolean
    config: any
    name: string
    id: string
    sequenceType: string
    height: number
    disableButtons: boolean
    order: number
    ignoreTrackMenu: boolean

    reversed: boolean
    frameTranslate: boolean
    trackView: TrackView

    constructor(config: any, browser: Browser)
    draw(drawConfiguration: any): void
    computePixelHeight(ignore: boolean): number
  }

  export class SequenceTrack extends Track {
    constructor(config: any, browser: Browser)

    menuItemList(): any
    translateSequence(seq: any): any
    getFeatures(chr: string, start: number, end: number, bpPerPixel: number): Promise<any>
    supportsWholeGenome(): boolean
    fillColor(index: number): any
  }

  //////////////////////////
  // viewportBase.js
  //////////////////////////
  export abstract class ViewportBase {
    guid: any
    trackView: TrackView
    referenceFrame: ReferenceFrame

    browser: Browser

    $viewport: JQuery
    $content: JQuery
    contentDiv: HTMLDivElement

    $canvas: JQuery

    canvas: HTMLCanvasElement
    ctx: CanvasRenderingContext2D

    messageDiv: HTMLDivElement

    constructor(trackView: TrackView, $viewportContainer: JQuery, referenceFrame: ReferenceFrame, width: number)
    initializationHelper(): void
    showMessage(message: string): void
    hideMessage(message: string): void
    shift(): void
    setTop(contentTop: number): void

    loadFeatures(): Promise<any>
    repaint(): Promise<any>
    draw(drawConfiguration: any, features?: any, roiFeatures?: any): void
    checkContentHeight(): void
    getContentHeight(): number
    setContentHeight(contentHeight: number): void
    isLoading(): boolean

    saveSVG(): void
    renderSVGContext(context: SVGRenderingContext2D, offset: any): void
    drawSVGWithContext(context: SVGRenderingContext2D): void
    drawSVGWithContect(context: SVGRenderingContext2D): void

    isVisible(): boolean
    setWidth(width: number): void
    getWidth(): number
    getContentTop(): number
    containsPosition(chr: any, position: any): boolean
    dispose(): void
  }

  export class Viewport extends ViewportBase {
    setTrackLabel(label: string): void
    startSpinner(): void
    stopSpinner(): void
    checkZoomIn(): void
    saveImage(): void

    renderTrackLabelSVG(context: SVGRenderingContext2D): void
    getCachedFeatures(): any
    createZoomInNotice($parent: JQuery): void
    viewIsReady(): boolean
    addMouseHandlers(): void
  }


  //////////////////////////
  // rulerViewport.js
  //////////////////////////
  export class RulerViewport extends Viewport {

  }


  export interface ReferenceFrame {
    chr: string;
    start: string;
    end: string;
    label: string;

    shiftPixels(x: number, y: number): boolean
  }

  export interface IIGVBrowserOptions {
    /**
     *  Zoom-in is clamped to this value
     *  @default 40
     */
    minimumBases?: number;
    /**
     * Object defining reference sequence
     */
    reference: IReference;
    /**
     * if true, show a whole-genome karyotype view
     * @default false
     */
    showKaryo?: boolean;
    /**
     * If true, show basic navigation controls (search, zoom in, zoom out).
     * @default true
     */
    showNavigation?: boolean;
    /**
     * If true, show a genomic ruler track
     * @default true
     */
    showRuler?: boolean;
    /**
     * Array of configuration objects defining tracks initially displayed when app launches.
     * @default []
     */
    tracks?: ITrack[];
    /**
     *  Embedded object defining default settings for specific track types (see table below).
     */
    trackDefaults?: ITrackDefaults;
    /**
     * Initial genomic location
     */
    locus: string;
    /**
     * Distance (in bp) to pad sides of gene when navigating.
     * @default 1000
     */
    flanking?: number;

    /**
     * Array of colors for the track color picker's
     * @default palette (e.g. ["#00A0B0", "#6A4A3C", "#CC333F", "#EB6841"])
     */
    palette?: string[];
    /**
     * Object defining a web service for supporting search by gene or other annotation. See object details below. Optional
     * @default null
     */
    search?: ISearch;

    /**
     * Google API key. Optional
     */
    apiKey?: string;
    /**
     * Maximum between mouse clicks in milliseconds to trigger a double-click
     * @default 500
     */
    doubleClickDelay?: number;
  }

  export interface IReference {
    /**
     * UCSC or other id string. Optional but recommended.
     * FASTA, index, and cytoband URLs can be omitted for genomes in this list.
     *  id = "hg38"
     *   id = "hg19"
     *   id = "hg18"
     *   id = "mm10"
     *
     */
    id: string;
    /**
     *  URL to a FASTA file. Required if id is not in the hosted genomes list below
     */
    fastaURL?: string;
    /**
     *  URL to a FASTA index (.fai file). Optional  <fastaURL>.fai
     *  @default <fastaUrl>.fai
     */
    indexURL?: string;
    /**
     * URL to a cytoband ideogram file in UCSC format. Optional
     */
    cytobandURL?: string;
    /**
     * Flag indicating if the FASTA is indexed. Optional  true
     * @default true
     */
    indexed?: boolean;
  }

  /**
   * The search object defines a webservice for fetching genomic location given a gene name or other symbol. The service should return a JSON object with the following structure. The results array is an array of objects with a chromosome, start, and end field. The names of these fields are specified in the configuration object.
   * <code>{  <resultsField> : <array of results> }</code>
   */
  export interface ISearch {
    /**
     * URL to search service. The URL should include the string $FEATURE$. This string will be replaced by the symbol being queried.
     */
    url: string;
    /**
     * JSON field name for property containing the array of results.
     * @default Treats the response as an array of results.
     */
    resultsField?: string;
    /**
     * Indicates genomic coordinate convention used. Possible values are 0 and 1  1
     * @default 1;
     */
    coords?: number;
    /**
     * JSON field name for the chromosome property  chromosome
     * @default chromosome
     */
    chromosomeField?: string;
    /**
     *  JSON field name for the start position property
     *  @default start
     */
    startField?: string;
    /**
     *  JSON field name for the end position property
     *  @default end
     */
    endField?: string;
  }


  export interface ITrackDefaults {
    bam: {
      coverageThreshold?: number;
      coverageQualityWeight?: boolean;
      [key: string]: any;
    };

    [key: string]: any;
  }

  export function maxViewportContentHeight(viewports: Viewport[]): number;

  export interface TrackScrollbar {
    namespace: string

    $innerScroll: JQuery
    $outerScroll: JQuery
    $viewportContainer: JQuery
    viewports: Viewport[]

    moveScrollerBy(delta: number): void
    moveScrollerTo(y: number): void
    dispose(): void
    update(): void
  }

  export interface TrackView {
    namespace: string
    viewports: Viewport[]
    $trackDragScrim: JQuery
    $trackManipulationHandle: JQuery
    $viewportContainer: JQuery

    controlCanvas: HTMLCanvasElement

    axisCanvas: HTMLCanvasElement
    track: Track

    scrollbar: TrackScrollbar

    scrollBy(amount: number): void
    resize(size: number): void
    updateViews(force: boolean): Promise<null>

    renderSVGContext(ctx: SVGRenderingContext2D, options: any): void
    draw(drawConfiguration: any, features: any, roiFeatures: any): void
  }

  // export interface Viewport {
  //   enableClick: boolean;
  //   $viewport: JQuery
  //   referenceFrame: ReferenceFrame
  //   trackView: TrackView
  //   canvas: HTMLCanvasElement

  //   renderSVGContext(ctx: SVGRenderingContext2D, options: any): void

  // }

  export interface IGVMouseEvent {
    r: number
    viewport: Viewport,
    lastMouseX: number,
    mouseDownX: number,
    lastMouseY: number,
    mouseDownY: number,
    referenceFrame: ReferenceFrame
  }

  interface Constants {
    scrollThreshold: number
    dragThreshold: number
  }

  export interface IGVObject {

  }


  export interface IGVBrowser {
    $root: JQuery
    $searchInput: JQuery

    constants: Constants
    trackContainer: HTMLDivElement;
    trackViews: TrackView[]

    referenceFrameList: ReferenceFrame[]

    dragObject: IGVObject
    isScrolling: boolean
    vpMouseDown: IGVMouseEvent

    loadInProgress(): boolean;
    loadTrack(config: ITrack): Promise<ITrack>;

    toSVG(): string // Promise<string>

    fireEvent(event: string): void
    updateLocusSearchWidget(referenceFrameList: ReferenceFrame[]): void
    _updateLocusSearchWidget(referenceFrameList: ReferenceFrame[]): void
    updateViews(): void
    resize(): Promise<null>

    mouseDownOnViewport(event: JQuery.MouseDownEvent, viewport: Viewport): void

    /**
     * Search by annotation symbol
     * @param {string} locusOrGene
     */
    search(locusOrGene: string): Promise<ReferenceFrame[]>;

    /**
     * Zoom in by a factor of 2
     */
    zoomIn(): void;

    /**
     * Zoom out by a factor of 2
     */
    zoomOut(): void;

    on(name: string, callback: Function): void;
  }

  export interface ICommonTrack {
    /**
     * Track type  No default. If not specified, type is inferred from file format
     */
    type?: 'annotation' | 'wig' | 'alignment' | 'variant' | 'seg';
    /**
     * Type of data source. Valid values are "file", "gcs" for Google Cloud Storage, and "ga4gh" for the Global Alliance API  "file"
     * @default file
     */
    sourceType?: 'file' | 'gcs' | 'ga4gh';
    /**
     * File format  No default. If not specified format is inferred from file name extension
     */
    format?: string;
    /**
     * Display name (label). Required
     */
    name: string;
    /**
     * URL to the track data resource, such as a file or webservice. Required
     */
    url: string;
    /**
     * URL to a file index, such as a BAM .bai, Tabix .tbi, or Tribble .idx file.
     */
    indexURL?: string;
    /**
     * Flag used to indicate if a file is indexed or not. If indexURL is provided this flag is redundant, its main purpose is to indicate that a file is not indexed.
     */
    indexed?: boolean;
    /**
     * Integer value specifying relative order of track position on the screen. To pin a track to the bottom use Number.MAX_VALUE. If no order is specified, tracks appear in order of their addition.
     */
    order?: number;
    /**
     * CSS color value for track features, e.g. "#ff0000" or "rgb(100,0,100)"
     */
    color?: string;
    /**
     * Initial height of track viewport in pixels
     * @default 50
     */
    height?: number;
    /**
     * If true, then track height is adjusted dynamically, within the bounds set by minHeight and maxHeight, to accomdodate features in view
     * @default true;
     */
    autoHeight?: boolean;
    /**
     * Minimum height of track in pixels  50
     * @default 50
     */
    minHeight?: number;
    /**
     * Maximum height of track in pixels
     * @default 500
     */
    maxHeight?: number;
    /**
     * Maximum window size in base pairs for which indexed annotations or variants are displayed  1 MB for variants, 30 KB for alignments, whole chromosome for other track types
     */
    visibilityWindow?: number;


    paintAxis?: any
    id?: string
  }



  export interface IAnnotationTrack extends ICommonTrack {
    type?: 'annotation';
    /**
     * Annotation display mode, one of "COLLAPSED", "EXPANDED", "SQUISHED"  "COLLAPSED"
     * @default COLLAPSED
     */
    displayMode?: 'COLLAPSED' | 'EXPANDED' | 'SQUISHED';
    /**
     * height of each row of features in "EXPANDED" mode
     * @default 30
     */
    expandedRowHeight?: number;
    /**
     * Height of each row of features in "SQUISHED" mode
     * @default 15
     */
    squishedRowHeight?: number;

    /**
     * For GFF/GTF file formats. Name of column 9 property to be used for feature label
     * @default Name
     */
    nameField?: string;
    /**
     * Maximum number of rows of features to display
     * @default 500
     */
    maxRows?: number;
    /**
     * If true, feature names for this track can be searched for. Use this option with caution, it is memory intensive. This option should will not work with indexed tracks
     * @default false
     */
    searchable?: boolean;
  }

  export interface IWigTrack extends ICommonTrack {
    type?: 'wig';
    /**
     * Autoscale track to maximum value in view
     */
    autoscale?: boolean;
    /**
     * Sets the minimum value for the data (y-axis) scale. Usually zero.
     * @default 0
     */
    min?: number;
    /**
     * Sets the maximum value for the data (y-axis) scale. This value is ignored if autoscale = true
     * No default
     */
    max?: number;
  }

  export interface IAlignmentTrack extends ICommonTrack {
    type?: 'alignment';
    /**
     * If true, paired reads are drawn as a single alignment.
     * @default false
     */
    viewAsPairs?: boolean;
    /**
     * if false, mate information in paired reads is ignored during downsampling and the 'View as Pairs' option is removed from the alignment track menu.
     * @default true
     */
    pairsSupported?: boolean;
    /**
     * Color of line representing a deletion
     * @default "black";
     */
    deletionColor?: string;
    /**
     * Color of line representing a skipped region (e.g. splice junction)
     * @default "rgb(150, 170, 170)"
     */
    skippedColor?: string;
    /**
     * Color of marker for insertions
     * @default "rgb(138, 94, 161)";
     */
    insertionColor?: string;
    /**
     *  Color of alignment on negative strand. Applicable if colorBy = "strand"
     *  @default "rgba(150, 150, 230, 0.75)";
     */
    negStrandColor?: string;
    /**
     * Color of alignment or position strand. Applicable if colorBy = "strand"
     * @default "rgba(230, 150, 150, 0.75)";
     */
    posStrandColor?: string;
    /**
     * Alignment color option: one of "none", "strand", "firstInPairStrand", or "tag". Specify tag with colorByTag
     * @default "none"
     */
    colorBy?: 'none' | 'strand' | 'firstInPairStrand' | 'tag';
    /**
     *  Specific tag to color alignment by.
     */
    colorByTag?: string;
    /**
     * Specifies a special tag that explicitly encodes an r,g,b color value. Default value is "YC". If "YC" does not encode an r,g,b color value set bamColorTag to null. Must also set "colorBy" to "tag" to enable this option.
     * @defaut 'YC'
     */
    bamColorTag?: string;
    /**
     *  Window (bucket) size for alignment downsampling in base pairs
     *  @default 100
     */
    samplingWindowSize?: number;
    /**
     * Number of alignments to keep per bucket. WARNING: Setting this sampling depth to a high value will likely freeze the browser when viewing areas of deep coverage.
     * @default 50.
     */
    samplingDepth?: number;
    /**
     * Maximum number of rows of alignments to display. Note: due to a limit on canvas height the maximum value for this parameter is ~2300 at the default row height of 14.
     * @default 1000
     */
    maxRows?: number;
    /**
     * Height in pixels of an alignment row when in expanded mode
     * @defalt 14
     */
    alignmentRowHeight?: number;
    /**
     * Alignment filter object.
     */
    filter?: IAlignmentFilter;
  }

  export interface IGA4GHAlignemntTrack extends IAlignmentTrack {
    sourceType: 'ga4gh';
    /**
     * URL to the ga4gh endpoint (e.g. https://www.googleapis.com/genomics/v1beta2)
     */
    url: string;
    /**
     * ID of the read group set represented by this track. (e.g. 'CMvnhpKTFhCjz9_25e_lCw')
     */
    readGroupSetIds: string;
  }

  export interface IAlignmentFilter {

    /**
     * filter alignments marked as failing vendor quality checks (bit 0x200)
     * @default true
     */
    vendorFailed?: boolean;
    /**
     * filter alignments marked as a duplicate (bit 0x400)
     * @default true
     */
    duplicates?: boolean;
    /**
     * filter alignments marked secondary (bit 0x100)
     * @default false
     */
    secondary?: boolean;
    /**
     * filter alignments marked as supplmentary (bit 0x800)
     * @default false
     */
    supplementary?: boolean;
    /**
     * filter alignments with mapping quality < supplied value (a number)
     * @default 0
     */
    mqThreshold?: number;
  }

  export interface IVariantTrack extends ICommonTrack {
    /**
     * COLLAPSED => show variants only, SQUISHED and EXPANDED => show calls.
     * @default EXPANDED
     */
    displayMode?: 'COLLAPSED' | 'EXPANDED' | 'SQUISHED';
    /**
     * CSS color used to represent homozygous non-reference calls.
     * @default "rgb(17,248,254)"
     */
    homvarColor?: string;
    /**
     * CSS color used to represent heterozygous calls.
     * @default "rgb(34,12,253)"
     */
    hetvarColor?: string;
    /**
     * CSS color used to represent homozygous reference calls.
     * @default "rgb(200, 200, 200)"
     */
    homrefColor?: string;
  }

  export interface IGA4GHVariantTrack extends IVariantTrack {
    sourceType: 'ga4gh';
    /**
     * URL to the ga4gh endpoint (e.g. https://www.googleapis.com/genomics/v1beta2). Required
     */
    url: string;
    /**
     * ID of the variant set represented by this track. (e.g. '10473108253681171589'). Required
     */
    variantSetId: string;
    /**
     *  Array of GACallSet IDs to include with track. Optional. If omitted, all call sets are included
     */
    callSetIds?: string[];
  }

  export interface ISegmentTrack extends ICommonTrack {
    type?: 'seg';
  }

  export type ITrack = IAlignmentTrack | IVariantTrack | IAnnotationTrack | IGA4GHAlignemntTrack | IGA4GHVariantTrack | IWigTrack | ISegmentTrack;


  export function createBrowser(div: HTMLElement, options: IIGVBrowserOptions): Promise<Browser>;

  export const browser: IGVBrowser;



  type SVGRenderingContext2D = CanvasRenderingContext2D & {
    getSvg(): SVGSVGElement
    getSerializedSvg(fix_named_entities: boolean): string
    //drawImageSvg(image: SVGSVGElement, dx: number, dy: number, dw: number, dh: number): void
  }

  type SVGRenderingOptions = {
    ctx?: CanvasRenderingContext2D
    width?: number
    height?: number
    enableMirroring?: boolean
    document?: Document
  }

  const ctx: { new(options?: SVGRenderingOptions): SVGRenderingContext2D }
}