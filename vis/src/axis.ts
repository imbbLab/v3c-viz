import {Chromosome, Interaction} from "./chromosome"

export interface Coordinate {
    x: number;
    y: number;
}

export abstract class Axis {
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

    numTicks = 5;
    tickDecimalPlaces = 2;

    // Editable contact options
    contactOpacity = 0.7;
    contactEdgeColour = 2649545;
    edgeWidth = 2;
    contactFill = true;
    contactFillColour = 2649545;
    contactSize = 10;

    // Contacts
    interactions: Interaction[]

    axisWidth = 500;
    axisHeight = 500;

    mouseDown = false;
    lastMousePos: Coordinate = { x: 0, y: 0 };

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.axisCanvas = document.createElement("canvas");

        this.setDimensions(this.canvas.width, this.canvas.height)

        this.interactions = [];

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

                    ctx.beginPath();
                    ctx.moveTo(self.axisOffsetX, mousePos.y);
                    ctx.lineTo(mousePos.x, mousePos.y);
                    ctx.lineTo(mousePos.x, self.canvas.height - self.axisOffsetX);
                    ctx.strokeStyle = 'red';
                    ctx.lineWidth = 2;
                    ctx.stroke();

                    let vertline = (<HTMLDivElement>document.getElementById('vertline'))
                    vertline.style.height = (window.innerHeight - event.pageY - self.axisOffsetY) + "px";
                    vertline.style.top = (event.pageY + 5) + "px";
                    vertline.style.left = event.pageX + "px";

                    let horline = (<HTMLDivElement>document.getElementById('horline'))
                    horline.style.width = (window.innerWidth - event.pageX - 5) + "px";
                    horline.style.top = event.pageY + "px";
                    horline.style.left = (event.pageX + 5) + "px";
                }

                // Always draw the box, even when zooming
                let boxHeight = 30;
                let boxWidth = 175;

                let margin = 5;

                ctx.fillStyle = "lightblue";
                ctx.fillRect(mousePos.x + margin, mousePos.y - boxHeight / 2, boxWidth, boxHeight);

                let xDiff = self.maxViewX - self.minViewX;
                let yDiff = self.maxViewY - self.minViewY;
                var xPosition = (self.minViewX + axisPos.x * xDiff);
                var yPosition = (self.minViewY + axisPos.y * yDiff);

                ctx.font = "19px Arial";
                ctx.fillStyle = "black";
                ctx.textBaseline = "middle";
                ctx.textAlign = "left";
                ctx.fillText("" + xPosition.toFixed(0) + ", " + yPosition.toFixed(0), mousePos.x + margin * 2, mousePos.y);
            }
        });

        this.canvas.addEventListener('dblclick', () => {
            this.updateView(this.minDataX, this.maxDataX, this.minDataY, this.maxDataY);
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

                self.updateView(minX, maxX, minY, maxY)
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

    setDimensions(width: number, height: number) {
        this.canvas.width = width;
        this.canvas.height = height;

        this.axisWidth = this.canvas.width - this.axisOffsetX * 1.5;
        this.axisHeight = this.canvas.height - this.axisOffsetY * 1.5;

        this.axisCanvas.width = this.axisWidth;
        this.axisCanvas.height = this.axisHeight;
    }


    abstract updateView(minX: number, maxX: number, minY: number, maxY: number): void;

    protected drawContacts() {
        var axisCanvas = this.getAxisCanvas();
        var axisCanvasCTX = <CanvasRenderingContext2D>axisCanvas.getContext('2d');

        let startX = this.minViewX;
        let endX = this.maxViewX;
        let startY = this.minViewY;
        let endY = this.maxViewY;

        let xScaleFactor = axisCanvas.width / (endX - startX);
        let yScaleFactor = axisCanvas.height / (endY - startY);

        axisCanvasCTX.save();
        axisCanvasCTX.globalAlpha = this.contactOpacity;
        axisCanvasCTX.strokeStyle = "#" + this.contactEdgeColour.toString(16);
        axisCanvasCTX.lineWidth = this.edgeWidth;
        axisCanvasCTX.fillStyle = "#" + this.contactFillColour.toString(16);//"rgba(0, 0, 255, 0.75)";
        for (let i = 0; i < this.interactions.length; i++) {
            var x, y
            if(this.interactions[i].sourceChrom == this.sourceChrom && this.interactions[i].targetChrom == this.targetChrom) {
                x = this.interactions[i].sourceStart;
                y = this.interactions[i].targetStart;
            } else if(this.interactions[i].sourceChrom == this.targetChrom && this.interactions[i].targetChrom == this.sourceChrom)  {
                y = this.interactions[i].sourceStart;
                x = this.interactions[i].targetStart;
            }

            // For some reason the interaction isn't appropriate, so skip it
            if(!x || !y) {
                continue;
            }

            if (x >= this.minViewX && x <= this.maxDataX && y >= this.minViewY && y <= this.maxViewY) {
                x = (x - startX) * xScaleFactor;
                y = (y - startY) * yScaleFactor;

                let halfWidth = 250 * xScaleFactor;
                let halfHeight = 250 * yScaleFactor;

                // Make sure it is visible
                halfWidth = Math.max(halfWidth, this.contactSize);
                halfHeight = Math.max(halfHeight, this.contactSize);

                axisCanvasCTX.beginPath();
                axisCanvasCTX.rect(x - halfWidth, y - halfHeight, halfWidth * 2, halfHeight * 2);
                if (this.contactFill) {
                    axisCanvasCTX.fill();
                }
                axisCanvasCTX.stroke();
                //this.normPoints[i * 2][0] = ((this.points[i * 2] - startX) / (endX - startX)) * axisCanvas.width;
                //axisCanvasCTX.
            }
        }
        axisCanvasCTX.restore();
    }

    abstract redraw(): void;

    /*addContact(x: number, y: number) {
        let contact = new Array<number>(2);
        contact[0] = x;
        contact[1] = y;

        this.boxesToDraw.push(contact)
    }*/

    setInteractions(interactions: Interaction[]) {
        this.interactions = interactions;
    }

    sourceChrom: Chromosome = new Chromosome("", 0)
    targetChrom: Chromosome = new Chromosome("", 0)

    setChromPair(sourceChrom: Chromosome, targetChrom: Chromosome) {
        this.sourceChrom = sourceChrom;
        this.targetChrom = targetChrom;

        this.minDataX = 0
        this.maxDataX = sourceChrom.length
        this.minDataY = 0
        this.maxDataY = targetChrom.length

        this.updateView(0, sourceChrom.length, 0, targetChrom.length)
    }
    

    addContactMenu(gui: dat.GUI) {
        const imageContactFolder = gui.addFolder('Contacts');
        imageContactFolder.add(this, 'contactSize', 1, 20).name("Contact size").onChange((value) => {
            this.redraw();
        });
        imageContactFolder.add(this, 'contactOpacity', 0, 1).name("Opacity").onChange((value) => {
            this.redraw();
        });
        imageContactFolder.addColor(this, 'contactEdgeColour').name("Edge colour").onChange((value) => {
            this.redraw();
        });
        imageContactFolder.add(this, 'edgeWidth', 0, 10).name("Edge width").onChange((value) => {
            this.redraw();
        });
        imageContactFolder.add(this, 'contactFill').name("Fill").onChange((value) => {
            this.redraw();
        });
        imageContactFolder.addColor(this, 'contactFillColour').name("Fill colour").onChange((value) => {
            this.redraw();
        });
    }

    protected updateDataLimits(minX: number, maxX: number, minY: number, maxY: number) {
        this.minDataX = minX;
        this.maxDataX = maxX;
        this.minDataY = minY;
        this.maxDataY = maxY;
    }

    protected updateViewLimits(minX: number, maxX: number, minY: number, maxY: number) {
        this.minViewX = minX;
        this.maxViewX = maxX;
        this.minViewY = minY;
        this.maxViewY = maxY;

        //this.drawTicks();
    }

    getAxisCoord(canvasCoord: Coordinate): Coordinate {
        var mouseX = canvasCoord.x - this.axisOffsetX;
        var mouseY = (this.canvas.height - this.axisOffsetY) - canvasCoord.y;

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

        this.drawTicks();

        ctx.save();
        ctx.transform(1, 0, 0, -1, 0, this.canvas.height)
        ctx.drawImage(this.axisCanvas, this.axisOffsetX, this.axisOffsetY);
        ctx.restore();
    }

    drawTicks() {
        var ctx = <CanvasRenderingContext2D>this.canvas.getContext('2d');
        ctx.save();

        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.fillStyle = "lightgray";
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

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
                ctx.fillText("" + xPosition.toFixed(this.tickDecimalPlaces), xPos + this.axisOffsetX/2, yPos + this.axisOffsetY/2);
            } else if(i == this.numTicks-1 && xPosition > 100) {
                ctx.fillText("" + xPosition.toFixed(this.tickDecimalPlaces), xPos - this.axisOffsetX/2, yPos + this.axisOffsetY/2);
            } else {
                ctx.fillText("" + xPosition.toFixed(this.tickDecimalPlaces), xPos, yPos + this.axisOffsetY/2);
            }
        }

        // Draw y-axis ticks
        for (let i = 0; i < this.numTicks; i++) {
            ctx.save();

            let curTickPct = i * tickPct;
            let xPos = this.axisOffsetX;
            let yPos = this.canvas.height - this.axisOffsetY - (this.axisHeight * curTickPct);

            var yPosition = this.minViewY + yDiff * curTickPct;

            ctx.translate(xPos, yPos);
            ctx.rotate(-Math.PI / 2);

            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(0, -10);
            ctx.stroke();

            // TODO: Ideally would check the number of digits to display
            if (i == 0 && yPosition > 100) {
                ctx.fillText("" + yPosition.toFixed(this.tickDecimalPlaces), this.axisOffsetX/2, -this.axisOffsetY/2-10);
            } else if(i == this.numTicks-1 && yPosition > 100) {
                ctx.fillText("" + yPosition.toFixed(this.tickDecimalPlaces), -this.axisOffsetX/2, -this.axisOffsetY/2-10);
            } else {
                ctx.fillText("" + yPosition.toFixed(this.tickDecimalPlaces), 0, -this.axisOffsetY/2-10);
            }

            ctx.restore();
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

