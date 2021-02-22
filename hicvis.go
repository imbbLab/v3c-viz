package main

import (
	"bufio"
	"bytes"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"image"
	"image/color"
	"image/png"
	"log"
	"net"
	"net/http"
	"os"
	"os/exec"
	"regexp"
	"runtime"
	"strconv"
	"strings"
	"time"

	"github.com/jessevdk/go-flags"
	"github.com/tidwall/buntdb"

	"github.com/gorilla/mux"

	"github.com/imbbLab/hicvis/interact"
	"github.com/imbbLab/hicvis/pairs"

	"github.com/fogleman/delaunay"
)

//type Bucket {
//}

type chromDatabase struct {
	db               *buntdb.DB
	chromosomeName   string
	chromosomeLength uint32
	overviewImage    []uint32
	oNumBins         uint32
}

/*type Database struct {
	db *bolt.DB

	bucketSize uint32

	minValue uint32
	maxValue uint32
}*/

var db *chromDatabase
var interactFile *interact.InteractFile

var numPixelsInOverviewImage uint32 = 200

var opts struct {
	// Example of a required flag
	DataFile     string `short:"d" long:"data" description:"Data to load (.pairs)" required:"true"`
	InteractFile string `short:"i" long:"interact" description:"Interact file to visualise" required:"false"`
	Port         string `short:"p" long:"port" description:"Port used for the server" default:"5002"`
}

// open opens the specified URL in the default browser of the user.
// Taken from: https://stackoverflow.com/questions/39320371/how-start-web-server-to-open-page-in-browser-in-golang
func open(url string) error {
	var cmd string
	var args []string

	switch runtime.GOOS {
	case "windows":
		cmd = "cmd"
		args = []string{"/c", "start"}
	case "darwin":
		cmd = "open"
	default: // "linux", "freebsd", "openbsd", "netbsd"
		cmd = "xdg-open"
	}
	args = append(args, url)
	return exec.Command(cmd, args...).Start()
}

// func main() {
// 	_, err := flags.Parse(&opts)

// 	if err != nil {
// 		log.Fatal(err)
// 		return
// 	}

// 	location := ":" + opts.Port

// 	listener, err := net.Listen("tcp", location)
// 	if err != nil {
// 		log.Fatal(err)
// 	}

// 	// The browser can connect now because the listening socket is open.

// 	open("http://localhost" + location)

// 	server.Start(listener)
// }

var pairsFile pairs.File

func main() {
	_, err := flags.Parse(&opts)

	if err != nil {
		log.Fatal(err)
		return
	}

	pairsFile, err = pairs.Parse(opts.DataFile) //"/home/alan/Documents/Chung/Data_Dm/Lib001.U_dedup.pairs.gz")
	if err != nil {
		log.Fatal(err)
		return
	}

	fmt.Println(pairsFile.Chromosomes())

	a, err := pairsFile.Index().Search(pairs.Query{SourceChrom: "chr2L", SourceStart: 12000000, SourceEnd: 15000000, TargetChrom: "chr2L", TargetStart: 10000000, TargetEnd: 15000000})

	fmt.Println(len(a))

	//"/home/alan/Documents/Work/Alisa/Data_Dm/All_chr4.pairs"

	// Process interact file
	interactFile, err = interact.Parse(opts.InteractFile)
	if err != nil {
		log.Fatal(err)
	}

	db, err = createDB("/home/alan/Documents/Chung/Data_Dm/All_chr4.pairs")
	if err != nil {
		log.Fatal(err)
	}

	//fmt.Println(db)

	maxValue := uint32(0)

	for i := 0; i < len(db.overviewImage); i++ {
		if db.overviewImage[i] > maxValue {
			maxValue = db.overviewImage[i]
		}
	}

	fmt.Println(maxValue)

	img := image.NewGray(image.Rect(0, 0, int(numPixelsInOverviewImage), int(numPixelsInOverviewImage)))
	for y := 0; y < int(numPixelsInOverviewImage); y++ {
		for x := 0; x < int(numPixelsInOverviewImage); x++ {
			pos := (y * int(numPixelsInOverviewImage)) + x
			img.Set(x, y, color.Gray{uint8(db.overviewImage[pos] * 10)})
		}
	}

	f, _ := os.Create("image.png")
	png.Encode(f, img)

	location := ":" + opts.Port

	listener, err := net.Listen("tcp", location)
	if err != nil {
		log.Fatal(err)
	}

	open("http://localhost" + location)

	startServer(listener)
}

// GetDetails provides information on the loaded file
func GetDetails(w http.ResponseWriter, r *http.Request) {
	chromosomes := pairsFile.Chromosomes()
	chromsizes := pairsFile.Chromsizes()

	orderedChromosomes := make([]pairs.Chromsize, len(chromosomes))

	for index, chrom := range chromosomes {
		orderedChromosomes[index] = chromsizes[chrom]
	}

	type details struct {
		Chromosomes []pairs.Chromsize
		Name        string `json:"name"`
		HasInteract bool   `json:"hasInteract"`
		MinX        int    `json:"minX"`
		MaxX        int    `json:"maxX"`
		MinY        int    `json:"minY"`
		MaxY        int    `json:"maxY"`
	}

	dets, _ := json.Marshal(&details{Chromosomes: orderedChromosomes, Name: db.chromosomeName, HasInteract: interactFile != nil, MinX: 0, MinY: 0, MaxX: int(db.chromosomeLength), MaxY: int(db.chromosomeLength)})
	w.Write(dets)
}

func GetPoints(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query()

	sourceChrom := query.Get("sourceChrom")
	targetChrom := query.Get("targetChrom")

	minX, err := strconv.Atoi(query.Get("xStart"))
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	minY, err := strconv.Atoi(query.Get("yStart"))
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	maxX, err := strconv.Atoi(query.Get("xEnd"))
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	maxY, err := strconv.Atoi(query.Get("yEnd"))
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	/*
		var pointData []uint32

		db.db.View(func(tx *buntdb.Tx) error {
			tx.Intersects(db.chromosomeName, fmt.Sprintf("[%d %d],[%d %d]", minX, minY, maxX, maxY), func(key, val string) bool {
				points := strings.Split(val[1:len(val)-1], " ")

				xPos, err := strconv.Atoi(points[0])
				if err != nil {
					return false
				}
				yPos, err := strconv.Atoi(points[1])
				if err != nil {
					return false
				}

				pointData = append(pointData, uint32(xPos), uint32(yPos))
				return true
			})
			return nil
		})

		db.db.View(func(tx *buntdb.Tx) error {
			tx.Intersects(db.chromosomeName, fmt.Sprintf("[%d %d],[%d %d]", minY, minX, maxY, maxX), func(key, val string) bool {
				points := strings.Split(val[1:len(val)-1], " ")

				yPos, err := strconv.Atoi(points[0])
				if err != nil {
					return false
				}
				xPos, err := strconv.Atoi(points[1])
				if err != nil {
					return false
				}

				pointData = append(pointData, uint32(xPos), uint32(yPos))
				return true
			})
			return nil
		})*/

	points, err := pairsFile.Index().Search(pairs.Query{SourceChrom: sourceChrom, SourceStart: uint64(minX), SourceEnd: uint64(maxX), TargetChrom: targetChrom, TargetStart: uint64(minY), TargetEnd: uint64(maxY)})
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	var pointData []uint32
	for _, point := range points {
		pointData = append(pointData, uint32(point.SourcePosition), uint32(point.TargetPosition))
	}

	w.Header().Set("Content-Type", "application/octet-stream")
	w.Write(uint32ToByte(pointData))
}

func GetVoronoi(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query()

	sourceChrom := query.Get("sourceChrom")
	targetChrom := query.Get("targetChrom")

	minX, err := strconv.Atoi(query.Get("xStart"))
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	minY, err := strconv.Atoi(query.Get("yStart"))
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	maxX, err := strconv.Atoi(query.Get("xEnd"))
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	maxY, err := strconv.Atoi(query.Get("yEnd"))
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	points, err := pairsFile.Index().Search(pairs.Query{SourceChrom: sourceChrom, SourceStart: uint64(minX), SourceEnd: uint64(maxX), TargetChrom: targetChrom, TargetStart: uint64(minY), TargetEnd: uint64(maxY)})
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	var dPoints []delaunay.Point

	var pointData []uint32
	for _, point := range points {
		pointData = append(pointData, uint32(point.SourcePosition), uint32(point.TargetPosition))

		dPoints = append(dPoints, delaunay.Point{X: float64(point.SourcePosition), Y: float64(point.TargetPosition)})
		dPoints = append(dPoints, delaunay.Point{X: float64(point.TargetPosition), Y: float64(point.SourcePosition)})
	}

	start := time.Now()
	fmt.Printf("Starting vornoi calculation with %d points\n", len(dPoints))
	fmt.Printf("10th point = %v\n", dPoints[10])
	triangulation, err := delaunay.Triangulate(dPoints)
	voronoi := calculateVoronoi(triangulation)
	elapsed := time.Since(start)
	//fmt.Println(triangulation)
	fmt.Printf("Finishing voronoi calculation: %s\n", elapsed)

	bytes, err := json.Marshal(voronoi)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Write(bytes)
}

type Polygon struct {
	Points []delaunay.Point
	Area   float64
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

type Voronoi struct {
	Polygons []Polygon
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

	var voronoi Voronoi
	voronoi.Polygons = make([]Polygon, 0, len(triangulation.Points))

	for p := 0; p < len(triangulation.Points); p++ {
		incoming := indexMap[p]
		edges := edgesAroundPoint(triangulation, incoming)

		var polygon Polygon
		polygon.Points = make([]delaunay.Point, 0, len(edges))

		for i := 0; i < len(edges); i++ {
			polygon.Points = append(polygon.Points, triangleCenter(triangulation, triangleOfEdge(edges[i])))
		}

		polygon.calculateArea()
		voronoi.Polygons = append(voronoi.Polygons, polygon)
	}
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

func uint32ToByte(data []uint32) []byte {
	var buf bytes.Buffer

	for _, d := range data {
		//err := binary.Write(&buf, binary.BigEndian, f)
		err := binary.Write(&buf, binary.LittleEndian, d)

		if err != nil {
			fmt.Printf("binary.Write failed: (%d) %s", d, err)
			break
		}
	}

	return buf.Bytes()
}

func float64ToByte(floats []float64) []byte {
	var buf bytes.Buffer

	for _, f := range floats {
		//err := binary.Write(&buf, binary.BigEndian, f)
		err := binary.Write(&buf, binary.LittleEndian, f)

		if err != nil {
			fmt.Printf("binary.Write failed: (%f) %s", f, err)
			break
		}
	}

	return buf.Bytes()
}

func GetInteract(w http.ResponseWriter, r *http.Request) {
	bytes, err := json.Marshal(interactFile)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Write(bytes)
}

func GetDensityImage(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query()

	sourceChrom := query.Get("sourceChrom")
	targetChrom := query.Get("targetChrom")

	numBins, err := strconv.Atoi(query.Get("numBins"))
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	minX, err := strconv.Atoi(query.Get("xStart"))
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	minY, err := strconv.Atoi(query.Get("yStart"))
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	maxX, err := strconv.Atoi(query.Get("xEnd"))
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	maxY, err := strconv.Atoi(query.Get("yEnd"))
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	/*if minX == 0 && minY == 0 && maxX == int(db.chromosomeLength) && maxY == int(db.chromosomeLength) {
		if uint32(numBins) != db.oNumBins {
			db.createOverviewImage(uint32(numBins))
		}

		w.Write(uint32ToByte(db.overviewImage))
	} else {
		overviewImage := make([]uint32, numBins*numBins)

		binSizeX := ((maxX - minX) / numBins) + 1
		binSizeY := ((maxY - minY) / numBins) + 1

		db.db.View(func(tx *buntdb.Tx) error {
			tx.Intersects(db.chromosomeName, fmt.Sprintf("[%d %d],[%d %d]", minX, minY, maxX, maxY), func(key, val string) bool {
				points := strings.Split(val[1:len(val)-1], " ")

				xPos, err := strconv.Atoi(points[0])
				if err != nil {
					return false
				}
				yPos, err := strconv.Atoi(points[1])
				if err != nil {
					return false
				}

				xPos = (xPos - minX) / binSizeX
				yPos = (yPos - minY) / binSizeY

				loc := (yPos * numBins) + xPos

				overviewImage[loc]++
				return true
			})
			return nil
		})

		db.db.View(func(tx *buntdb.Tx) error {
			tx.Intersects(db.chromosomeName, fmt.Sprintf("[%d %d],[%d %d]", minY, minX, maxY, maxX), func(key, val string) bool {
				points := strings.Split(val[1:len(val)-1], " ")

				yPos, err := strconv.Atoi(points[0])
				if err != nil {
					return false
				}
				xPos, err := strconv.Atoi(points[1])
				if err != nil {
					return false
				}

				xPos = (xPos - minX) / binSizeX
				yPos = (yPos - minY) / binSizeY

				loc := (yPos * numBins) + xPos

				overviewImage[loc]++
				return true
			})
			return nil
		})

	}*/

	overviewImage, err := pairsFile.Image(pairs.Query{SourceChrom: sourceChrom, SourceStart: uint64(minX), SourceEnd: uint64(maxX), TargetChrom: targetChrom, TargetStart: uint64(minY), TargetEnd: uint64(maxY)}, uint64(numBins))
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/octet-stream")
	w.Write(uint32ToByte(overviewImage))
}

func startServer(listener net.Listener) {
	router := mux.NewRouter().StrictSlash(true)

	router.HandleFunc("/details", GetDetails)
	router.HandleFunc("/points", GetPoints)
	router.HandleFunc("/voronoi", GetVoronoi)
	router.HandleFunc("/interact", GetInteract)
	router.HandleFunc("/densityImage", GetDensityImage)
	//router.HandleFunc("/", ListProjects).Methods("GET")
	router.PathPrefix("/").Handler(http.FileServer(http.Dir("./static/")))

	log.Fatal(http.Serve(listener, router))
}

func (cdb *chromDatabase) createOverviewImage(numBins uint32) {
	cdb.oNumBins = numBins
	cdb.overviewImage = make([]uint32, cdb.oNumBins*cdb.oNumBins)

	binSizeX := ((cdb.chromosomeLength) / cdb.oNumBins) + 1
	binSizeY := ((cdb.chromosomeLength) / cdb.oNumBins) + 1

	db.db.View(func(tx *buntdb.Tx) error {
		tx.Intersects(db.chromosomeName, "[-inf -inf],[inf inf]", func(key, val string) bool {
			points := strings.Split(val[1:len(val)-1], " ")

			xPos, err := strconv.Atoi(points[0])
			if err != nil {
				return false
			}
			yPos, err := strconv.Atoi(points[1])
			if err != nil {
				return false
			}

			xPos = (xPos) / int(binSizeX)
			yPos = (yPos) / int(binSizeY)

			cdb.overviewImage[(yPos*int(cdb.oNumBins))+xPos]++
			cdb.overviewImage[(xPos*int(cdb.oNumBins))+yPos]++
			return true
		})
		return nil
	})
}

func createDB(filename string) (*chromDatabase, error) {
	var cdb chromDatabase
	var err error

	// Figure out which chromosome it is from the filename
	r := regexp.MustCompile(`[A-z_]*chr(?P<chr>[A-Z0-9]+).pairs`)
	matches := r.FindStringSubmatch(filename)
	cdb.chromosomeName = "chr" + matches[1]

	fmt.Println(cdb.chromosomeName)

	file, err := os.Open(filename)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	searchString := "#chromsize: " + matches[1]

	// Find the line in the pairs file which indicates the length of the chromosome
	for scanner.Scan() {
		line := scanner.Text()

		if strings.HasPrefix(line, searchString) {
			splitStrings := strings.SplitAfter(line, searchString)
			chromosomeLength, err := strconv.Atoi(strings.TrimSpace((splitStrings[1])))
			if err != nil {
				return nil, err
			}
			cdb.chromosomeLength = uint32(chromosomeLength)
		}

		if strings.HasPrefix(line, "#columns") {
			break
		}
	}

	// Open the data.db file. It will be created if it doesn't exist.
	cdb.db, err = buntdb.Open(":memory:")

	cdb.oNumBins = numPixelsInOverviewImage
	cdb.overviewImage = make([]uint32, cdb.oNumBins*cdb.oNumBins)
	oImageBinSize := (cdb.chromosomeLength / cdb.oNumBins) + 1

	cdb.db.CreateSpatialIndex(cdb.chromosomeName, cdb.chromosomeName+":*:pos", buntdb.IndexRect)

	cdb.db.Update(func(tx *buntdb.Tx) error {
		i := 0

		for scanner.Scan() {
			line := scanner.Text()
			if line[0] == '#' {
				continue
			}

			fields := strings.Fields(line)
			sourcePos, err := strconv.Atoi(fields[2])
			if err != nil {
				log.Fatal(err)
			}
			targetPos, err := strconv.Atoi(fields[4])
			if err != nil {
				log.Fatal(err)
			}

			xPos := uint32(sourcePos) / oImageBinSize
			yPos := uint32(targetPos) / oImageBinSize
			cdb.overviewImage[(yPos*cdb.oNumBins)+xPos]++
			cdb.overviewImage[(xPos*cdb.oNumBins)+yPos]++

			tx.Set(fmt.Sprintf("%s:%d:pos", cdb.chromosomeName, i), fmt.Sprintf("[%d %d]", sourcePos, targetPos), nil)
			i++
			//tx.Set(fmt.Sprintf("%s:%d:pos", cdb.chromosomeName, i), fmt.Sprintf("[%d %d]", targetPos, sourcePos), nil)
			//i++
		}

		return nil
	})

	return &cdb, err
}
