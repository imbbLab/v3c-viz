package voronoi

import (
	"fmt"
	"testing"

	"github.com/fogleman/delaunay"
)

func TestCentroid(t *testing.T) {
	var polygon Polygon

	polygon.Points = []delaunay.Point{{X: 0, Y: 0}, {X: 1, Y: 1}, {X: 1, Y: 0}}
	polygon.calculateCentroid()
	fmt.Println(polygon.Centroid)

	polygon.Points = []delaunay.Point{{X: 0, Y: 0.1}, {X: 1, Y: 0.1}, {X: 1, Y: 0.2}}
	polygon.calculateCentroid()
	fmt.Println(polygon.Centroid)

	// Centroid() returns NaN when multiple points are the same
	polygon.Points = []delaunay.Point{{X: 0, Y: 0.18923369060985756}, {X: 1, Y: 0.19052614083264668}, {X: 1, Y: 0.19052614083264668}}
	polygon.calculateCentroid()
	fmt.Println(polygon.Centroid)

	polygon.Points = []delaunay.Point{{X: 0, Y: 0.18923369060985756}, {X: 1, Y: 0.19052614083264668}, {X: 1, Y: 0.19052614083264668}, {X: -0, Y: 0.18923369060985756}}
	polygon.calculateCentroid()
	fmt.Println(polygon.Centroid)

}
