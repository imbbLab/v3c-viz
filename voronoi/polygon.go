package voronoi

import (
	"github.com/fogleman/delaunay"
)

type Polygon struct {
	DataPoint delaunay.Point
	Points    []delaunay.Point
	Area      float64
}

func (polygon *Polygon) calculateArea() {
	polygon.Area = 0
	j := len(polygon.Points) - 1

	for i := 0; i < len(polygon.Points); i++ {
		//area += (polygon[j][0]+polygon[i][0]) * (polygon[j][1]+polygon[i][1]);
		var crossProduct = polygon.Points[j].X*polygon.Points[i].Y - polygon.Points[j].Y*polygon.Points[i].X
		polygon.Area += crossProduct
		j = i //j is previous vertex to i
	}

	polygon.Area /= 2
}

func (polygon *Polygon) Centroid() delaunay.Point {
	i := 0
	n := len(polygon.Points)

	var a delaunay.Point
	var c, x, y, k float64
	b := polygon.Points[n-1]

	for i < n {
		a = b
		b = polygon.Points[i]
		c = a.X*b.Y - b.X*a.Y
		k += c
		x += (a.X + b.X) * c
		y += (a.Y + b.Y) * c

		i++
	}

	k *= 3

	return delaunay.Point{X: x / k, Y: y / k}
}

func inside(p, p1, p2 delaunay.Point) bool {
	return (p2.Y-p1.Y)*p.X+(p1.X-p2.X)*p.Y+(p2.X*p1.Y-p1.X*p2.Y) < 0
}

func intersection(cp1, cp2, s, e delaunay.Point) delaunay.Point {
	dc := delaunay.Point{X: cp1.X - cp2.X, Y: cp1.Y - cp2.Y}
	dp := delaunay.Point{X: s.X - e.X, Y: s.Y - e.Y}

	n1 := cp1.X*cp2.Y - cp1.Y*cp2.X
	n2 := s.X*e.Y - s.Y*e.X

	n3 := 1.0 / (dc.X*dp.Y - dc.Y*dp.X)

	return delaunay.Point{X: (n1*dp.X - n2*dc.X) * n3, Y: (n1*dp.Y - n2*dc.Y) * n3}

}

// Sutherland-Hodgman clipping modified from https://rosettacode.org/wiki/Sutherland-Hodgman_polygon_clipping#C.2B.2B
func SutherlandHodgman(subjectPolygon Polygon, clipPolygon Polygon) Polygon {
	var cp1, cp2, s, e delaunay.Point

	var inputPolygon, outputPolygon Polygon
	outputPolygon.DataPoint = subjectPolygon.DataPoint
	outputPolygon.Points = append(outputPolygon.Points, subjectPolygon.Points...)

	newPolygonSize := len(subjectPolygon.Points)

	for j := 0; j < len(clipPolygon.Points); j++ {
		// copy new polygon to input polygon & set counter to 0
		inputPolygon.Points = make([]delaunay.Point, 0, newPolygonSize)
		for k := 0; k < newPolygonSize; k++ {
			inputPolygon.Points = append(inputPolygon.Points, outputPolygon.Points[k])
		}

		counter := 0
		outputPolygon.Points = make([]delaunay.Point, 0, newPolygonSize)

		// get clipping polygon edge
		cp1 = clipPolygon.Points[j]
		cp2 = clipPolygon.Points[(j+1)%len(clipPolygon.Points)]

		for i := 0; i < newPolygonSize; i++ {
			// get subject polygon edge
			s = inputPolygon.Points[i]
			e = inputPolygon.Points[(i+1)%newPolygonSize]

			// Case 1: Both vertices are inside:
			// Only the second vertex is added to the output list
			if inside(s, cp1, cp2) && inside(e, cp1, cp2) {
				outputPolygon.Points = append(outputPolygon.Points, e)
				counter++

				// Case 2: First vertex is outside while second one is inside:
				// Both the point of intersection of the edge with the clip boundary
				// and the second vertex are added to the output list
			} else if !inside(s, cp1, cp2) && inside(e, cp1, cp2) {
				outputPolygon.Points = append(outputPolygon.Points, intersection(cp1, cp2, s, e))
				outputPolygon.Points = append(outputPolygon.Points, e)
				counter++
				counter++

				// Case 3: First vertex is inside while second one is outside:
				// Only the point of intersection of the edge with the clip boundary
				// is added to the output list
			} else if inside(s, cp1, cp2) && !inside(e, cp1, cp2) {
				outputPolygon.Points = append(outputPolygon.Points, intersection(cp1, cp2, s, e))
				counter++

				// Case 4: Both vertices are outside
			} else if !inside(s, cp1, cp2) && !inside(e, cp1, cp2) {
				// No vertices are added to the output list
			}
		}
		// set new polygon size
		newPolygonSize = counter
	}

	return outputPolygon
}
