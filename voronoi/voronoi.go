package voronoi

import (
	"fmt"
	"sync"
	"time"

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
	var err error
	var totalPoints []delaunay.Point
	var triangulation *delaunay.Triangulation
	var vor *Voronoi

	fixedPoint1 := delaunay.Point{X: bounds.Min.X - bounds.Width(), Y: bounds.Min.Y + bounds.Height()/2}
	fixedPoint2 := delaunay.Point{X: bounds.Max.X + bounds.Width(), Y: bounds.Min.Y + bounds.Height()/2}
	fixedPoint3 := delaunay.Point{X: bounds.Min.X + bounds.Width()/2, Y: bounds.Min.Y - bounds.Height()}
	fixedPoint4 := delaunay.Point{X: bounds.Min.X + bounds.Width()/2, Y: bounds.Max.Y + bounds.Height()}

	// Add in points out of bounds to help with the voronoi calculation
	totalPoints = append(totalPoints, fixedPoint1)
	totalPoints = append(totalPoints, fixedPoint2)
	totalPoints = append(totalPoints, fixedPoint3)
	totalPoints = append(totalPoints, fixedPoint4)

	totalPoints = append(totalPoints, data...)

	for index := range totalPoints {
		totalPoints[index] = pointNormalisation(totalPoints[index], bounds)
		//dPoints[index] = chromNormalisation(dPoints[index], pairsFile.Chromsizes()[sourceChrom], pairsFile.Chromsizes()[targetChrom])
	}

	smoothingIterations := 1

	start := time.Now()
	midPoint := start
	var elapsed time.Duration

	for i := 0; i <= smoothingIterations; i++ {
		midPoint = time.Now()
		triangulation, err = delaunay.Triangulate(totalPoints)
		if err != nil {
			return nil, err
		}

		elapsed = time.Since(midPoint)
		midPoint = time.Now()
		fmt.Printf("Triangulation: %s\n", elapsed)

		vor = calculateVoronoi(triangulation)
		elapsed = time.Since(midPoint)
		midPoint = time.Now()
		fmt.Printf("Voronoi: %s\n", elapsed)

		if i+1 <= smoothingIterations {
			totalPoints = nil
			totalPoints = append(totalPoints, fixedPoint1)
			totalPoints = append(totalPoints, fixedPoint2)
			totalPoints = append(totalPoints, fixedPoint3)
			totalPoints = append(totalPoints, fixedPoint4)

			for _, polygon := range vor.Polygons {
				if len(polygon.Points) > 0 {
					totalPoints = append(totalPoints, polygon.Centroid())
				}
			}
		}

		elapsed = time.Since(midPoint)
		fmt.Printf("Reset: %s\n", elapsed)
	}

	elapsed = time.Since(start)
	fmt.Printf("Total voronoi: %s\n", elapsed)

	return vor, nil
}

/*func FromDelaunay(triangulation *delaunay.Triangulation) *Voronoi {
	return calculateVoronoi(triangulation)
}*/

func pointNormalisation(point delaunay.Point, bounds Rectangle) delaunay.Point {
	return delaunay.Point{X: (point.X - bounds.Min.X) / bounds.Width(), Y: (point.Y - bounds.Min.Y) / bounds.Height()}
}

func calculateVoronoi(triangulation *delaunay.Triangulation) *Voronoi {
	// See https://mapbox.github.io/delaunator/ for information

	indexMap := make(map[int]int)
	for e := 0; e < len(triangulation.Triangles); e++ {
		endpoint := triangulation.Triangles[nextHalfEdge(e)]

		if _, ok := indexMap[endpoint]; !ok || triangulation.Halfedges[e] == -1 {
			indexMap[endpoint] = e
		}
	}

	clipArea := Polygon{Points: []delaunay.Point{{X: 0, Y: 0}, {X: 1, Y: 0}, {X: 1, Y: 1}, {X: 0, Y: 1}}}

	var voronoi Voronoi
	voronoi.Polygons = make([]Polygon, len(triangulation.Points))

	var wg sync.WaitGroup
	wg.Add(len(triangulation.Points))

	var edges []int

	for p := 0; p < len(triangulation.Points); p++ {
		incoming := indexMap[p]
		edges = edgesAroundPoint(triangulation, incoming)

		go func(p int, edges []int) {
			defer wg.Done()

			var polygon Polygon
			polygon.DataPoint = triangulation.Points[p]
			polygon.Points = make([]delaunay.Point, 0, len(edges))

			// TODO: Can test for out of bounds points and then only clip polygons which need it
			for i := 0; i < len(edges); i++ {
				polygon.Points = append(polygon.Points, triangleCenter(triangulation, edges[i]/3)) //triangleOfEdge(edges[i])))
			}

			// Clip the polygon to the view
			polygon = SutherlandHodgman(polygon, clipArea)

			polygon.calculateArea()
			polygon.DataPoint = polygon.Centroid()
			voronoi.Polygons[p] = polygon

			/*	if len(polygon.Points) > 0 {
				polygon.calculateArea()
				polygon.DataPoint = polygon.Centroid()
				voronoi.Polygons = append(voronoi.Polygons, polygon)
			}*/
		}(p, edges)
	}

	wg.Wait()

	return &voronoi
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
