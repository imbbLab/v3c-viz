
declare module 'igv-utils' {
 
    export interface Coordinate {
        x: number
        y: number
    }

    export interface DOMUtils {
        pageCoordinates(e: JQuery.MouseDownEvent | JQuery.MouseMoveEvent): Coordinate
    }


    export const DOMUtils: DOMUtils;
}