package main

import (
	"bytes"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"math"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path"
	"runtime"
	"strconv"
	"strings"
	"time"

	"github.com/jessevdk/go-flags"

	"github.com/gorilla/mux"

	"github.com/imbbLab/hicvis/interact"
	"github.com/imbbLab/hicvis/pairs"
	"github.com/imbbLab/hicvis/voronoi"

	"github.com/fogleman/delaunay"
)

var interactFile *interact.InteractFile
var pairsFile pairs.File

var opts struct {
	// Example of a required flag
	DataFile             string `short:"d" long:"data" description:"Data to load (.pairs)" required:"true"`
	Genome               string `short:"g" long:"genome" description:"Genome to load" required:"false"`
	InteractFile         string `short:"i" long:"interact" description:"Interact file to visualise" required:"false"`
	MaximumVoronoiPoints int    `long:"maxpoints" description:"Maximum points to calculate voronoi" default:"100000"`
	Port                 string `short:"p" long:"port" description:"Port used for the server" default:"5002"`
	Server               bool   `long:"server" description:"Start just the server and don't automatically open the browser"`
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

func main() {
	_, err := flags.Parse(&opts)

	if err != nil {
		log.Fatal(err)
		return
	}

	pairsFile, err = pairs.Parse(opts.DataFile)
	if err != nil {
		log.Fatal(err)
		return
	}
	defer pairsFile.Close()

	if (pairsFile.Genome() == "" || pairsFile.Genome() == "unknown") && opts.Genome == "" {
		fmt.Println("No genome specified in pairs file or as command line argument. Please specify the genome using the -g option.")
		return
	}

	// Process interact file
	interactFile, err = interact.Parse(opts.InteractFile)
	if err != nil {
		log.Fatal(err)
	}

	location := ":" + opts.Port

	listener, err := net.Listen("tcp", location)
	if err != nil {
		log.Fatal(err)
	}

	if !opts.Server {
		open("http://localhost" + location)
	}

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
		Genome      string
		Chromosomes []pairs.Chromsize
		HasInteract bool `json:"hasInteract"`
	}

	genome := pairsFile.Genome()
	if opts.Genome != "" {
		genome = opts.Genome
	}

	dets, _ := json.Marshal(&details{Genome: genome, Chromosomes: orderedChromosomes, HasInteract: interactFile != nil})
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

	pairsQuery := pairs.Query{SourceChrom: sourceChrom, SourceStart: uint64(minX), SourceEnd: uint64(maxX), TargetChrom: targetChrom, TargetStart: uint64(minY), TargetEnd: uint64(maxY)}

	fmt.Printf("Processing Search query %v\n", pairsQuery)

	points, err := pairsFile.Search(pairsQuery)
	if err != nil {
		fmt.Println(err)
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

	numPixelsX, err := strconv.Atoi(query.Get("pixelsX"))
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	numPixelsY, err := strconv.Atoi(query.Get("pixelsY"))
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	smoothingIterations, err := strconv.Atoi(query.Get("smoothingIterations"))
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

	pairsQuery := pairs.Query{SourceChrom: sourceChrom, SourceStart: uint64(minX), SourceEnd: uint64(maxX), TargetChrom: targetChrom, TargetStart: uint64(minY), TargetEnd: uint64(maxY)}

	points, err := pairsFile.Search(pairsQuery)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	result, err := performVoronoi(points, pairsQuery, smoothingIterations, numPixelsX, numPixelsY)

	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	bytes, err := json.Marshal(result) //voronoi) //
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Write(bytes)
}

func boundingPolygonFromQuery(query pairs.Query) voronoi.Polygon {
	sourceLength := float64(pairsFile.Chromsizes()[query.SourceChrom].Length)
	targetLength := float64(pairsFile.Chromsizes()[query.TargetChrom].Length)

	bounds := voronoi.Rect(float64(query.SourceStart)/sourceLength, float64(query.TargetStart)/targetLength, float64(query.SourceEnd)/sourceLength, float64(query.TargetEnd)/targetLength)
	//bounds := voronoi.Rect(float64(query.SourceStart), float64(query.TargetStart), float64(query.SourceEnd), float64(query.TargetEnd))

	boundingPolygon := voronoi.Polygon{Points: []delaunay.Point{{X: bounds.Min.X, Y: bounds.Min.Y}, {X: bounds.Max.X, Y: bounds.Min.Y}, {X: bounds.Max.X, Y: bounds.Max.Y}, {X: bounds.Min.X, Y: bounds.Max.Y}}}

	if query.SourceChrom == query.TargetChrom {
		// Clip with triangle
		triangle := voronoi.Polygon{Points: []delaunay.Point{{X: 0, Y: 0}, {X: 1, Y: 1}, {X: 0, Y: 1}}}

		boundingPolygon = voronoi.SutherlandHodgman(boundingPolygon, triangle)
	}

	return boundingPolygon
}

func performVoronoi(points []*pairs.Entry, query pairs.Query, smoothingIterations int, numPixelsX, numPixelsY int) (*voronoi.Voronoi, error) {
	// Normalisation options for voronoi calculation:
	// 1) No normalisation
	// 2) Normalise to chromosomes
	// 3) Normalise to view (current method used in javascript version)

	// Normalise to chromosome length seems to be the most appropriate and provides the best looking voronoi diagrams.
	// If this is not done, then the comparison of chromosomes of different lengths produces distorted looking voronoi diagrams

	var dPoints []delaunay.Point
	revQuery := query.Reverse()

	// Check whether the data point is within the query range to avoid processing unnecessary points.
	// When source == target, then don't need to (and shouldn't) check the reverse query as this is mirrored around line x = y
	for _, point := range points {
		if point.IsInRange(query) {
			dPoints = append(dPoints, delaunay.Point{X: float64(point.SourcePosition), Y: float64(point.TargetPosition)})
		} else if query.SourceChrom != query.TargetChrom && point.IsInRange(revQuery) {
			dPoints = append(dPoints, delaunay.Point{X: float64(point.TargetPosition), Y: float64(point.SourcePosition)})
		}
	}

	// TODO: Apply normalisation in for loop above rather than in voronoi.FromPoints function

	start := time.Now()
	fmt.Printf("Starting vornoi calculation with %d points\n", len(dPoints))

	// Apply normalisation?
	/*	for index := range dPoints {
			dPoints[index] = voronoi.pointNormalisation(dPoints[index], minX, maxX, minY, maxY)
			//dPoints[index] = chromNormalisation(dPoints[index], pairsFile.Chromsizes()[sourceChrom], pairsFile.Chromsizes()[targetChrom])
		}

		// Perform Delaunay triangulation
		triangulation, err := delaunay.Triangulate(dPoints)
		voronoi := calculateVoronoi(triangulation)*/
	//vor, err := voronoi.FromPoints(dPoints, voronoi.Rect(0, 0, float64(pairsFile.Chromsizes()[sourceChrom].Length), float64(pairsFile.Chromsizes()[targetChrom].Length)))

	sourceLength := float64(pairsFile.Chromsizes()[query.SourceChrom].Length)
	targetLength := float64(pairsFile.Chromsizes()[query.TargetChrom].Length)
	//bounds := voronoi.Rect(float64(query.SourceStart)/sourceLength, float64(query.TargetStart)/targetLength, float64(query.SourceEnd)/sourceLength, float64(query.TargetEnd)/targetLength)
	normalisation := voronoi.Rect(0, 0, sourceLength, targetLength)

	boundingPolygon := boundingPolygonFromQuery(query)

	vor, err := voronoi.FromPoints(dPoints, boundingPolygon, normalisation, smoothingIterations)
	elapsed := time.Since(start)
	//fmt.Println(triangulation)
	fmt.Printf("Finishing voronoi calculation: %s [%d polygons]\n", elapsed, len(vor.Polygons))

	//elapsed = time.Since(start)
	//fmt.Printf("[%s] Originally had %d polygons, but now have %d\n", elapsed, len(vor.Polygons), len(result.Polygons))

	return vor, err
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

func SetInteract(w http.ResponseWriter, r *http.Request) {
	body, err := ioutil.ReadAll(r.Body)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	bodyData := string(body)
	fmt.Println(bodyData)

	type interactData struct {
		Interactions []interact.Interaction
	}
	var interactions interactData

	err = json.Unmarshal([]byte(bodyData), &interactions)
	if err != nil {
		errorMessage := "Error when attempting to unmarshal annotation name " + bodyData + ": " + err.Error()
		log.Println(errorMessage)

		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	fmt.Println(interactions)
	interactFile = new(interact.InteractFile)
	interactFile.Interactions = make(map[string][]interact.Interaction)

	// Make sure that interactions include 'chr'
	for index, interaction := range interactions.Interactions {
		if !strings.Contains(interactions.Interactions[index].SourceChrom, "chr") {
			interactions.Interactions[index].SourceChrom = "chr" + interaction.SourceChrom
		}

		if !strings.Contains(interactions.Interactions[index].TargetChrom, "chr") {
			interactions.Interactions[index].TargetChrom = "chr" + interaction.TargetChrom
		}

		chromPairName := interactions.Interactions[index].ChromPairName()

		interactFile.Interactions[chromPairName] = append(interactFile.Interactions[chromPairName], interactions.Interactions[index])
	}

	fmt.Println(interactFile.Interactions)
}

func GetVoronoiAndImage(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query()

	sourceChrom := query.Get("sourceChrom")
	targetChrom := query.Get("targetChrom")

	numBins, err := strconv.Atoi(query.Get("numBins"))
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	numPixelsX, err := strconv.Atoi(query.Get("pixelsX"))
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	numPixelsY, err := strconv.Atoi(query.Get("pixelsY"))
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	smoothingIterations, err := strconv.Atoi(query.Get("smoothingIterations"))
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

	pairsQuery := pairs.Query{SourceChrom: sourceChrom, SourceStart: uint64(minX), SourceEnd: uint64(maxX), TargetChrom: targetChrom, TargetStart: uint64(minY), TargetEnd: uint64(maxY)}

	overviewImage, err := pairsFile.Image(pairsQuery, uint64(numBins))
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	buf := new(bytes.Buffer)
	binary.Write(buf, binary.BigEndian, uint32(numBins))
	err = binary.Write(buf, binary.BigEndian, overviewImage)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	sumPoints := 0
	for _, count := range overviewImage {
		sumPoints += int(count)
	}

	fmt.Println(pairsQuery)

	// If looking at intrachromosomal interactions then data is stored in upper triangle form, so modify query to cover full area
	if sourceChrom == targetChrom {
		if pairsQuery.TargetStart < pairsQuery.SourceStart {
			temp := pairsQuery.TargetStart
			pairsQuery.TargetStart = pairsQuery.SourceStart
			pairsQuery.SourceStart = temp

			//temp = pairsQuery.TargetEnd
			//pairsQuery.TargetEnd = pairsQuery.SourceEnd
			//pairsQuery.SourceEnd = temp
		}

		if pairsQuery.TargetEnd < pairsQuery.SourceEnd {
			temp := pairsQuery.TargetEnd
			pairsQuery.TargetEnd = pairsQuery.SourceEnd
			pairsQuery.SourceEnd = temp
		}
	}

	fmt.Println(pairsQuery)

	//var result *voronoi.Int16VoronoiResult
	var result *voronoi.Voronoi
	if sumPoints < opts.MaximumVoronoiPoints {
		points, err := pairsFile.Search(pairsQuery)

		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		result, err = performVoronoi(points, pairsQuery, smoothingIterations, numPixelsX, numPixelsY)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
	} else {
		var points []*pairs.Entry

		for y := 0; y < numBins; y++ {
			for x := 0; x < numBins; x++ {
				index := y*numBins + x

				if overviewImage[index] > 0 {
					sourcePos := uint64(math.Floor((float64(x)/float64(numBins))*float64(maxX-minX))) + uint64(minX)
					targetPos := uint64(math.Floor((float64(y)/float64(numBins))*float64(maxY-minY))) + uint64(minY)

					if sourceChrom == targetChrom && sourcePos > targetPos {
						temp := targetPos
						targetPos = sourcePos
						sourcePos = temp
					}

					points = append(points, &pairs.Entry{SourceChrom: sourceChrom,
						SourcePosition: sourcePos,
						TargetChrom:    targetChrom,
						TargetPosition: targetPos})
				}
			}
		}

		result, err = performVoronoi(points, pairsQuery, smoothingIterations, numPixelsX, numPixelsY)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
	}

	//binSizeX := float64(maxX-minX) / float64(numPixelsX)
	//binSizeY := float64(maxY-minY) / float64(numPixelsY)

	voronoiBuffer := new(bytes.Buffer)
	err = binary.Write(voronoiBuffer, binary.BigEndian, uint32(len(result.Polygons)))
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	for polyIndex := range result.Polygons {
		err = binary.Write(voronoiBuffer, binary.BigEndian, uint32(len(result.Polygons[polyIndex].Points)))
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		err = binary.Write(voronoiBuffer, binary.BigEndian, result.Polygons[polyIndex].Area)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		if result.Polygons[polyIndex].Clipped {
			err = binary.Write(voronoiBuffer, binary.BigEndian, uint8(1))
		} else {
			err = binary.Write(voronoiBuffer, binary.BigEndian, uint8(0))
		}
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		cendroid := result.Polygons[polyIndex].Centroid()
		err = binary.Write(voronoiBuffer, binary.BigEndian, cendroid.X) //(cendroid.X-float64(minX))/binSizeX)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		err = binary.Write(voronoiBuffer, binary.BigEndian, cendroid.Y) //(cendroid.Y-float64(minY))/binSizeY)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		for index := range result.Polygons[polyIndex].Points {
			//result.Polygons[polyIndex].Points[index].X = (result.Polygons[polyIndex].Points[index].X - float64(minX)) / binSizeX
			//result.Polygons[polyIndex].Points[index].Y = (result.Polygons[polyIndex].Points[index].Y - float64(minY)) / binSizeY

			err = binary.Write(voronoiBuffer, binary.BigEndian, result.Polygons[polyIndex].Points[index].X)
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			err = binary.Write(voronoiBuffer, binary.BigEndian, result.Polygons[polyIndex].Points[index].Y)
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
		}
	}

	w.Header().Set("Content-Type", "application/octet-stream")

	w.Write(buf.Bytes())
	w.Write(voronoiBuffer.Bytes())

	// bytes, err := json.Marshal(struct {
	// 	Voronoi *voronoi.Voronoi //*voronoi.Int16VoronoiResult
	// 	Image   string
	// }{Voronoi: result,
	// 	Image: base64.StdEncoding.EncodeToString(buf.Bytes())}) //voronoi) //
	// if err != nil {
	// 	http.Error(w, err.Error(), http.StatusInternalServerError)
	// 	return
	// }

	// w.Write(bytes)

}

func min(a, b uint64) uint64 {
	if a < b {
		return a
	}

	return b
}

func max(a, b uint64) uint64 {
	if a > b {
		return a
	}

	return b
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

func uploadFile(w http.ResponseWriter, r *http.Request) {
	// Parse our multipart form, 10 << 20 specifies a maximum
	// upload of 10 MB files.
	r.ParseMultipartForm(10 << 20)
	// FormFile returns the first file for the given key `myFile`
	// it also returns the FileHeader so we can get the Filename,
	// the Header and the size of the file
	file, handler, err := r.FormFile("myFile")
	if err != nil {
		fmt.Println("Error Retrieving the File")
		fmt.Println(err)
		return
	}
	defer file.Close()
	fmt.Printf("Uploaded File: %+v\n", handler.Filename)
	fmt.Printf("File Size: %+v\n", handler.Size)
	fmt.Printf("MIME Header: %+v\n", handler.Header)

	tempFolder := path.Join("static", "temp")
	err = os.MkdirAll(tempFolder, os.ModePerm)
	if err != nil {
		fmt.Println(err)
	}

	// Create a temporary file within our temp-images directory that follows
	// a particular naming pattern
	//tempFile, err := os.Open(tempFolder, "*"+handler.Filename)
	tempFile, err := os.OpenFile(path.Join(tempFolder, handler.Filename), os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		fmt.Println(err)
	}
	defer tempFile.Close()

	// read all of the contents of our uploaded file into a
	// byte array
	fileBytes, err := ioutil.ReadAll(file)
	if err != nil {
		fmt.Println(err)
	}
	// write this byte array to our temporary file
	tempFile.Write(fileBytes)
	// return that we have successfully uploaded our file!
	fmt.Fprintf(w, "temp/"+handler.Filename)
}

func startServer(listener net.Listener) {
	router := mux.NewRouter().StrictSlash(true)

	router.HandleFunc("/upload", uploadFile)
	router.HandleFunc("/details", GetDetails)
	router.HandleFunc("/points", GetPoints)
	router.HandleFunc("/voronoi", GetVoronoi)
	router.HandleFunc("/voronoiandimage", GetVoronoiAndImage)
	router.HandleFunc("/interact", GetInteract).Methods("GET")
	router.HandleFunc("/interact", SetInteract).Methods("POST")
	router.HandleFunc("/densityImage", GetDensityImage)
	//router.HandleFunc("/", ListProjects).Methods("GET")
	router.PathPrefix("/").Handler(http.FileServer(http.Dir("./static/")))

	log.Fatal(http.Serve(listener, router))
}
