package voronoi

import "math"

func ConvertToint16(voronoi *Voronoi, bounds Rectangle, normalisation Rectangle, numPixelsX, numPixelsY int) *Int16VoronoiResult {
	var result Int16VoronoiResult

	if voronoi == nil || len(voronoi.Polygons) < 1 {
		return &result
	}

	xDim := bounds.Width()
	yDim := bounds.Height()
	//xDim := float64(maxX - minX)
	//yDim := float64(maxY - minY)
	for _, polygon := range voronoi.Polygons {
		//startX := math.Round((polygon.Points[0].X - float64(minX)) / xDim * 700)
		//startY := math.Round((polygon.Points[0].Y - float64(minY)) / yDim * 700)

		if len(polygon.Points) < 1 {
			continue
		}

		minPolyX := polygon.Points[0].X
		maxPolyX := polygon.Points[0].X
		minPolyY := polygon.Points[0].Y
		maxPolyY := polygon.Points[0].Y

		//singlePixel := true
		//doublePixel := true

		for i := 0; i < len(polygon.Points); i++ {
			x := polygon.Points[i].X
			y := polygon.Points[i].Y

			if minPolyX > x {
				minPolyX = x
			}
			if maxPolyX < x {
				maxPolyX = x
			}

			if minPolyY > y {
				minPolyY = y
			}
			if maxPolyY < y {
				maxPolyY = y
			}
			/*singlePixel = singlePixel && startX == math.Round((polygon.Points[i].X-float64(minX))/xDim*700) &&
				startY == math.Round((polygon.Points[i].Y-float64(minY))/yDim*700)

			doublePixel = doublePixel && math.Abs(startX-math.Round((polygon.Points[i].X-float64(minX))/xDim*700)) < 2 &&
				math.Abs(startY-math.Round((polygon.Points[i].Y-float64(minY))/yDim*700)) < 2*/

		}

		// Normalise to pixels in view
		//minPolyX = (minPolyX - float64(minX)) / xDim * float64(numPixelsX)
		//maxPolyX = (maxPolyX - float64(minX)) / xDim * float64(numPixelsX)
		//minPolyY = (minPolyY - float64(minY)) / yDim * float64(numPixelsY)
		//maxPolyY = (maxPolyY - float64(minY)) / yDim * float64(numPixelsY)
		minPolyX = (minPolyX - bounds.Min.X) / xDim * float64(numPixelsX)
		maxPolyX = (maxPolyX - bounds.Min.X) / xDim * float64(numPixelsX)
		minPolyY = (minPolyY - bounds.Min.Y) / yDim * float64(numPixelsY)
		maxPolyY = (maxPolyY - bounds.Min.Y) / yDim * float64(numPixelsY)

		// TODO: Remove duplicates in .Points and .TwoPoints

		if math.Round(minPolyX) == math.Round(maxPolyX) && math.Round(minPolyY) == math.Round(maxPolyY) {
			result.Points = append(result.Points, int16Point{X: int16(math.Round(minPolyX)), Y: int16(math.Round(minPolyY))})
		} else if maxPolyX-minPolyX < 2 && maxPolyY-minPolyY < 2 {
			result.TwoPoints = append(result.TwoPoints, int16TwoPoint{MinX: int16(math.Floor(minPolyX)), MaxX: int16(math.Ceil(maxPolyX)),
				MinY: int16(math.Floor(minPolyY)), MaxY: int16(math.Ceil(maxPolyY))})
		} else { // if minPolyX > 0 || minPolyY > 0 || maxPolyX <= float64(numPixelsX) || maxPolyY <= float64(numPixelsY) {
			result.Polygons = append(result.Polygons, polygonToint16(polygon, bounds, normalisation, numPixelsX, numPixelsY))
		}
	}

	return &result
}

func polygonToint16(polygon Polygon, bounds Rectangle, normalisation Rectangle, pixelsX, pixelsY int) int16Polygon {
	var newPoly int16Polygon

	maxValue := float64(math.MaxInt16)

	xDim := bounds.Width()
	yDim := bounds.Height()

	for _, point := range polygon.Points {
		//x := math.Round((point.X - float64(minX)) / xDim * float64(pixelsX))
		//y := math.Round((point.Y - float64(minY)) / yDim * float64(pixelsY))
		x := math.Round((point.X - bounds.Min.X) / xDim * float64(pixelsX))
		y := math.Round((point.Y - bounds.Min.Y) / yDim * float64(pixelsY))
		//x := point.X * float64(pixelsX)
		//y := point.Y * float64(pixelsY)

		// Compress the value into int16 - as the number of pixels shouldn't be close to the max value, this shouldn't affect the voronoi result
		for x < -maxValue || y < -maxValue {
			x /= 2
			y /= 2
		}
		for x > maxValue || y > maxValue {
			x /= 2
			y /= 2
		}

		newPoly.DataPoint = []int16{int16(math.Round((polygon.DataPoint.X - bounds.Min.X) / xDim * float64(pixelsX))), int16(math.Round((polygon.DataPoint.Y - bounds.Min.Y) / yDim * float64(pixelsY)))}
		newPoly.Points = append(newPoly.Points, int16(x), int16(y)) //int16Point{X: int16(x), Y: int16(y)})
		newPoly.Area = math.Round(polygon.Area * normalisation.Width() * normalisation.Height())
	}

	return newPoly
}

type int16Point struct {
	X int16
	Y int16
}

type int16TwoPoint struct {
	MinX int16
	MaxX int16
	MinY int16
	MaxY int16
}

type int16Polygon struct {
	DataPoint []int16
	Points    []int16 //int16Point
	Area      float64
}

type Int16VoronoiResult struct {
	Polygons []int16Polygon

	Points    []int16Point
	TwoPoints []int16TwoPoint
}
