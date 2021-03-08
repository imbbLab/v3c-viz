package voronoi

import (
	"errors"
	"fmt"
	"log"
	"math"
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
	Polygons []*Polygon
}

//noNormlisation := func(point delaunay.Point) delaunay.Point {
//	return point
//}

//func chromNormalisation(point delaunay.Point, sourceChrom pairs.Chromsize, targetChrom pairs.Chromsize) delaunay.Point {
//	return delaunay.Point{X: point.X / float64(sourceChrom.Length), Y: point.Y / float64(targetChrom.Length)}
//}

func FromPoints(data []delaunay.Point, bounds Rectangle, normalisation Rectangle, smoothingIterations int) (vor *Voronoi, err error) {
	if len(data) < 1 {
		return &Voronoi{}, nil
	}

	var totalPoints []delaunay.Point
	var triangulation *delaunay.Triangulation

	fixedPoint1 := delaunay.Point{X: bounds.Min.X - bounds.Width(), Y: bounds.Min.Y + bounds.Height()/2}
	fixedPoint2 := delaunay.Point{X: bounds.Max.X + bounds.Width(), Y: bounds.Min.Y + bounds.Height()/2}
	fixedPoint3 := delaunay.Point{X: bounds.Min.X + bounds.Width()/2, Y: bounds.Min.Y - bounds.Height()}
	fixedPoint4 := delaunay.Point{X: bounds.Min.X + bounds.Width()/2, Y: bounds.Max.Y + bounds.Height()}

	// Add in points out of bounds to help with the voronoi calculation
	totalPoints = append(totalPoints, fixedPoint1)
	totalPoints = append(totalPoints, fixedPoint2)
	totalPoints = append(totalPoints, fixedPoint3)
	totalPoints = append(totalPoints, fixedPoint4)

	//totalPoints = append(totalPoints, data...)

	for index := range data {
		//totalPoints[index] = pointNormalisation(totalPoints[index], normalisation)
		totalPoints = append(totalPoints, pointNormalisation(data[index], normalisation))
		//dPoints[index] = chromNormalisation(dPoints[index], pairsFile.Chromsizes()[sourceChrom], pairsFile.Chromsizes()[targetChrom])
	}

	start := time.Now()
	midPoint := start
	var elapsed time.Duration

	for i := 0; i <= smoothingIterations; i++ {
		defer func() {
			if r := recover(); r != nil {

				fmt.Printf("Paniced when processing %d points\n", len(totalPoints))
				fmt.Println(r)

				// Check the points for odd features to assist with debugging
				for _, point := range totalPoints {
					if math.IsInf(point.X, 0) || math.IsNaN(point.X) || math.IsInf(point.Y, 0) || math.IsNaN(point.Y) {
						fmt.Printf("Odd point created %v\n", point)
					}
				}

				vor = nil
				err = errors.New("error when performing voronoi")
			}
		}()
		midPoint = time.Now()
		fmt.Println("Starting triangulation...")
		triangulation, err = delaunay.Triangulate(totalPoints)
		if err != nil {
			return nil, err
		}

		elapsed = time.Since(midPoint)
		midPoint = time.Now()
		fmt.Printf("Triangulation: %s\n", elapsed)

		vor = calculateVoronoi(triangulation, bounds)
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
				if polygon != nil && len(polygon.Points) > 0 {
					centroid := polygon.Centroid()
					if math.IsNaN(centroid.X) || math.IsNaN(centroid.Y) || math.IsInf(centroid.X, 0) || math.IsInf(centroid.Y, 0) {
						log.Printf("We have calculated bad centroid for polygon: %v\n", polygon)
					} else {
						totalPoints = append(totalPoints, centroid)
					}
				}
			}
		}

		elapsed = time.Since(midPoint)
		fmt.Printf("Reset: %s\n", elapsed)
	}

	// Scale the points back to original space
	xDim := normalisation.Width()
	yDim := normalisation.Height()

	for polyIndex := range vor.Polygons {
		for index := range vor.Polygons[polyIndex].Points {
			vor.Polygons[polyIndex].Points[index].X = vor.Polygons[polyIndex].Points[index].X * xDim
			vor.Polygons[polyIndex].Points[index].Y = vor.Polygons[polyIndex].Points[index].Y * yDim
		}
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

func calculateVoronoi(triangulation *delaunay.Triangulation, bounds Rectangle) *Voronoi {
	// See https://mapbox.github.io/delaunator/ for information

	indexMap := make(map[int]int)
	for e := 0; e < len(triangulation.Triangles); e++ {
		endpoint := triangulation.Triangles[nextHalfEdge(e)]

		if _, ok := indexMap[endpoint]; !ok || triangulation.Halfedges[e] == -1 {
			indexMap[endpoint] = e
		}
	}

	clipArea := Polygon{Points: []delaunay.Point{{X: bounds.Min.X, Y: bounds.Min.Y}, {X: bounds.Max.X, Y: bounds.Min.Y}, {X: bounds.Max.X, Y: bounds.Max.Y}, {X: bounds.Min.X, Y: bounds.Max.Y}}}

	var voronoi Voronoi
	polygons := make([]*Polygon, len(triangulation.Points))

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

			if len(polygon.Points) < 3 {
				log.Printf("We have a problem polygon: %v\n", polygon)
				return
			}

			// Clip the polygon to the view

			//polygon.calculateArea()
			//area := polygon.Area
			polygon = SutherlandHodgman(polygon, clipArea)

			polygon.calculateArea()
			polygon.DataPoint = polygon.Centroid()
			polygons[p] = &polygon

			/*	if len(polygon.Points) > 0 {
				polygon.calculateArea()
				polygon.DataPoint = polygon.Centroid()
				voronoi.Polygons = append(voronoi.Polygons, polygon)
			}*/
		}(p, edges)
	}

	wg.Wait()

	voronoi.Polygons = make([]*Polygon, 0, len(polygons))

	for _, polygon := range polygons {
		if polygon == nil || len(polygon.Points) < 3 {
			continue
		}

		centroid := polygon.Centroid()
		if !math.IsNaN(centroid.X) && !math.IsNaN(centroid.Y) { // && centroid.X >= bounds.Min.X && centroid.X <= bounds.Max.X &&
			//centroid.Y >= bounds.Min.Y && centroid.Y <= bounds.Max.Y {
			voronoi.Polygons = append(voronoi.Polygons, polygon)
		}
	}

	return &voronoi
}

func edgesAroundPoint(triangulation *delaunay.Triangulation, start int) []int {
	var result []int

	// On average we expect to have 6 edges
	result = make([]int, 0, 6)

	var outgoing int
	incoming := start
	firstTime := true
	for firstTime || (incoming != -1 && incoming != start) {
		result = append(result, incoming)

		//outgoing = nextHalfEdge(incoming)
		if incoming%3 == 2 {
			outgoing = incoming - 2
		} else {
			outgoing = incoming + 1
		}

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
	// Inlined functions to improve performance but comments indicate original functions

	//vertices := pointsOfTriangle(triangulation, t)
	//vertices := []delaunay.Point{triangulation.Points[triangulation.Triangles[t*3]], triangulation.Points[triangulation.Triangles[t*3+1]], triangulation.Points[triangulation.Triangles[t*3+2]]}
	a := triangulation.Points[triangulation.Triangles[t*3]]
	b := triangulation.Points[triangulation.Triangles[t*3+1]]
	c := triangulation.Points[triangulation.Triangles[t*3+2]]

	//return circumcenter(vertices[0], vertices[1], vertices[2])
	ad := a.X*a.X + a.Y*a.Y
	bd := b.X*b.X + b.Y*b.Y
	cd := c.X*c.X + c.Y*c.Y
	D := 2 * (a.X*(b.Y-c.Y) + b.X*(c.Y-a.Y) + c.X*(a.Y-b.Y))
	return delaunay.Point{
		X: 1 / D * (ad*(b.Y-c.Y) + bd*(c.Y-a.Y) + cd*(a.Y-b.Y)),
		Y: 1 / D * (ad*(c.X-b.X) + bd*(a.X-c.X) + cd*(b.X-a.X)),
	}
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
