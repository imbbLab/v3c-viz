package main

import (
	"bufio"
	"bytes"
	"encoding/binary"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"image"
	"image/color"
	"image/png"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"os/exec"
	"regexp"
	"runtime"
	"strconv"
	"strings"

	"github.com/boltdb/bolt"
	"github.com/jessevdk/go-flags"
	"github.com/tidwall/buntdb"

	"github.com/gorilla/mux"
)

//type Bucket {
//}

type Database struct {
	db *bolt.DB

	bucketSize uint32

	minValue uint32
	maxValue uint32
}

type InteractFile struct {
	Interactions []Interaction
}

type Interaction struct {
	Chrom        string
	ChromStart   uint64
	ChromEnd     uint64
	Name         string
	Score        uint64
	Value        float64
	Exp          string
	Colour       string
	SourceChrom  string
	SourceStart  uint64
	SourceEnd    uint64
	SourceName   string
	SourceStrand string
	TargetChrom  string
	TargetStart  uint64
	TargetEnd    uint64
	TargetName   string
	TargetStrand string
}

var db *chromDatabase
var interactFile *InteractFile

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

func parseInteract(filename string) (*InteractFile, error) {
	if filename == "" {
		return nil, nil
	}

	iFile, err := os.Open(filename)
	if err != nil {
		return nil, err
	}
	defer iFile.Close()

	// Skip the first line as it is a header
	row1, err := bufio.NewReader(iFile).ReadSlice('\n')
	if err != nil {
		return nil, err
	}
	_, err = iFile.Seek(int64(len(row1)), io.SeekStart)
	if err != nil {
		return nil, err
	}

	reader := csv.NewReader(iFile)
	reader.Comma = '\t'

	var interactFile InteractFile

	for {
		row, err := reader.Read()
		if err == io.EOF {
			break
		} else if err != nil {
			panic(err) // or handle it another way
		}
		// use the `row` here

		var interaction Interaction
		interaction.Chrom = row[0]
		interaction.ChromStart, err = strconv.ParseUint(row[1], 10, 64)
		if err != nil {
			return nil, err
		}
		interaction.ChromEnd, err = strconv.ParseUint(row[2], 10, 64)
		if err != nil {
			return nil, err
		}
		interaction.Name = row[3]
		interaction.Score, err = strconv.ParseUint(row[4], 10, 64)
		if err != nil {
			return nil, err
		}
		interaction.Value, err = strconv.ParseFloat(row[5], 64)
		if err != nil {
			return nil, err
		}
		interaction.Exp = row[6]
		interaction.Colour = row[7]
		interaction.SourceChrom = row[8]
		interaction.SourceStart, err = strconv.ParseUint(row[9], 10, 64)
		if err != nil {
			return nil, err
		}
		interaction.SourceEnd, err = strconv.ParseUint(row[10], 10, 64)
		if err != nil {
			return nil, err
		}
		interaction.SourceName = row[11]
		interaction.SourceStrand = row[12]
		interaction.TargetChrom = row[13]
		interaction.TargetStart, err = strconv.ParseUint(row[14], 10, 64)
		if err != nil {
			return nil, err
		}
		interaction.TargetEnd, err = strconv.ParseUint(row[15], 10, 64)
		if err != nil {
			return nil, err
		}
		interaction.TargetName = row[16]
		interaction.TargetStrand = row[17]

		interactFile.Interactions = append(interactFile.Interactions, interaction)
	}

	return &interactFile, nil
}

func main() {
	_, err := flags.Parse(&opts)

	if err != nil {
		log.Fatal(err)
		return
	}

	//"/home/alan/Documents/Work/Alisa/Data_Dm/All_chr4.pairs"

	// Process interact file
	interactFile, err = parseInteract(opts.InteractFile)
	if err != nil {
		log.Fatal(err)
	}

	db, err = createDB(opts.DataFile)
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

func GetDetails(w http.ResponseWriter, r *http.Request) {
	type details struct {
		Name        string `json:"name"`
		HasInteract bool   `json:"hasInteract"`
		MinX        int    `json:"minX"`
		MaxX        int    `json:"maxX"`
		MinY        int    `json:"minY"`
		MaxY        int    `json:"maxY"`
	}

	dets, _ := json.Marshal(&details{Name: db.chromosomeName, HasInteract: interactFile != nil, MinX: 0, MinY: 0, MaxX: int(db.chromosomeLength), MaxY: int(db.chromosomeLength)})
	w.Write(dets)
}

func GetPoints(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query()

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
	})

	w.Header().Set("Content-Type", "application/octet-stream")
	w.Write(uint32ToByte(pointData))
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

	w.Header().Set("Content-Type", "application/octet-stream")

	if minX == 0 && minY == 0 && maxX == int(db.chromosomeLength) && maxY == int(db.chromosomeLength) {
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

		w.Write(uint32ToByte(overviewImage))
	}
}

func startServer(listener net.Listener) {
	router := mux.NewRouter().StrictSlash(true)

	router.HandleFunc("/details", GetDetails)
	router.HandleFunc("/points", GetPoints)
	router.HandleFunc("/interact", GetInteract)
	router.HandleFunc("/densityImage", GetDensityImage)
	//router.HandleFunc("/", ListProjects).Methods("GET")
	router.PathPrefix("/").Handler(http.FileServer(http.Dir("./static/")))

	log.Fatal(http.Serve(listener, router))
}

type chromDatabase struct {
	db               *buntdb.DB
	chromosomeName   string
	chromosomeLength uint32
	overviewImage    []uint32
	oNumBins         uint32
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
