package main

import (
	"bufio"
	"bytes"
	"encoding/binary"
	"encoding/csv"
	"encoding/json"
	"errors"
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
	"sort"
	"strconv"
	"strings"

	"github.com/biogo/hts/bgzf"

	"github.com/jessevdk/go-flags"
	"github.com/tidwall/buntdb"

	"github.com/gorilla/mux"
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

type Order int

const (
	Chr1Chr2Pos1Pos2 Order = iota
)

type Shape int

const (
	UpperTriangle Shape = iota
)

type Chromsize struct {
	Name   string
	Length uint64
}

type PairsFile struct {
	Sorted         Order
	Shape          Shape
	GenomeAssembly string
	Chromsizes     map[string]Chromsize
	Samheader      []string

	Index PairsIndex
}

type PairsQuery struct {
	SourceChrom string
	SourceStart uint64
	SourceEnd   uint64

	TargetChrom string
	TargetStart uint64
	TargetEnd   uint64
}

func (query PairsQuery) Reverse() PairsQuery {
	var revQuery PairsQuery
	revQuery.SourceChrom = query.TargetChrom
	revQuery.SourceStart = query.TargetStart
	revQuery.SourceEnd = query.TargetEnd

	revQuery.TargetChrom = query.SourceChrom
	revQuery.TargetStart = query.SourceStart
	revQuery.TargetEnd = query.SourceEnd

	return revQuery
}

type PairsEntry struct {
	SourceChrom    string
	SourcePosition uint64
	TargetChrom    string
	TargetPosition uint64
}

func (entry PairsEntry) ChromPairName() string {
	return entry.SourceChrom + "-" + entry.TargetChrom
}

func (entry PairsEntry) IsInRange(query PairsQuery) bool {
	if entry.SourceChrom != query.SourceChrom || entry.TargetChrom != query.TargetChrom {
		return false
	}
	if entry.SourcePosition >= query.SourceStart && entry.SourcePosition <= query.SourceEnd &&
		entry.TargetPosition >= query.TargetStart && entry.TargetPosition <= query.TargetEnd {
		return true
	}

	return false
}

func parseEntry(line string) (*PairsEntry, error) {
	var entry PairsEntry
	var err error

	splitLine := strings.Split(line, "\t")

	if len(splitLine) < 4 {
		// We have a problem, the line isn't formatted correctly
		fmt.Println(line)
		return nil, errors.New("Invalid line")
	}

	entry.SourceChrom = splitLine[1]
	entry.TargetChrom = splitLine[3]

	entry.SourcePosition, err = strconv.ParseUint(splitLine[2], 10, 64)
	if err != nil {
		return nil, err
	}
	entry.TargetPosition, err = strconv.ParseUint(splitLine[4], 10, 64)
	if err != nil {
		return nil, err
	}

	return &entry, nil
}

type ChromPairChunk struct {
	StartChunk bgzf.Chunk
	EndChunk   bgzf.Chunk

	ChromPairName string
	NumberLines   int

	StartEntry *PairsEntry
	EndEntry   *PairsEntry
}

type PairsIndex struct {
	DataStart bgzf.Chunk

	ChromPairStart map[string]bgzf.Chunk
	ChromPairEnd   map[string]bgzf.Chunk

	ChromPairChunks map[string][]*ChromPairChunk
}

func (index PairsIndex) Search(reader *bgzf.Reader, pairsQuery PairsQuery) ([]*PairsEntry, error) {
	var err error

	// TODO: Check validity of search (e.g. start < end)

	// Create the reverse query to make searching easier
	revQuery := pairsQuery.Reverse()

	var chunkstoLoad []*ChromPairChunk
	withinBounds := false

	chromPairName := pairsQuery.SourceChrom + "-" + pairsQuery.TargetChrom
	if chromPairs, ok := index.ChromPairChunks[chromPairName]; ok {
		for index, pair := range chromPairs {
			if pairsQuery.SourceStart > pair.StartEntry.SourcePosition && pairsQuery.SourceStart < pair.EndEntry.SourcePosition {
				withinBounds = true
			}
			if withinBounds {
				chunkstoLoad = append(chunkstoLoad, chromPairs[index])
			}

			if pairsQuery.SourceEnd > pair.StartEntry.SourcePosition && pairsQuery.SourceEnd < pair.EndEntry.SourcePosition {
				withinBounds = false
			}
		}
	}
	// Process the inverse chrom pair
	chromPairName = pairsQuery.TargetChrom + "-" + pairsQuery.SourceChrom
	if chromPairs, ok := index.ChromPairChunks[chromPairName]; ok {
		for index, pair := range chromPairs {
			if pairsQuery.TargetStart > pair.StartEntry.SourcePosition && pairsQuery.TargetStart < pair.EndEntry.SourcePosition {
				withinBounds = true
			}
			if withinBounds {
				chunkstoLoad = append(chunkstoLoad, chromPairs[index])
			}

			if pairsQuery.TargetEnd > pair.StartEntry.SourcePosition && pairsQuery.TargetEnd < pair.EndEntry.SourcePosition {
				withinBounds = false
			}
		}
	}

	// Sort the chunks to load by File position
	sort.Slice(chunkstoLoad, func(i, j int) bool {
		return chunkstoLoad[i].StartChunk.Begin.File < chunkstoLoad[j].StartChunk.Begin.File
	})

	// Merge together chunks (skipping) they follow on from one another to
	// avoid seeking, then read in necessary number of lines to find desired data points
	seekRequired := true
	var bufReader *bufio.Reader
	var lineData []byte

	var pairs []*PairsEntry

	for index, chunk := range chunkstoLoad {
		if index > 0 {
			// Same chunk as before, so skip it
			if chunk == chunkstoLoad[index-1] {
				continue
			}

			// Chunks follow on, so don't need to seek
			if chunk.StartChunk.Begin.File == chunkstoLoad[index-1].EndChunk.End.File {
				seekRequired = false
			} else {
				seekRequired = true
			}
		}

		if seekRequired {
			err := reader.Seek(chunk.StartChunk.Begin)
			if err != nil {
				return nil, err
			}

			bufReader = bufio.NewReader(reader)

			// Skip the first partial line, this should be captured by the previous chunk
			_, err = bufReader.ReadBytes('\n')
			if err != nil {
				return nil, err
			}
		}

		for i := 0; i < chunk.NumberLines; i++ {
			lineData, err = bufReader.ReadBytes('\n')
			if err != nil {
				log.Fatal(err)
			}

			// Skip all comments
			for lineData[0] == '#' {
				lineData, err = bufReader.ReadBytes('\n')
				if err != nil {
					return nil, err
				}
			}

			entry, err := parseEntry(string(lineData))
			if err != nil {
				return nil, err
			}

			// Check that the data fits in the requested window
			if entry.IsInRange(pairsQuery) || entry.IsInRange(revQuery) {
				pairs = append(pairs, entry)
			}

			//fmt.Println(entry)
		}
	}

	return pairs, nil
}

func outputImage(overviewImage []uint32, numBins int, name string) {
	maxValue := uint32(0)

	for i := 0; i < len(overviewImage); i++ {
		if overviewImage[i] > maxValue {
			maxValue = overviewImage[i]
		}
	}

	if maxValue > 100 {
		fmt.Println(maxValue)

		img := image.NewGray(image.Rect(0, 0, numBins, numBins))
		for y := 0; y < numBins; y++ {
			for x := 0; x < numBins; x++ {
				pos := (y * numBins) + x
				img.Set(x, y, color.Gray{uint8(float64(overviewImage[pos]) / float64(maxValue) * 25555)})
			}
		}

		f, _ := os.Create(name + ".png")
		png.Encode(f, img)
	}

}

func processBGZF(reader io.Reader) (*PairsFile, error) {
	bReader, err := bgzf.NewReader(reader, 0)
	if err != nil {
		return nil, err
	}
	defer bReader.Close()

	bufReader := bufio.NewReader(bReader)

	firstLine, err := bufReader.ReadBytes('\n')
	if err != nil {
		fmt.Println("Failed to read from buffer")
		return nil, err
	}

	if !strings.Contains(string(firstLine), "## pairs format v1.0") {
		return nil, errors.New("Invalid .pairs file: Missing header line. First line is: " + string(firstLine))
	}

	var pairsFile PairsFile
	pairsFile.Chromsizes = make(map[string]Chromsize)

	var firstNonComment string

	//lineNumber := 0
	for {
		lineData, err := bufReader.ReadBytes('\n')
		if err != nil {
			return nil, err
		}

		lineToProcess := string(lineData[:len(lineData)-1])

		if lineToProcess[0] == '#' {
			splitString := strings.SplitN(lineToProcess[1:], ":", 2)

			tag := strings.TrimSpace(splitString[0])
			value := strings.TrimSpace(splitString[1])

			switch tag {
			case "sorted":
				if value == "chr1-chr2-pos1-pos2" {
					pairsFile.Sorted = Chr1Chr2Pos1Pos2
				} else {
					return nil, errors.New("Unsupported .pairs file: not supported sorted: " + value)
				}
			case "shape":
				if value == "upper triangle" {
					pairsFile.Shape = UpperTriangle
				} else {
					return nil, errors.New("Unsupported .pairs file: not supported shape: " + value)
				}
			case "genome_assembly":
				pairsFile.GenomeAssembly = value
			case "chromsize":
				splitValue := strings.Split(value, " ")

				var chromsize Chromsize
				chromsize.Name = strings.TrimSpace(splitValue[0])
				chromsize.Length, err = strconv.ParseUint(strings.TrimSpace(splitValue[1]), 10, 64)
				if err != nil {
					return nil, err
				}

				//pairsFile.Chromsizes = append(pairsFile.Chromsizes, chromsize)
				pairsFile.Chromsizes[chromsize.Name] = chromsize
			case "samheader":
				pairsFile.Samheader = append(pairsFile.Samheader, value)
			default:
				fmt.Println(lineToProcess)
			}
		} else {
			firstNonComment = lineToProcess

			break
		}

	}

	maxLinesPerIndex := 100000
	numBins := uint64(500)

	imageData := make([]uint32, numBins*numBins)

	pairsFile.Index.ChromPairStart = make(map[string]bgzf.Chunk)
	pairsFile.Index.ChromPairEnd = make(map[string]bgzf.Chunk)
	pairsFile.Index.ChromPairChunks = make(map[string][]*ChromPairChunk)

	firstEntry, err := parseEntry(firstNonComment)
	if err != nil {
		return nil, err
	}

	pairsFile.Index.DataStart = bReader.LastChunk()
	pairsFile.Index.ChromPairStart[firstEntry.ChromPairName()] = bReader.LastChunk()

	lastEntry := firstEntry.ChromPairName()

	curChromPairChunk := &ChromPairChunk{}
	pairsFile.Index.ChromPairChunks[firstEntry.ChromPairName()] = append(pairsFile.Index.ChromPairChunks[firstEntry.ChromPairName()], curChromPairChunk)
	curChromPairChunk.StartChunk = bReader.LastChunk()
	curChromPairChunk.StartEntry = firstEntry
	curChromPairChunk.EndChunk = bReader.LastChunk()
	curChromPairChunk.EndEntry = firstEntry

	binSizeX := (pairsFile.Chromsizes[firstEntry.SourceChrom].Length / numBins) + 1
	binSizeY := (pairsFile.Chromsizes[firstEntry.TargetChrom].Length / numBins) + 1
	imageIndex := int(firstEntry.TargetPosition/binSizeY)*int(numBins) + int(firstEntry.SourcePosition/binSizeX)
	imageData[imageIndex]++
	imageIndex = int(firstEntry.SourcePosition/binSizeX)*int(numBins) + int(firstEntry.TargetPosition/binSizeY)
	imageData[imageIndex]++

	// Already looked at the first line (above) so start at 1
	lineCount := 1

	for {
		lineData, err := bufReader.ReadBytes('\n')
		if err != nil {
			if err == io.EOF {
				//fmt.Println("Finished reading data")
				break
			}
			return nil, err
		}

		lineToProcess := string(lineData[:len(lineData)-1])
		curEntry, err := parseEntry(lineToProcess)
		if err != nil {
			return nil, err
		}

		// Check if the new line is describing a different source and target chromosome
		if lastEntry != curEntry.ChromPairName() {
			lineCount = 0

			pairsFile.Index.ChromPairEnd[lastEntry] = bReader.LastChunk()
			pairsFile.Index.ChromPairStart[curEntry.ChromPairName()] = bReader.LastChunk()

			outputImage(imageData, int(numBins), lastEntry)
			imageData = make([]uint32, numBins*numBins)
			binSizeX = (pairsFile.Chromsizes[curEntry.SourceChrom].Length / numBins) + 1
			binSizeY = (pairsFile.Chromsizes[curEntry.TargetChrom].Length / numBins) + 1
		}

		// Starting a new chunk when lineCount reset to 0 (either because new source/target or too many lines)
		if lineCount == 0 {
			curChromPairChunk = &ChromPairChunk{}
			pairsFile.Index.ChromPairChunks[curEntry.ChromPairName()] = append(pairsFile.Index.ChromPairChunks[curEntry.ChromPairName()], curChromPairChunk)
			curChromPairChunk.StartChunk = bReader.LastChunk()
			curChromPairChunk.StartEntry = curEntry
			curChromPairChunk.EndChunk = bReader.LastChunk()
			curChromPairChunk.EndEntry = curEntry
		}

		// Update the line count
		lineCount++

		// Update the latest 'end' chunk found and the current line count
		curChromPairChunk.NumberLines = lineCount
		curChromPairChunk.EndChunk = bReader.LastChunk()
		curChromPairChunk.EndEntry = curEntry

		imageIndex = int(curEntry.TargetPosition/binSizeY)*int(numBins) + int(curEntry.SourcePosition/binSizeX)
		imageData[imageIndex]++
		imageIndex = int(curEntry.SourcePosition/binSizeX)*int(numBins) + int(curEntry.TargetPosition/binSizeY)
		imageData[imageIndex]++

		// If we have too many lines, then start a new indexed chunk on the next line
		if lineCount >= maxLinesPerIndex {
			lineCount = 0
		}

		lastEntry = curEntry.ChromPairName()
	}

	pairsFile.Index.ChromPairEnd[lastEntry] = bReader.LastChunk()

	fmt.Println("Finished creating index")

	//a, err := pairsFile.Index.Search(bReader, PairsQuery{SourceChrom: "chr2L", SourceStart: 12000000, SourceEnd: 15000000, TargetChrom: "chr2L", TargetStart: 10000000, TargetEnd: 15000000})

	//fmt.Println(len(a))
	return &pairsFile, nil
}

func processPairsReader(reader io.Reader) error {
	var err error
	scanner := bufio.NewScanner(reader)

	// Advance to the first line
	if !scanner.Scan() {
		return errors.New("Invalid .pairs file: No data?")
	}
	firstLine := scanner.Text()
	if !strings.Contains(firstLine, "## pairs format v1.0") {
		return errors.New("Invalid .pairs file: Missing header line. First line is: " + firstLine)
	}

	var pairsFile PairsFile
	pairsFile.Chromsizes = make(map[string]Chromsize)

	lineNumber := 0
	for scanner.Scan() {
		lineToProcess := scanner.Text()

		if lineToProcess[0] == '#' {
			splitString := strings.SplitN(lineToProcess[1:], ":", 2)

			tag := strings.TrimSpace(splitString[0])
			value := strings.TrimSpace(splitString[1])

			switch tag {
			case "sorted":
				if value == "chr1-chr2-pos1-pos2" {
					pairsFile.Sorted = Chr1Chr2Pos1Pos2
				} else {
					return errors.New("Unsupported .pairs file: not supported sorted: " + value)
				}
			case "shape":
				if value == "upper triangle" {
					pairsFile.Shape = UpperTriangle
				} else {
					return errors.New("Unsupported .pairs file: not supported shape: " + value)
				}
			case "genome_assembly":
				pairsFile.GenomeAssembly = value
			case "chromsize":
				splitValue := strings.Split(value, " ")

				var chromsize Chromsize
				chromsize.Name = strings.TrimSpace(splitValue[0])
				chromsize.Length, err = strconv.ParseUint(strings.TrimSpace(splitValue[1]), 10, 64)
				if err != nil {
					return err
				}

				pairsFile.Chromsizes[chromsize.Name] = chromsize
				//pairsFile.Chromsizes = append(pairsFile.Chromsizes, chromsize)
			case "samheader":
				pairsFile.Samheader = append(pairsFile.Samheader, value)
			default:
				fmt.Println(lineToProcess)
			}
		} else {
			fmt.Println(lineToProcess)

		}

		lineNumber++

		if lineNumber > 5000 {
			fmt.Println(pairsFile)
			break
		}
	}

	return nil
}

func processPairsFile(filename string) (*PairsFile, error) {
	file, err := os.Open(filename)

	if err != nil {
		log.Fatal(err)
	}
	defer file.Close()

	// TODO: Check if .gz, if so then create gzip reader
	/*gz, err := gzip.NewReader(file)

	if err != nil {
		log.Fatal(err)
	}

	defer gz.Close()*/

	return processBGZF(file)
}

var pairsFile *PairsFile

func main() {
	_, err := flags.Parse(&opts)

	if err != nil {
		log.Fatal(err)
		return
	}

	pairsFile, err = processPairsFile(opts.DataFile) //"/home/alan/Documents/Chung/Data_Dm/Lib001.U_dedup.pairs.gz")
	if err != nil {
		log.Fatal(err)
		return
	}

	return

	//"/home/alan/Documents/Work/Alisa/Data_Dm/All_chr4.pairs"

	// Process interact file
	interactFile, err = parseInteract(opts.InteractFile)
	if err != nil {
		log.Fatal(err)
	}

	/*db, err = createDB(opts.DataFile)
	if err != nil {
		log.Fatal(err)
	}*/

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
