
export class Point {
    x: number
    y: number

    constructor(x: number, y: number) {
        this.x = x;
        this.y = y;
    }
}

export class Polygon {
    points: Point[] = []
    area: number = 0
    logArea: number = 0
    clipped: boolean = false;
    centroid: Point = new Point(0, 0)
    dataPoint: Point = new Point(0, 0)

    clip(clipPolygon: Polygon): Polygon {
        var cp1: Point, cp2: Point, s: Point, e: Point

        var inputPolygon: Polygon, outputPolygon: Polygon
        inputPolygon = new Polygon();
        outputPolygon = new Polygon();

        this.points.forEach(point => {
            outputPolygon.points.push({ x: Math.round(point.x), y: Math.round(point.y) })
        });

        let newPolygonSize = this.points.length

        for (let j = 0; j < clipPolygon.points.length; j++) {
            // copy new polygon to input polygon & set counter to 0
            inputPolygon.points = []

            for (let k = 0; k < newPolygonSize; k++) {
                inputPolygon.points.push(outputPolygon.points[k])
                //inputPolygon.Points = append(inputPolygon.Points, outputPolygon.Points[k])
            }

            let counter = 0
            outputPolygon.points = []

            // get clipping polygon edge
            cp1 = clipPolygon.points[j]
            cp2 = clipPolygon.points[(j + 1) % (clipPolygon.points.length)]

            for (let i = 0; i < newPolygonSize; i++) {
                // get subject polygon edge
                s = inputPolygon.points[i]
                e = inputPolygon.points[(i + 1) % newPolygonSize]

                // Case 1: Both vertices are inside:
                // Only the second vertex is added to the output list
                if (inside(s, cp1, cp2) && inside(e, cp1, cp2)) {
                    outputPolygon.points.push(e)
                    counter++

                    // Case 2: First vertex is outside while second one is inside:
                    // Both the point of intersection of the edge with the clip boundary
                    // and the second vertex are added to the output list
                } else if (!inside(s, cp1, cp2) && inside(e, cp1, cp2)) {
                    outputPolygon.points.push(intersection(cp1, cp2, s, e))
                    outputPolygon.points.push(e)
                    counter++
                    counter++

                    // Case 3: First vertex is inside while second one is outside:
                    // Only the point of intersection of the edge with the clip boundary
                    // is added to the output list
                } else if (inside(s, cp1, cp2) && !inside(e, cp1, cp2)) {
                    outputPolygon.points.push(intersection(cp1, cp2, s, e))
                    counter++

                    // Case 4: Both vertices are outside
                    //} else if !inside(s, cp1, cp2) && !inside(e, cp1, cp2) {
                    // No vertices are added to the output list
                }
            }
            // set new polygon size
            newPolygonSize = counter
        }

        return outputPolygon
    }
}

function inside(p: Point, p1: Point, p2: Point): boolean {
    return (p2.y - p1.y) * p.x + (p1.x - p2.x) * p.y + (p2.x * p1.y - p1.x * p2.y) < 0
}

function intersection(cp1: Point, cp2: Point, s: Point, e: Point): Point {
    let dc = { x: cp1.x - cp2.x, y: cp1.y - cp2.y }
    let dp = { x: s.x - e.x, y: s.y - e.y }

    let n1 = cp1.x * cp2.y - cp1.y * cp2.x
    let n2 = s.x * e.y - s.y * e.x

    let n3 = 1.0 / (dc.x * dp.y - dc.y * dp.x)

    return { x: (n1 * dp.x - n2 * dc.x) * n3, y: (n1 * dp.y - n2 * dc.y) * n3 }

}


export interface MinMax {
    Min: number
    Max: number
}

export class Voronoi {
    polygons: Polygon[] = []


    getMinMaxArea(): MinMax {
        var minMax: MinMax = { Min: -1, Max: -1 };


        let maxIndex = 0;

        for (let i = 0; i < this.polygons.length; i++) {
            //let centroid = voronoi.polygons[i]['DataPoint']
            //if (polygons[i]['Clipped'] || centroid[0] > voronoiMap.getVoronoiDrawWidth() || centroid[1] > voronoiMap.getVoronoiDrawHeight()) {
            //    continue;
            //}
            if (this.polygons[i].clipped) {
                continue;
            }

            let area = Math.log(this.polygons[i].area)

            if (minMax.Min == -1 || area < minMax.Min) {
                minMax.Min = area
            }
            if (minMax.Max == -1 || area > minMax.Max) {
                maxIndex = i
                minMax.Max = area
            }
        }

        return minMax
    }
}