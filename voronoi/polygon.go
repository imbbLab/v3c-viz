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
