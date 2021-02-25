package main

import (
	"bufio"
	"bytes"
	"encoding/binary"
	"encoding/json"
	"fmt"
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
	"github.com/imbbLab/hicvis/voronoi"

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
	Genome       string `short:"g" long:"genome" description:"Genome to load" required:"false"`
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
	defer pairsFile.Close()

	if (pairsFile.Genome() == "" || pairsFile.Genome() == "unknown") && opts.Genome == "" {
		fmt.Println("No genome specified in pairs file or as command line argument. Please specify the genome using the -g option.")
		return
	}

	//fmt.Println(pairsFile.Chromosomes())

	//a, err := pairsFile.Index().Search(pairs.Query{SourceChrom: "chr2L", SourceStart: 12000000, SourceEnd: 15000000, TargetChrom: "chr2L", TargetStart: 10000000, TargetEnd: 15000000})

	//fmt.Println(len(a))

	//"/home/alan/Documents/Work/Alisa/Data_Dm/All_chr4.pairs"

	// Process interact file
	interactFile, err = interact.Parse(opts.InteractFile)
	if err != nil {
		log.Fatal(err)
	}

	/*db, err = createDB("/home/alan/Documents/Chung/Data_Dm/All_chr4.pairs")
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

	//fmt.Println(maxValue)

	img := image.NewGray(image.Rect(0, 0, int(numPixelsInOverviewImage), int(numPixelsInOverviewImage)))
	for y := 0; y < int(numPixelsInOverviewImage); y++ {
		for x := 0; x < int(numPixelsInOverviewImage); x++ {
			pos := (y * int(numPixelsInOverviewImage)) + x
			img.Set(x, y, color.Gray{uint8(db.overviewImage[pos] * 10)})
		}
	}

	f, _ := os.Create("image.png")
	png.Encode(f, img)*/

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

	pairsQuery := pairs.Query{SourceChrom: sourceChrom, SourceStart: uint64(minX), SourceEnd: uint64(maxX), TargetChrom: targetChrom, TargetStart: uint64(minY), TargetEnd: uint64(maxY)}

	fmt.Printf("Processing Search query %v\n", pairsQuery)

	points, err := pairsFile.Index().Search(pairsQuery)
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

	points, err := pairsFile.Index().Search(pairs.Query{SourceChrom: sourceChrom, SourceStart: uint64(minX), SourceEnd: uint64(maxX), TargetChrom: targetChrom, TargetStart: uint64(minY), TargetEnd: uint64(maxY)})
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Normalisation options for voronoi calculation:
	// 1) No normalisation
	// 2) Normalise to chromosomes
	// 3) Normalise to view (current method used in javascript version)

	var dPoints []delaunay.Point

	// Add in ghost points to help with the generation of voronoi cells
	//dPoints = append(dPoints, delaunay.Point{X: -float64(pairsFile.Chromsizes()[sourceChrom].Length), Y: -float64(pairsFile.Chromsizes()[targetChrom].Length)})
	//dPoints = append(dPoints, delaunay.Point{X: float64(2 * pairsFile.Chromsizes()[sourceChrom].Length), Y: -float64(pairsFile.Chromsizes()[targetChrom].Length)})
	//dPoints = append(dPoints, delaunay.Point{X: float64(2 * pairsFile.Chromsizes()[sourceChrom].Length), Y: float64(2 * pairsFile.Chromsizes()[targetChrom].Length)})
	//dPoints = append(dPoints, delaunay.Point{X: -float64(pairsFile.Chromsizes()[sourceChrom].Length), Y: float64(2 * pairsFile.Chromsizes()[targetChrom].Length)})

	//dPoints = append(dPoints, delaunay.Point{X: -float64(pairsFile.Chromsizes()[sourceChrom].Length), Y: float64(maxY+minY) / 2})
	//dPoints = append(dPoints, delaunay.Point{X: float64(2 * pairsFile.Chromsizes()[sourceChrom].Length), Y: float64(maxY+minY) / 2})
	//dPoints = append(dPoints, delaunay.Point{X: float64(maxX+minX) / 2, Y: -float64(pairsFile.Chromsizes()[targetChrom].Length)})
	//dPoints = append(dPoints, delaunay.Point{X: float64(maxX+minX) / 2, Y: float64(2 * pairsFile.Chromsizes()[targetChrom].Length)})

	for _, point := range points {
		if sourceChrom == point.SourceChrom && targetChrom == point.TargetChrom {
			dPoints = append(dPoints, delaunay.Point{X: float64(point.SourcePosition), Y: float64(point.TargetPosition)})
		}
		if targetChrom == point.SourceChrom && sourceChrom == point.TargetChrom {
			dPoints = append(dPoints, delaunay.Point{X: float64(point.TargetPosition), Y: float64(point.SourcePosition)})
		}
	}

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
	vor, err := voronoi.FromPoints(dPoints, voronoi.Rect(float64(minX), float64(minY), float64(maxX), float64(maxY)), smoothingIterations)
	elapsed := time.Since(start)
	//fmt.Println(triangulation)
	fmt.Printf("Finishing voronoi calculation: %s\n", elapsed)

	result := voronoi.ConvertToint16(vor, minX, maxX, minY, maxY, numPixelsX, numPixelsY)

	elapsed = time.Since(start)
	fmt.Printf("[%s] Originally had %d polygons, but now have %d\n", elapsed, len(vor.Polygons), len(result.Polygons))

	bytes, err := json.Marshal(result) //voronoi) //
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Write(bytes)
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
