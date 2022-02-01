import { Chromosome, Interaction } from "./chromosome"
import { SVGContext } from "./canvas2svg"
import GUI from "lil-gui";

export interface Coordinate {
    x: number;
    y: number;
}

export class Rectangle {
    min: Coordinate
    max: Coordinate

    constructor(min: Coordinate, max: Coordinate) {
        this.min = min;
        this.max = max;
    }
}

/*export class RegionSelectEvent {
    region: Rectangle

    constructor(region: Rectangle) {
        this.region = region
    } 
}*/


export enum OriginLocation {
    BottomLeft,
    TopLeft
}

export enum YAxisLocation {
    Left,
    Right
}

class ContactOptions {
    contactOpacity: number = 0.7;
    contactEdgeColour: number = 0xc92730;
    edgeWidth: number = 2;
    contactFill: boolean = false;
    contactFillColour: number = 0xc92730;
    contactSize: number = 10;
}

export abstract class Axis {
    originLocation: OriginLocation = OriginLocation.BottomLeft;
    yAxisLocation: YAxisLocation = YAxisLocation.Right;

    doubleClickEventListeners: { (): void }[] = []
    regionSelectEventListeners: { (region: Rectangle): void }[] = []

    canvas: HTMLCanvasElement;
    axisCanvas: HTMLCanvasElement;

    minDataX = 0;
    maxDataX = 1;
    minDataY = 0;
    maxDataY = 1;

    minViewX = 0;
    maxViewX = 1;
    minViewY = 0;
    maxViewY = 1;

    axisOffsetX = 30;
    axisOffsetY = 30;
    marginX = 30;
    marginY = 30;

    numTicks = 5;
    tickDecimalPlaces = 2;

    // Editable contact options
    contactOptions: Map<string, ContactOptions>;

    // Contacts
    interactions: Map<string, Interaction[]>;

    axisWidth: number = 0;
    axisHeight: number = 0;

    mouseDown = false;
    lastMousePos: Coordinate = { x: 0, y: 0 };

    onAxisSizeChange: (() => void) | undefined;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.axisCanvas = document.createElement("canvas");

        this.setDimensions(this.canvas.width, this.canvas.height)

        this.interactions = new Map<string, Interaction[]>();
        this.contactOptions = new Map<string, ContactOptions>();

        /*this.boxesToDraw[0] = new Array<number>(2);
        this.boxesToDraw[0][0] = 804435;
        this.boxesToDraw[0][1] = 969587;*/

        //var canvasBufferContext = <CanvasRenderingContext2D>canvasBuffer.getContext('2d');
        var self = this;

        //Mousemove
        this.canvas.addEventListener('mousemove', function (event: MouseEvent) {
            var mousePos = getMousePos(canvas, event);
            var axisPos = self.getAxisCoord(mousePos);

            //console.log(mousePos)
            //console.log(axisPos)

            var ctx = <CanvasRenderingContext2D>self.canvas.getContext('2d');

            if (axisPos.x >= 0 && axisPos.x <= 1 && axisPos.y >= 0 && axisPos.y <= 1) {
                if (self.mouseDown) {
                    // Reset the image
                    self.drawAxisCanvas();

                    ctx.beginPath();
                    var width = mousePos.x - self.lastMousePos.x;
                    var height = mousePos.y - self.lastMousePos.y;
                    ctx.rect(self.lastMousePos.x, self.lastMousePos.y, width, height);
                    ctx.strokeStyle = 'blue';
                    ctx.lineWidth = 2;
                    ctx.stroke();
                } else {
                    // Reset the image
                    self.drawAxisCanvas();
                }

                // Always draw the box, even when zooming
                let boxHeight = 25;
                let boxWidth = 175;

                let margin = 5;

                let xDiff = self.maxViewX - self.minViewX;
                let yDiff = self.maxViewY - self.minViewY;
                var xPosition: number
                var yPosition: number;

                var displayText = true

                if (self.intrachromosomeView) {
                    xPosition = self.minViewX + ((axisPos.x - axisPos.y) * xDiff)
                    yPosition = self.minViewX + ((axisPos.x + axisPos.y) * xDiff)

                    if (xPosition < self.minViewX || xPosition > self.maxViewX || yPosition < self.minViewX || yPosition > self.maxViewX) {
                        displayText = false
                    }
                } else {
                    xPosition = self.minViewX + axisPos.x * xDiff
                    yPosition = self.minViewY + axisPos.y * yDiff
                }

                if (displayText) {
                    let textLength = Math.floor(Math.log10(xPosition + 1)) + Math.floor(Math.log10(yPosition + 1)) + 4
                    boxWidth = textLength * 8 + margin * 2

                    ctx.fillStyle = "lightblue";
                    ctx.fillRect(mousePos.x + margin, mousePos.y - boxHeight, boxWidth, boxHeight);

                    ctx.font = "15px Arial";
                    ctx.fillStyle = "black";
                    ctx.textBaseline = "middle";
                    ctx.textAlign = "left";
                    ctx.fillText("" + xPosition.toFixed(0) + ", " + yPosition.toFixed(0), mousePos.x + margin * 2, mousePos.y - margin * 2.4);

                    if (!self.mouseDown) {


                        let canvasLocation = self.canvas.getBoundingClientRect();

                        if (self.intrachromosomeView) {
                            let minCanvasX = self.axisOffsetX + (axisPos.x - axisPos.y) * self.axisWidth;
                            let maxCanvasX = self.axisOffsetX + (axisPos.x + axisPos.y) * self.axisWidth;

                            ctx.beginPath();
                            ctx.moveTo(minCanvasX, self.canvas.height - self.axisOffsetY);
                            ctx.lineTo(mousePos.x, mousePos.y);
                            ctx.lineTo(maxCanvasX, self.canvas.height - self.axisOffsetY);
                            ctx.strokeStyle = 'red';
                            ctx.lineWidth = 2;
                            ctx.stroke();

                            let vertline = (<HTMLDivElement>document.getElementById('vertline'))
                            if (vertline) {
                                vertline.style.width = "1px"
                                vertline.style.height = (window.innerHeight - canvasLocation.bottom) + "px";
                                vertline.style.top = (window.pageYOffset + canvasLocation.bottom - self.axisOffsetY) + "px";
                                vertline.style.left = (canvasLocation.left + minCanvasX) + "px";
                            }

                            let horline = (<HTMLDivElement>document.getElementById('horline'))
                            if (horline) {
                                horline.style.width = "1px"
                                horline.style.height = (window.innerHeight - canvasLocation.bottom) + "px";
                                horline.style.top = (window.pageYOffset + canvasLocation.bottom - self.axisOffsetY) + "px";
                                horline.style.left = (canvasLocation.left + maxCanvasX) + "px";
                            }
                        } else {
                            ctx.beginPath();
                            ctx.moveTo(self.axisOffsetX, mousePos.y);
                            ctx.lineTo(mousePos.x, mousePos.y);
                            ctx.lineTo(mousePos.x, self.canvas.height - self.axisOffsetY);
                            ctx.strokeStyle = 'red';
                            ctx.lineWidth = 2;
                            ctx.stroke();

                            let vertline = (<HTMLDivElement>document.getElementById('vertline'))
                            if (vertline) {
                                vertline.style.height = (window.innerHeight - event.pageY - self.axisOffsetY) + "px";
                                vertline.style.width = "1px"
                                vertline.style.top = (event.pageY + 5) + "px";
                                vertline.style.left = event.pageX + "px";
                            }

                            let horline = (<HTMLDivElement>document.getElementById('horline'))
                            if (horline) {
                                horline.style.width = (window.innerWidth - event.pageX - 5) + "px";
                                horline.style.height = "1px"
                                horline.style.top = event.pageY + "px";
                                horline.style.left = (event.pageX + 5) + "px";
                            }
                        }
                    }
                }
            }
        });

        this.canvas.addEventListener('dblclick', () => {
            for (let callback of this.doubleClickEventListeners) {
                callback();
            }
            //this.updateView(this.minDataX, this.maxDataX, this.minDataY, this.maxDataY);
        });

        //Mousedown
        this.canvas.addEventListener('mousedown', function (event: MouseEvent) {
            self.lastMousePos = getMousePos(self.canvas, event);
            self.mouseDown = true;
        });

        //Mouseup
        canvas.addEventListener('mouseup', function (event: MouseEvent) {
            self.mouseDown = false;

            var startAxisPos = self.getAxisCoord(self.lastMousePos);
            var endAxisPos = self.getAxisCoord(getMousePos(canvas, event));

            let samePointX = startAxisPos.x == endAxisPos.x
            let samePointY = startAxisPos.y == endAxisPos.y

            let xDiff = self.maxViewX - self.minViewX;
            let yDiff = self.maxViewY - self.minViewY;


            if (!(samePointX && samePointY)) {
                let minX = Math.min(startAxisPos.x, endAxisPos.x) * xDiff + self.minViewX;
                let maxX = Math.max(startAxisPos.x, endAxisPos.x) * xDiff + self.minViewX;
                let minY = Math.min(startAxisPos.y, endAxisPos.y) * yDiff + self.minViewY;
                let maxY = Math.max(startAxisPos.y, endAxisPos.y) * yDiff + self.minViewY;

                if (minX < self.minViewX) {
                    minX = self.minViewX
                }
                if (minY < self.minViewY) {
                    minY = self.minViewY
                }

                let region: Rectangle = { min: { x: minX, y: minY }, max: { x: maxX, y: maxY } }

                for (let callback of self.regionSelectEventListeners) {
                    callback(region)
                }
                //self.updateView(minX, maxX, minY, maxY)
            }

            //startXFrac += minX * xDiff;
            //endXFrac -= (1 - maxX) * xDiff;
            //startYFrac += minY * yDiff;
            //endYFrac -= (1 - maxY) * yDiff;

            // Calculate the percentage of the canvas
            //startXFrac +=  (lastMousePos.x / axisWidth) * xDiff;
            //endXFrac -= (1 - mousePos.x / axisWidth) * xDiff;
            //startYFrac +=  (lastMousePos.y / axisHeight) * yDiff;
            //endYFrac -= (1 - mousePos.y / axisHeight) * yDiff;

            //updatePoints()
        });
    }

    addDoubleClickEventListener(callback: { (): void }) {
        this.doubleClickEventListeners.push(callback);
    }

    addRegionSelectEventListener(callback: { (region: Rectangle): void }) {
        this.regionSelectEventListeners.push(callback);
    }

    setDimensions(width: number, height: number) {
        this.canvas.width = width;
        this.canvas.height = height;

        this.axisWidth = this.canvas.width - this.axisOffsetX - this.marginX;
        this.axisHeight = this.canvas.height - this.axisOffsetY - this.marginY;

        this.axisCanvas.width = Math.max(this.axisWidth, this.axisHeight);
        this.axisCanvas.height = Math.max(this.axisWidth, this.axisHeight);

        if (this.onAxisSizeChange) {
            this.onAxisSizeChange();
        }
    }


    //    abstract updateView(minX: number, maxX: number, minY: number, maxY: number): void;

    drawContacts(axisCanvasCTX: CanvasRenderingContext2D | SVGContext, width: number, height: number, clipDiagonal: boolean) {
        //var axisCanvas = this.getAxisCanvas();
        //var axisCanvasCTX = <CanvasRenderingContext2D>axisCanvas.getContext('2d');

        let binSizeX = (this.maxViewX - this.minViewX) / width;
        let binSizeY = (this.maxViewY - this.minViewY) / height;

        this.contactOptions.forEach((options, key, map) => {
            let interactions = <Interaction[]>this.interactions.get(key);

            if (interactions == null) {
                return
            }

            axisCanvasCTX.save();
            axisCanvasCTX.globalAlpha = options.contactOpacity;
            axisCanvasCTX.strokeStyle = "#" + options.contactEdgeColour.toString(16);
            axisCanvasCTX.lineWidth = options.edgeWidth;
            axisCanvasCTX.fillStyle = "#" + options.contactFillColour.toString(16);//"rgba(0, 0, 255, 0.75)";

            for (let i = 0; i < interactions.length; i++) {
                var x, y

                if ((interactions[i].sourceChrom == this.sourceChrom && interactions[i].targetChrom == this.targetChrom)) {
                    x = interactions[i].sourceStart;
                    y = interactions[i].targetStart;

                    let halfWidth = (interactions[i].sourceEnd - interactions[i].sourceStart) / 2;
                    let halfHeight = (interactions[i].targetEnd - interactions[i].targetStart) / 2;

                    x += halfWidth;
                    y += halfHeight;

                    // TODO: Possible performance improvement here - check whether any part of the contact box is visible
                    // and only draw if it is.

                    //if (x >= this.minViewX && x <= this.maxDataX && y >= this.minViewY && y <= this.maxViewY) {
                    x = (x - this.minViewX) / binSizeX;
                    y = (y - this.minViewY) / binSizeY;

                    if (x < 0 || x > width || y < 0 || y > height) {
                        continue;
                    }

                    // Make sure it is visible
                    halfWidth = Math.max(halfWidth / binSizeX, options.contactSize);
                    halfHeight = Math.max(halfHeight / binSizeY, options.contactSize);

                    axisCanvasCTX.beginPath();
                    axisCanvasCTX.rect(x - halfWidth, y - halfHeight, halfWidth * 2, halfHeight * 2);
                    if (options.contactFill) {
                        axisCanvasCTX.fill();
                    }
                    axisCanvasCTX.stroke();
                    // }
                }

                if (interactions[i].sourceChrom == this.targetChrom && interactions[i].targetChrom == this.sourceChrom) {
                    y = interactions[i].sourceStart;
                    x = interactions[i].targetStart;

                    let halfHeight = (interactions[i].sourceEnd - interactions[i].sourceStart) / 2;
                    let halfWidth = (interactions[i].targetEnd - interactions[i].targetStart) / 2;

                    x += halfWidth;
                    y += halfHeight;

                    // if (x >= this.minViewX && x <= this.maxDataX && y >= this.minViewY && y <= this.maxViewY) {
                    x = (x - this.minViewX) / binSizeX;
                    y = (y - this.minViewY) / binSizeY;

                    if (x < 0 || x > width || y < 0 || y > height) {
                        continue;
                    }

                    if (x > y && clipDiagonal) {
                        continue;
                    }

                    // Make sure it is visible
                    halfWidth = Math.max(halfWidth / binSizeX, options.contactSize);
                    halfHeight = Math.max(halfHeight / binSizeY, options.contactSize);

                    axisCanvasCTX.beginPath();
                    axisCanvasCTX.rect(x - halfWidth, y - halfHeight, halfWidth * 2, halfHeight * 2);
                    if (options.contactFill) {
                        axisCanvasCTX.fill();
                    }
                    axisCanvasCTX.stroke();
                    //}
                }
            }
            axisCanvasCTX.restore();
        })


    }

    abstract redraw(): void;

    /*addContact(x: number, y: number) {
        let contact = new Array<number>(2);
        contact[0] = x;
        contact[1] = y;

        this.boxesToDraw.push(contact)
    }*/

    setInteractions(name: string, interactions: Interaction[]) {
        this.interactions.set(name, interactions);
    }

    sourceChrom: Chromosome = new Chromosome("", 0)
    targetChrom: Chromosome = new Chromosome("", 0)

    intrachromosomeView: boolean = false

    setIntrachromosomeView(value: boolean) {
        this.intrachromosomeView = value;

        //this.redraw();
    }

    setChromPair(sourceChrom: Chromosome, targetChrom: Chromosome) {
        this.sourceChrom = sourceChrom;
        this.targetChrom = targetChrom;

        this.minDataX = 0
        this.maxDataX = sourceChrom.length
        this.minDataY = 0
        this.maxDataY = targetChrom.length

        //        this.updateView(0, sourceChrom.length, 0, targetChrom.length)
    }


    addContactMenu(name: string, gui: GUI) {
        //gui.add(this, 'originLocation', {"Top Left": OriginLocation.TopLeft, "Bottom Left": OriginLocation.BottomLeft}).name("Origin Location").onChange((value) => {
        //    this.redraw();
        //})

        this.contactOptions.set(name, new ContactOptions());

        const imageContactFolder = gui.addFolder('Contacts: ' + name);
        imageContactFolder.add(<ContactOptions>this.contactOptions.get(name), 'contactSize', 1, 20).name("Contact size").onChange(() => {
            this.redraw();
        });
        imageContactFolder.add(<ContactOptions>this.contactOptions.get(name), 'contactOpacity', 0, 1).name("Opacity").onChange(() => {
            this.redraw();
        });
        imageContactFolder.addColor(<ContactOptions>this.contactOptions.get(name), 'contactEdgeColour').name("Edge colour").onChange(() => {
            this.redraw();
        });
        imageContactFolder.add(<ContactOptions>this.contactOptions.get(name), 'edgeWidth', 0, 10).name("Edge width").onChange(() => {
            this.redraw();
        });
        imageContactFolder.add(<ContactOptions>this.contactOptions.get(name), 'contactFill').name("Fill").onChange(() => {
            this.redraw();
        });
        imageContactFolder.addColor(<ContactOptions>this.contactOptions.get(name), 'contactFillColour').name("Fill colour").onChange(() => {
            this.redraw();
        });
    }

    protected updateDataLimits(minX: number, maxX: number, minY: number, maxY: number) {
        this.minDataX = minX;
        this.maxDataX = maxX;
        this.minDataY = minY;
        this.maxDataY = maxY;
    }

    updateViewLimits(minX: number, maxX: number, minY: number, maxY: number) {
        this.minViewX = minX;
        this.maxViewX = maxX;
        this.minViewY = minY;
        this.maxViewY = maxY;

        //this.drawTicks();
    }

    getAxisCoord(canvasCoord: Coordinate): Coordinate {
        var mouseX = canvasCoord.x - this.axisOffsetX;
        var mouseY = 0;

        if (this.originLocation == OriginLocation.BottomLeft) {
            mouseY = (this.canvas.height - this.axisOffsetY) - canvasCoord.y;
        } else if (this.originLocation == OriginLocation.TopLeft) {
            mouseY = canvasCoord.y - (this.canvas.height - this.axisHeight - this.axisOffsetY);
        }

        if (this.intrachromosomeView) {
            return {
                x: mouseX / this.axisWidth,
                y: mouseY / this.axisWidth // Assume that we always have a square axis as in triangle view
            };
        }

        return {
            x: mouseX / this.axisWidth,
            y: mouseY / this.axisHeight
        };
    }

    getAxisCanvas() {
        return this.axisCanvas;
    }

    drawAxisCanvas() {
        var ctx = <CanvasRenderingContext2D>this.canvas.getContext('2d');

        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.fillStyle = "lightgray";
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.drawTicks(ctx);

        ctx.save();
        if (this.originLocation == OriginLocation.BottomLeft) {
            ctx.transform(1, 0, 0, -1, 0, this.canvas.height)
        }
        ctx.drawImage(this.axisCanvas, this.axisOffsetX, this.axisOffsetY);
        ctx.restore();
    }

    drawTicks(ctx: CanvasRenderingContext2D | SVGContext) {
        //var ctx = <CanvasRenderingContext2D>this.canvas.getContext('2d');
        ctx.save();

        //ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        //ctx.fillStyle = "lightgray";
        //ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw ticks on axis
        ctx.font = "14px Arial";
        ctx.fillStyle = "black";
        ctx.textBaseline = 'top';
        ctx.textAlign = "center";

        ctx.strokeStyle = 'black';
        ctx.lineWidth = 1;

        let tickPct = 1 / (this.numTicks - 1);

        let xDiff = this.maxViewX - this.minViewX;
        let yDiff = this.maxViewY - this.minViewY;

        let textYOffset = 0;
        let textXOffset = 10;
        if (ctx instanceof CanvasRenderingContext2D) {
            textXOffset = 0;
            textYOffset = -10;
        }

        // Draw x-axis ticks
        for (let i = 0; i < this.numTicks; i++) {
            let curTickPct = i * tickPct;

            let xPos = this.axisOffsetX + (this.axisWidth * curTickPct);
            let yPos = this.canvas.height - this.axisOffsetY;

            var xPosition = this.minViewX + xDiff * curTickPct;

            ctx.beginPath();
            ctx.moveTo(xPos, yPos);
            ctx.lineTo(xPos, yPos + 10);
            ctx.stroke();

            // TODO: Ideally would check the number of digits to display
            if (i == 0 && xPosition > 100) {
                ctx.fillText("" + xPosition.toFixed(this.tickDecimalPlaces), xPos + this.axisOffsetX / 2, yPos + this.axisOffsetY / 2 + textXOffset);
            } else if (i == this.numTicks - 1 && xPosition > 100) {
                ctx.fillText("" + xPosition.toFixed(this.tickDecimalPlaces), xPos - this.axisOffsetX / 2, yPos + this.axisOffsetY / 2 + textXOffset);
            } else {
                ctx.fillText("" + xPosition.toFixed(this.tickDecimalPlaces), xPos, yPos + this.axisOffsetY / 2 + textXOffset);
            }
        }

        // Draw y-axis ticks
        if (!this.intrachromosomeView) {
            for (let i = 0; i < this.numTicks; i++) {
                ctx.save();

                let curTickPct = i * tickPct;
                let xPos = this.axisOffsetX;
                let yPos = this.canvas.height - this.axisOffsetY - (this.axisHeight * curTickPct);

                var yPosition = 0;

                if (this.originLocation == OriginLocation.BottomLeft) {
                    yPosition = this.minViewY + yDiff * curTickPct;
                } else if (this.originLocation == OriginLocation.TopLeft) {
                    yPosition = this.maxViewY - yDiff * curTickPct;
                }

                ctx.translate(xPos, yPos);
                ctx.rotate(-Math.PI / 2);

                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(0, -10);
                ctx.stroke();

                // TODO: Ideally would check the number of digits to display
                if (i == 0 && yPosition > 100) {
                    ctx.fillText("" + yPosition.toFixed(this.tickDecimalPlaces), this.axisOffsetX / 2, -this.axisOffsetY / 2 + textYOffset);
                } else if (i == this.numTicks - 1 && yPosition > 100) {
                    ctx.fillText("" + yPosition.toFixed(this.tickDecimalPlaces), -this.axisOffsetX / 2, -this.axisOffsetY / 2 + textYOffset);
                } else {
                    ctx.fillText("" + yPosition.toFixed(this.tickDecimalPlaces), 0, -this.axisOffsetY / 2 + textYOffset);
                }

                ctx.restore();
            }
        }

        ctx.restore();
    }
}

function getMousePos(canvas: HTMLCanvasElement, event: MouseEvent): Coordinate {
    var rect = canvas.getBoundingClientRect();
    return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
    };
}

