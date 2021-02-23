package voronoi

import (
	"fmt"

	"github.com/fogleman/delaunay"
)

type Rectangle struct {
	Min, Max delaunay.Point
}

func (rect Rectangle) Width() float64 {
	return rect.Max.X - rect.Min.X
}

func (rect Rectangle) Height() float64 {
	return rect.Max.Y - rect.Min.Y
}

func Rect(x0, y0, x1, y1 float64) Rectangle {
	return Rectangle{Min: delaunay.Point{X: x0, Y: y0}, Max: delaunay.Point{X: x1, Y: y1}}
}

type Voronoi struct {
	Polygons []Polygon
}

//noNormlisation := func(point delaunay.Point) delaunay.Point {
//	return point
//}

//func chromNormalisation(point delaunay.Point, sourceChrom pairs.Chromsize, targetChrom pairs.Chromsize) delaunay.Point {
//	return delaunay.Point{X: point.X / float64(sourceChrom.Length), Y: point.Y / float64(targetChrom.Length)}
//}

func FromPoints(data []delaunay.Point, bounds Rectangle) (*Voronoi, error) {
	var totalPoints []delaunay.Point

	// Add in points out of bounds to help with the voronoi calculation
	totalPoints = append(totalPoints, delaunay.Point{X: bounds.Min.X - bounds.Width(), Y: bounds.Min.Y + bounds.Height()/2})
	totalPoints = append(totalPoints, delaunay.Point{X: bounds.Max.X + bounds.Width(), Y: bounds.Min.Y + bounds.Height()/2})
	totalPoints = append(totalPoints, delaunay.Point{X: bounds.Min.X + bounds.Width()/2, Y: bounds.Min.Y - bounds.Height()})
	totalPoints = append(totalPoints, delaunay.Point{X: bounds.Min.X + bounds.Width()/2, Y: bounds.Max.Y + bounds.Height()})

	totalPoints = append(totalPoints, data...)

	for index := range totalPoints {
		totalPoints[index] = pointNormalisation(totalPoints[index], bounds)
		//dPoints[index] = chromNormalisation(dPoints[index], pairsFile.Chromsizes()[sourceChrom], pairsFile.Chromsizes()[targetChrom])
	}

	triangulation, err := delaunay.Triangulate(totalPoints)
	if err != nil {
		return nil, err
	}

	return calculateVoronoi(triangulation), nil
}

/*func FromDelaunay(triangulation *delaunay.Triangulation) *Voronoi {
	return calculateVoronoi(triangulation)
}*/

func pointNormalisation(point delaunay.Point, bounds Rectangle) delaunay.Point {
	return delaunay.Point{X: (point.X - bounds.Min.X) / bounds.Width(), Y: (point.Y - bounds.Min.Y) / bounds.Height()}
}

func calculateVoronoi(triangulation *delaunay.Triangulation) *Voronoi {
	// See https://mapbox.github.io/delaunator/ for information

	/*circumcenters := make([]delaunay.Point, len(triangulation.Triangles)/3)
	//vectors := make([]float64, len(triangulation.Points)*2)

	fmt.Printf("Delauney: #points = %d, #triangles = %d, #halfedges = %d\n", len(triangulation.Points), len(triangulation.Triangles), len(triangulation.Halfedges))

	pointIndex := 0
	for i := 0; i < len(triangulation.Triangles); i += 3 {
		t1 := triangulation.Triangles[i]
		t2 := triangulation.Triangles[i+1]
		t3 := triangulation.Triangles[i+2]

		point1 := triangulation.Points[t1]
		point2 := triangulation.Points[t2]
		point3 := triangulation.Points[t3]

		dx := point2.X - point1.X
		dy := point2.Y - point1.Y
		ex := point3.X - point1.X
		ey := point3.Y - point1.Y
		b1 := dx*dx + dy*dy
		c1 := ex*ex + ey*ey
		ab := (dx*ey - dy*ex) * 2

		var x, y float64

		// TODO: Not handling degenerate case https://github.com/d3/d3-delaunay/blob/9258fa3fb6bf0e6ab6d56009f2472807f461109f/src/voronoi.js#L107
		if math.Abs(ab) < 1e-8 {
			x = (point1.X + point3.X) / 2
			y = (point1.Y + point3.Y) / 2
		} else {
			d := 1 / ab
			x = point1.X + (ey*b1-dy*c1)*d
			y = point1.Y + (dx*c1-ex*b1)*d
		}

		circumcenters[pointIndex] = delaunay.Point{X: x, Y: y}
		pointIndex++
	}*/

	indexMap := make(map[int]int)
	for e := 0; e < len(triangulation.Triangles); e++ {
		endpoint := triangulation.Triangles[nextHalfEdge(e)]

		if _, ok := indexMap[endpoint]; !ok || triangulation.Halfedges[e] == -1 {
			indexMap[endpoint] = e
		}
	}

	clipArea := Polygon{Points: []delaunay.Point{{X: 0, Y: 0}, {X: 1, Y: 0}, {X: 1, Y: 1}, {X: 0, Y: 1}}}

	var voronoi Voronoi
	voronoi.Polygons = make([]Polygon, 0, len(triangulation.Points))

	for p := 0; p < len(triangulation.Points); p++ {
		incoming := indexMap[p]
		edges := edgesAroundPoint(triangulation, incoming)

		var polygon Polygon
		polygon.DataPoint = triangulation.Points[p]
		polygon.Points = make([]delaunay.Point, 0, len(edges))

		// TODO: Can test for out of bounds points and then only clip polygons which need it
		for i := 0; i < len(edges); i++ {
			polygon.Points = append(polygon.Points, triangleCenter(triangulation, triangleOfEdge(edges[i])))
		}

		// Clip the polygon to the view
		polygon = SutherlandHodgman(polygon, clipArea)

		/*if len(polygon.Points) <= 3 {
			fmt.Println(edges)
			for i := 0; i < len(edges); i++ {
				fmt.Println(triangleOfEdge(edges[i]))
			}
			fmt.Println("-----")
		}*/

		if len(polygon.Points) > 0 {
			polygon.calculateArea()
			voronoi.Polygons = append(voronoi.Polygons, polygon)
		}
	}

	fmt.Println(triangulation.ConvexHull)
	return &voronoi

	/*var voronoi Voronoi
	voronoi.Polygons = make([]Polygon, len(triangulation.Triangles))

	for i := 0; i < len(triangulation.Triangles); i += 3 {
		var polygon Polygon
		polygon.Points = make([]delaunay.Point, 0, 3)

		e0 := i
		e := e0

		firstTime := true
		for firstTime || (e != e0 && e != -1) {
			polygon.Points = append(polygon.Points, circumcenters[e])

			if e%3 == 2 {
				e -= 2
			} else {
				e++
			}

			e = triangulation.Halfedges[e]

			firstTime = false
		}
	}

	return &voronoi*/

	/*t1 := triangulation.Triangles[i]
	t2 := triangulation.Triangles[i+1]
	t3 := triangulation.Triangles[i+2]

	point1 := triangulation.Points[t1]
	point2 := triangulation.Points[t2]
	point3 := triangulation.Points[t3]

	for
	fmt.Println(circumcenters[i])
	fmt.Printf("Indicies: %d %d %d\n", t1, t2, t3)
	fmt.Println(point1)
	fmt.Println(point2)
	fmt.Println(point3)*/

	//points := clip(i)
}

func edgesAroundPoint(triangulation *delaunay.Triangulation, start int) []int {
	var result []int

	var outgoing int
	incoming := start
	firstTime := true
	for firstTime || (incoming != -1 && incoming != start) {
		result = append(result, incoming)
		outgoing = nextHalfEdge(incoming)
		incoming = triangulation.Halfedges[outgoing]

		firstTime = false
	}

	return result
}

func pointsOfTriangle(triangulation *delaunay.Triangulation, t int) []delaunay.Point {
	return []delaunay.Point{triangulation.Points[triangulation.Triangles[t*3]], triangulation.Points[triangulation.Triangles[t*3+1]], triangulation.Points[triangulation.Triangles[t*3+2]]}
}

func circumcenter(a, b, c delaunay.Point) delaunay.Point {
	ad := a.X*a.X + a.Y*a.Y
	bd := b.X*b.X + b.Y*b.Y
	cd := c.X*c.X + c.Y*c.Y
	D := 2 * (a.X*(b.Y-c.Y) + b.X*(c.Y-a.Y) + c.X*(a.Y-b.Y))
	return delaunay.Point{
		X: 1 / D * (ad*(b.Y-c.Y) + bd*(c.Y-a.Y) + cd*(a.Y-b.Y)),
		Y: 1 / D * (ad*(c.X-b.X) + bd*(a.X-c.X) + cd*(b.X-a.X)),
	}
}

func triangleCenter(triangulation *delaunay.Triangulation, t int) delaunay.Point {
	vertices := pointsOfTriangle(triangulation, t)

	return circumcenter(vertices[0], vertices[1], vertices[2])
}

func triangleOfEdge(e int) int {
	return e / 3
}

func nextHalfEdge(e int) int {
	if e%3 == 2 {
		return e - 2
	}
	return e + 1
}
