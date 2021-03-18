package voronoi

import (
	"github.com/fogleman/delaunay"
)

type Polygon struct {
	DataPoint delaunay.Point
	Points    []delaunay.Point
	Area      float64
	Clipped   bool
}

// func (polygon *Polygon) calculateArea() {
// 	polygon.Area = 0
// 	j := len(polygon.Points) - 1

// 	for i := 0; i < len(polygon.Points); i++ {
// 		polygon.Area += polygon.Points[j].X*polygon.Points[i].Y - polygon.Points[j].Y*polygon.Points[i].X
// 		j = i
// 	}

// 	polygon.Area /= 2
// }

func (polygon Polygon) BoundingBox() Rectangle {
	var bounds Rectangle

	for index, point := range polygon.Points {
		if index == 0 {
			bounds.Min.X = point.X
			bounds.Max.X = point.X

			bounds.Min.Y = point.Y
			bounds.Max.Y = point.Y
		} else {
			if bounds.Min.X > point.X {
				bounds.Min.X = point.X
			}
			if bounds.Max.X < point.X {
				bounds.Max.X = point.X
			}
			if bounds.Min.Y > point.Y {
				bounds.Min.Y = point.Y
			}
			if bounds.Max.Y < point.Y {
				bounds.Max.Y = point.Y
			}
		}
	}

	return bounds
}

func centroid3(p1, p2, p3 delaunay.Point) delaunay.Point {
	return delaunay.Point{X: p1.X + p2.X + p3.X, Y: p1.Y + p2.Y + p3.Y}
}

func calcArea2(p1, p2, p3 delaunay.Point) float64 {
	return (p2.X-p1.X)*(p3.Y-p1.Y) -
		(p3.X-p1.X)*(p2.Y-p1.Y)
}

func (polygon *Polygon) Centroid() delaunay.Point {
	var centroid delaunay.Point
	var areasum2 float64

	if len(polygon.Points) < 1 {
		return centroid
	}

	areaBasePoint := polygon.Points[0]
	for i := 0; i < len(polygon.Points)-1; i++ {
		triangleCent3 := centroid3(areaBasePoint, polygon.Points[i], polygon.Points[i+1])
		area2 := calcArea2(areaBasePoint, polygon.Points[i], polygon.Points[i+1])

		centroid.X += area2 * triangleCent3.X
		centroid.Y += area2 * triangleCent3.Y

		areasum2 += area2
	}

	centroid.X = centroid.X / 3 / areasum2
	centroid.Y = centroid.Y / 3 / areasum2

	polygon.Area = areasum2 / 2

	return centroid

	// signedArea := 0.0
	// x0 := 0.0 // Current vertex X
	// y0 := 0.0 // Current vertex Y
	// x1 := 0.0 // Next vertex X
	// y1 := 0.0 // Next vertex Y
	// a := 0.0  // Partial signed area

	// // For all vertices except last
	// for i := 0; i < len(polygon.Points)-1; i++ {
	// 	x0 = math.Round(polygon.Points[i].X)
	// 	y0 = math.Round(polygon.Points[i].Y)
	// 	x1 = math.Round(polygon.Points[i+1].X)
	// 	y1 = math.Round(polygon.Points[i+1].Y)
	// 	a = x0*y1 - x1*y0
	// 	signedArea += a
	// 	centroid.X += (x0 + x1) * a
	// 	centroid.Y += (y0 + y1) * a
	// }

	// // Do last vertex separately to avoid performing an expensive
	// // modulus operation in each iteration.
	// x0 = math.Round(polygon.Points[len(polygon.Points)-1].X)
	// y0 = math.Round(polygon.Points[len(polygon.Points)-1].Y)
	// x1 = math.Round(polygon.Points[0].X)
	// y1 = math.Round(polygon.Points[0].Y)
	// a = x0*y1 - x1*y0
	// signedArea += a
	// centroid.X += (x0 + x1) * a
	// centroid.Y += (y0 + y1) * a

	// signedArea *= 0.5
	// centroid.X /= (6.0 * signedArea)
	// centroid.Y /= (6.0 * signedArea)

	// return centroid

	// i := 0
	// n := len(polygon.Points)

	// if n < 1 {
	// 	return delaunay.Point{}
	// }

	// var a delaunay.Point
	// var c, x, y, k float64
	// b := polygon.Points[n-1]

	// for i < n {
	// 	a = b
	// 	b = polygon.Points[i]
	// 	c = a.X*b.Y - b.X*a.Y
	// 	k += c
	// 	x += (a.X + b.X) * c
	// 	y += (a.Y + b.Y) * c

	// 	i++
	// }

	// k *= 3

	// return delaunay.Point{X: x / k, Y: y / k}
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
	var clipped bool
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
				clipped = true
				counter++
				counter++

				// Case 3: First vertex is inside while second one is outside:
				// Only the point of intersection of the edge with the clip boundary
				// is added to the output list
			} else if inside(s, cp1, cp2) && !inside(e, cp1, cp2) {
				outputPolygon.Points = append(outputPolygon.Points, intersection(cp1, cp2, s, e))
				clipped = true
				counter++

				// Case 4: Both vertices are outside
				//} else if !inside(s, cp1, cp2) && !inside(e, cp1, cp2) {
				// No vertices are added to the output list
			}
		}
		// set new polygon size
		newPolygonSize = counter
	}

	outputPolygon.Clipped = clipped
	return outputPolygon
}
