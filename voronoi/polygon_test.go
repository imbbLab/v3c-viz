package voronoi

import (
	"fmt"
	"testing"

	"github.com/fogleman/delaunay"
)

func TestCentroid(t *testing.T) {
	var polygon Polygon

	polygon.Points = []delaunay.Point{{0, 0}, {1, 1}, {1, 0}}
	fmt.Println(polygon.Centroid())

	polygon.Points = []delaunay.Point{{0, 0.1}, {1, 0.1}, {1, 0.2}}
	fmt.Println(polygon.Centroid())

	// Centroid() returns NaN when multiple points are the same
	polygon.Points = []delaunay.Point{{0, 0.18923369060985756}, {1, 0.19052614083264668}, {1, 0.19052614083264668}}
	fmt.Println(polygon.Centroid())

	polygon.Points = []delaunay.Point{{0, 0.18923369060985756}, {1, 0.19052614083264668}, {1, 0.19052614083264668}, {-0, 0.18923369060985756}}

	fmt.Println(polygon.Centroid())

}
