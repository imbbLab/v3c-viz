package pairs

import (
	"bufio"
	"encoding/binary"
	"errors"
	"fmt"
	"image"
	"image/color"
	"image/png"
	"io"
	"log"
	"math"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	//"github.com/biogo/hts/bgzf"
	"github.com/imbbLab/v3c-viz/pairs/bgzf"
)

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

type ChromPairChunk struct {
	StartChunk bgzf.Chunk
	EndChunk   bgzf.Chunk

	ChromPairName string
	NumberLines   int

	//	StartEntry *Entry
	//	EndEntry   *Entry

	MinX uint64
	MaxX uint64
	MinY uint64
	MaxY uint64
}

type Image struct {
	Width  uint32
	Height uint32
	Data   []uint32
}

type File interface {
	//Index() Index
	Close()

	Genome() string

	ChromPairList() []string
	Search(pairsQuery Query) ([]*Entry, error)

	Image(query Query, viewQuery Query, binSizeX uint64, binSizeY uint64) (Image, error)

	Chromsizes() map[string]Chromsize
	Chromosomes() []string
}

func (file baseFile) Genome() string {
	return file.GenomeAssembly
}

func (file baseFile) Chromosomes() []string {
	return file.chromosomes
}

func (file baseFile) Chromsizes() map[string]Chromsize {
	return file.chromsizes
}

type baseFile struct {
	Sorted         Order
	Shape          Shape
	GenomeAssembly string
	Samheader      []string

	chromosomes []string
	chromsizes  map[string]Chromsize

	file *os.File
}

func (file baseFile) Close() {
	file.file.Close()
}

func (file *baseFile) parseHeader(reader *bufio.Reader) (*Entry, error) {
	var err error

	firstLine, err := reader.ReadBytes('\n')
	if err != nil {
		fmt.Println("Failed to read from buffer")
		return nil, err
	}

	if !strings.Contains(string(firstLine), "## pairs format v1.0") {
		return nil, errors.New("Invalid .pairs file: Missing header line. First line is: " + string(firstLine))
	}

	for {
		lineData, err := reader.ReadBytes('\n')
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
					file.Sorted = Chr1Chr2Pos1Pos2
				} else {
					return nil, errors.New("Unsupported .pairs file: not supported sorted: " + value)
				}
			case "shape":
				if value == "upper triangle" {
					file.Shape = UpperTriangle
				} else {
					return nil, errors.New("Unsupported .pairs file: not supported shape: " + value)
				}
			case "genome_assembly":
				file.GenomeAssembly = value
			case "chromsize":
				splitValue := strings.Split(value, " ")

				var chromsize Chromsize
				chromsize.Name = strings.TrimSpace(splitValue[0])
				chromsize.Length, err = strconv.ParseUint(strings.TrimSpace(splitValue[1]), 10, 64)
				if err != nil {
					return nil, err
				}

				file.chromosomes = append(file.chromosomes, chromsize.Name)

				//pairsFile.Chromsizes = append(pairsFile.Chromsizes, chromsize)
				file.chromsizes[chromsize.Name] = chromsize
			case "samheader":
				file.Samheader = append(file.Samheader, value)
			default:
				fmt.Println(lineToProcess)
			}
		} else {
			return parseEntry(lineToProcess)
		}
	}

	// TODO: Return error saying no first entry?
	//return nil, nil
}

/*func NewFile() *File {
	var pairsFile File
	pairsFile.Chromsizes = make(map[string]Chromsize)

	return &pairsFile
}*/

func OutputImage(overviewImage []uint32, numBins int, name string) {
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

func Parse(filename string) (File, error) {
	// TODO: Check which function to call, ParseBGZF or ParsePlain

	// TODO: Check if .gz, if so then create gzip reader
	/*gz, err := gzip.NewReader(file)

	if err != nil {
		log.Fatal(err)
	}

	defer gz.Close()*/

	return ParseBGZF(filename)
}

type bgzfFile struct {
	baseFile

	bgzfReader *bgzf.Reader

	//index *BGZFIndex
	index *indexHeader

	mu sync.Mutex
}

//func (file bgzfFile) Index() Index {
//	return file.index
//}

func (file *bgzfFile) Close() {
	file.mu.Lock()
	file.bgzfReader.Close()
	file.mu.Unlock()

	file.baseFile.Close()
}

func (file *bgzfFile) ChromPairList() []string {
	var pairs []string

	for _, value := range file.index.TargetNames {
		pairs = append(pairs, value)
	}

	return pairs
}

type fileChunk struct {
	Start bgzf.Offset
	End   bgzf.Offset
}

func (file *bgzfFile) Query(query Query, entryFunction func(entry *Entry)) error {
	var err error

	// Create the reverse query to make searching easier
	revQuery := query.Reverse()
	chunks := file.index.getChunksFromQuery(query)

	// Merge together chunks (skipping) they follow on from one another to
	// avoid seeking, then read in necessary number of lines to find desired data points
	//seekRequired := true
	var bufReader *bufio.Reader
	var lineData []byte
	var entry *Entry

	//fmt.Printf("About to process chunks %v\n", chunks)

	file.mu.Lock()

	for _, chunk := range chunks {
		defer func() {
			if x := recover(); x != nil {
				// recovering from a panic; x contains whatever was passed to panic()
				log.Printf("run time panic: %v", x)
				log.Printf("%v Start [%v]\n", chunk, file.bgzfReader)

				// if you just want to log the panic, panic again
				panic(x)
			}
		}()

		err = file.bgzfReader.Seek(chunk.Start)
		if err != nil {
			return err
		}

		bufReader = bufio.NewReader(file.bgzfReader)

		finished := false

		// Skip the first partial line, this should be captured by the previous chunk
		//lineData, err = bufReader.ReadBytes('\n')
		//if err != nil {
		//	return err
		//}

		for !finished {
			lineData, err = bufReader.ReadBytes('\n')
			if err != nil {
				return err
			}

			// Skip all comments
			for lineData[0] == '#' {
				lineData, err = bufReader.ReadBytes('\n')
				if err != nil {
					return err
				}
			}

			entry, err = parseEntry(string(lineData))
			if err != nil {
				fmt.Printf("Problem parsing entry: %s\n", string(lineData))
				return err
			}

			// Check that the data fits in the requested window
			if entry.IsInRange(query) || entry.IsInRange(revQuery) {
				entryFunction(entry)
			}

			// If we've gone past the end of our query region, then stop
			if file.bgzfReader.LastChunk().Begin.File > chunk.End.File {
				finished = true
				break
			}
		}
	}

	file.mu.Unlock()

	return err
}

func (file *bgzfFile) Search(query Query) ([]*Entry, error) {
	var err error

	var pairs []*Entry

	err = file.Query(query, func(entry *Entry) {
		pairs = append(pairs, entry)
	})

	return pairs, err
}

func (file *bgzfFile) Image(query Query, viewQuery Query, binSizeX uint64, binSizeY uint64) (Image, error) {
	fmt.Printf("Processing Image query %v\n", query)
	start := time.Now()

	numBinsX := uint32(math.Ceil(float64(viewQuery.SourceEnd-viewQuery.SourceStart) / float64(binSizeX)))
	numBinsY := uint32(math.Ceil(float64(viewQuery.TargetEnd-viewQuery.TargetStart) / float64(binSizeY)))

	imageData := make([]uint32, numBinsX*numBinsY)

	// Convert to float to make sure that when
	//binSizeX := (float64(viewQuery.SourceEnd-viewQuery.SourceStart) / float64(numBins)) //+ 1
	//binSizeY := (float64(viewQuery.TargetEnd-viewQuery.TargetStart) / float64(numBins)) //+ 1

	sameChrom := query.SourceChrom == query.TargetChrom

	var xPos, yPos int32

	pointCounter := 0

	err := file.Query(query, func(entry *Entry) {
		pointCounter++
		if entry.SourceChrom != query.SourceChrom {
			xPos = int32(float64(entry.TargetPosition-viewQuery.SourceStart) / float64(binSizeX))
			yPos = int32(float64(entry.SourcePosition-viewQuery.TargetStart) / float64(binSizeY))
		} else {
			xPos = int32(float64(entry.SourcePosition-viewQuery.SourceStart) / float64(binSizeX))
			yPos = int32(float64(entry.TargetPosition-viewQuery.TargetStart) / float64(binSizeY))
		}
		//fmt.Printf("(%d)[%f, %f]%v -> (%d, %d)\n", numBins, binSizeX, binSizeY, entry, xPos, yPos)
		if xPos >= 0 && yPos >= 0 && uint32(xPos) < numBinsX && uint32(yPos) < numBinsY {
			imageIndex := int(yPos)*int(numBinsX) + int(xPos)
			imageData[imageIndex]++
		}

		// Check if reverse is within view, as we only store diagonal
		if sameChrom {
			xPos = int32(float64(entry.TargetPosition-viewQuery.SourceStart) / float64(binSizeX))
			yPos = int32(float64(entry.SourcePosition-viewQuery.TargetStart) / float64(binSizeY))

			if xPos >= 0 && yPos >= 0 && uint32(xPos) < numBinsX && uint32(yPos) < numBinsY {
				imageIndex := int(yPos)*int(numBinsX) + int(xPos)
				imageData[imageIndex]++
			}
		}
	})

	elapsed := time.Since(start)
	fmt.Printf("Image query finished having processed %d points, taking %s\n", pointCounter, elapsed)

	return Image{Width: numBinsX, Height: numBinsY, Data: imageData}, err
}

func EntriesToImage(entries []*Entry, query Query, numBins uint64) []uint32 {
	imageData := make([]uint32, numBins*numBins)

	binSizeX := ((query.SourceEnd - query.SourceStart) / numBins) + 1
	binSizeY := ((query.TargetEnd - query.TargetStart) / numBins) + 1

	sameChrom := query.SourceChrom == query.TargetChrom

	var xPos, yPos int64

	for _, entry := range entries {
		if entry.SourceChrom != query.SourceChrom {
			xPos = int64(float64(entry.TargetPosition-query.SourceStart) / float64(binSizeX))
			yPos = int64(float64(entry.SourcePosition-query.TargetStart) / float64(binSizeY))
		} else {
			xPos = int64(float64(entry.SourcePosition-query.SourceStart) / float64(binSizeX))
			yPos = int64(float64(entry.TargetPosition-query.TargetStart) / float64(binSizeY))
		}

		if xPos >= 0 && yPos >= 0 && xPos < int64(numBins) && yPos < int64(numBins) {
			imageIndex := int(yPos)*int(numBins) + int(xPos)
			imageData[imageIndex]++
		}

		// Check if reverse is within view, as we only store diagonal
		if sameChrom {
			xPos = int64(float64(entry.TargetPosition-query.SourceStart) / float64(binSizeX))
			yPos = int64(float64(entry.SourcePosition-query.TargetStart) / float64(binSizeY))

			if xPos >= 0 && yPos >= 0 && xPos < int64(numBins) && yPos < int64(numBins) {
				imageIndex := int(yPos)*int(numBins) + int(xPos)
				imageData[imageIndex]++
			}
		}
	}

	return imageData
}

type indexConf struct {
	Format  int32
	SeqCol  int32
	SeqBeg  int32
	EndCol  int32
	SeqCol2 int32
	BegCol2 int32
	EndCol2 int32

	Delimiter            byte
	RegionSplitCharacter byte
	Padding              [2]byte
	MetaChar             int32
	LineSkip             int32
}

type indexHeader struct {
	Magic        [8]byte
	NumSequences int32
	LineCount    uint64

	Conf indexConf

	TargetNames map[int]string
	BinIndex    map[string]map[uint32]binDetails
	LinearIndex map[string][]uint64

	//TName map[string]string
	//Index
}

func (index indexHeader) getChunksFromQuery(query Query) []fileChunk {
	// TODO: Check validity of search (e.g. start < end)

	var chunkstoLoad []fileChunk

	chromPairName := query.SourceChrom + string(index.Conf.RegionSplitCharacter) + query.TargetChrom

	if _, ok := index.BinIndex[chromPairName]; ok {
		var startBin, endBin uint64
		// PX2.002
		if index.Magic[6] == 50 {
			startBin = query.SourceStart >> TAD_LIDX_SHIFT_ORIGINAL
			endBin = query.SourceEnd >> TAD_LIDX_SHIFT_ORIGINAL
		} else {
			startBin = query.SourceStart >> TAD_LIDX_SHIFT
			endBin = query.SourceEnd >> TAD_LIDX_SHIFT
		}
		endBin += 1

		if endBin >= uint64(len(index.LinearIndex[chromPairName])) {
			endBin = uint64(len(index.LinearIndex[chromPairName]) - 1)
		}

		for ; index.LinearIndex[chromPairName][startBin] == 0; startBin++ {
		}

		startLocation := index.LinearIndex[chromPairName][startBin]
		endLocation := index.LinearIndex[chromPairName][endBin]

		startBlock := getBGZFOffset(startLocation)
		endBlock := getBGZFOffset(endLocation)

		chunkstoLoad = append(chunkstoLoad, fileChunk{Start: startBlock, End: endBlock})
	}

	if query.TargetChrom == query.SourceChrom {
		return chunkstoLoad
	}

	// Process the inverse chrom pair
	chromPairName = query.TargetChrom + string(index.Conf.RegionSplitCharacter) + query.SourceChrom

	if _, ok := index.BinIndex[chromPairName]; ok {
		startBin := query.TargetStart >> TAD_LIDX_SHIFT
		endBin := query.TargetEnd >> TAD_LIDX_SHIFT
		endBin += 1

		if endBin >= uint64(len(index.LinearIndex[chromPairName])) {
			endBin = uint64(len(index.LinearIndex[chromPairName]) - 1)
		}

		for ; index.LinearIndex[chromPairName][startBin] == 0; startBin++ {
		}

		startLocation := index.LinearIndex[chromPairName][startBin]
		endLocation := index.LinearIndex[chromPairName][endBin]

		startBlock := getBGZFOffset(startLocation)
		endBlock := getBGZFOffset(endLocation)

		newChunk := fileChunk{Start: startBlock, End: endBlock}

		if len(chunkstoLoad) == 0 {
			chunkstoLoad = append(chunkstoLoad, newChunk)
		} else {
			updated := false
			if newChunk.Start.File <= chunkstoLoad[0].Start.File && (newChunk.End.File >= chunkstoLoad[0].Start.File && newChunk.Start.File <= chunkstoLoad[0].End.File) {
				chunkstoLoad[0].Start = newChunk.Start
				updated = true
			}
			if newChunk.End.File >= chunkstoLoad[0].End.File && (newChunk.Start.File >= chunkstoLoad[0].End.File && newChunk.End.File <= chunkstoLoad[0].Start.File) {
				chunkstoLoad[0].End = newChunk.End
				updated = true
			}

			if !updated {
				chunkstoLoad = append(chunkstoLoad, newChunk)
			}
		}
	}

	fmt.Println(chunkstoLoad)

	// // Sort the chunks to load by File position
	// sort.Slice(chunkstoLoad, func(i, j int) bool {
	// 	return chunkstoLoad[i].StartChunk.Begin.File < chunkstoLoad[j].StartChunk.Begin.File
	// })

	return chunkstoLoad
}

type binDetails struct {
	BinNumber uint32
	NumChunks int32

	Chunks []chunkDetails
}

type chunkDetails struct {
	ChunkBegin uint64
	ChunkEnd   uint64
}

func ParseIndex(filename string) (*indexHeader, error) {
	indexFile, err := os.Open(filename)
	if err != nil {
		return nil, err
	}

	indexReader, err := bgzf.NewReader(indexFile, 0)
	if err != nil {
		return nil, err
	}

	//magicBytes := make([]byte, 4)
	//indexReader.Read(magicBytes)

	//bufReader := bufio.NewReader(indexReader)
	var header indexHeader
	header.TargetNames = make(map[int]string)
	header.BinIndex = make(map[string]map[uint32]binDetails)
	header.LinearIndex = make(map[string][]uint64)
	binary.Read(indexReader, binary.LittleEndian, &header.Magic)
	binary.Read(indexReader, binary.LittleEndian, &header.NumSequences)

	// PX2.002
	if header.Magic[6] == 50 {
		var lineCount32 int32
		binary.Read(indexReader, binary.LittleEndian, &lineCount32)

		//fmt.Println(lineCount32)
		header.LineCount = uint64(lineCount32)
	} else {
		binary.Read(indexReader, binary.LittleEndian, &header.LineCount)
	}

	binary.Read(indexReader, binary.LittleEndian, &header.Conf)

	//fmt.Println(string(magicBytes))
	//fmt.Println(header)
	//fmt.Println(string(header.Magic[:]))

	//fmt.Println(string(header.Conf.Delimiter))
	//fmt.Println(string(header.Conf.RegionSplitCharacter))
	//fmt.Println(string(header.Conf.MetaChar))

	var length int32
	binary.Read(indexReader, binary.LittleEndian, &length)

	//fmt.Println(length)
	buf := make([]byte, length)
	binary.Read(indexReader, binary.LittleEndian, &buf)

	//fmt.Println(string(buf))
	lastIndex := 0
	targetNameIndex := 0
	for i := 0; i < len(buf); i++ {
		if buf[i] == 0 {
			header.TargetNames[targetNameIndex] = string(buf[lastIndex:i])

			header.BinIndex[header.TargetNames[targetNameIndex]] = make(map[uint32]binDetails)

			lastIndex = i + 1
			targetNameIndex++
		}
	}

	//fmt.Println(header.TargetNames)

	//fmt.Println(header.NumSequences)

	for sequenceIndex := 0; sequenceIndex < int(header.NumSequences); sequenceIndex++ {
		sequenceName := header.TargetNames[sequenceIndex]

		var numBins int32
		var numIntervals int32
		binary.Read(indexReader, binary.LittleEndian, &numBins)

		for binIndex := int32(0); binIndex < numBins; binIndex++ {
			var details binDetails

			binary.Read(indexReader, binary.LittleEndian, &details.BinNumber)
			binary.Read(indexReader, binary.LittleEndian, &details.NumChunks)
			details.Chunks = make([]chunkDetails, details.NumChunks)

			for chunkIndex := int32(0); chunkIndex < details.NumChunks; chunkIndex++ {
				binary.Read(indexReader, binary.LittleEndian, &details.Chunks[chunkIndex])
			}

			header.BinIndex[sequenceName][details.BinNumber] = details
		}

		binary.Read(indexReader, binary.LittleEndian, &numIntervals)

		intervalOffsets := make([]uint64, numIntervals)
		binary.Read(indexReader, binary.LittleEndian, &intervalOffsets)

		header.LinearIndex[sequenceName] = intervalOffsets
	}

	log.Println("Finished reading .px2 header")

	// sequenceName := "1|1"

	// startBin := 1000000 >> TAD_LIDX_SHIFT
	// endBin := 1500000 >> TAD_LIDX_SHIFT

	// fmt.Println(header.BinIndex[sequenceName][uint32(startBin)])
	// fmt.Println(header.LinearIndex[sequenceName][startBin])

	// fmt.Println(bgzfReader.LastChunk())

	// startLocation := header.LinearIndex[sequenceName][startBin]
	// endLocation := header.LinearIndex[sequenceName][endBin]

	// startBlock := getBGZFOffset(startLocation)
	// endBlock := getBGZFOffset(endLocation)
	// fmt.Printf("Trying %v -> %v\n", startBlock, endBlock)
	// err = bgzfReader.Seek(startBlock)
	// fmt.Println(err)

	// bufReader := bufio.NewReader(bgzfReader)

	// lineData, err := bufReader.ReadBytes('\n')
	// curEntry, err := parseEntry(string(lineData))

	// for curEntry.SourcePosition < 1500000 {
	// 	//fmt.Println(string(lineData))

	// 	lineData, err = bufReader.ReadBytes('\n')
	// 	curEntry, err = parseEntry(string(lineData))
	// }

	return &header, err
}

func getBGZFOffset(location uint64) bgzf.Offset {
	blockOffset := uint16(location & 0xFFFF)
	blockAddress := int64(location >> 16)

	return bgzf.Offset{File: int64(blockAddress), Block: uint16(blockOffset)}
}

const TAD_LIDX_SHIFT = 15
const TAD_LIDX_SHIFT_ORIGINAL = 14

func ParseBGZF(filename string) (File, error) {

	var err error
	var pairsFile bgzfFile
	pairsFile.chromsizes = make(map[string]Chromsize)
	pairsFile.file, err = os.Open(filename)
	if err != nil {
		return nil, err
	}

	pairsFile.bgzfReader, err = bgzf.NewReader(pairsFile.file, 0)
	if err != nil {
		return nil, err
	}

	bufReader := bufio.NewReader(pairsFile.bgzfReader)

	_, err = pairsFile.parseHeader(bufReader)
	if err != nil {
		return nil, err
	}

	log.Println("Finished parsing header, reading index...")

	start := time.Now()
	pairsFile.index, err = ParseIndex(strings.Replace(filename, ".gz", ".gz.px2", 1))
	if err != nil {
		return nil, err
	}
	elapsed := time.Since(start)
	log.Printf("Parsing index took %s", elapsed)

	// for i := 0; i < 10; i++ {
	// 	go func(i int) {
	// 		pairsFile.Query(Query{SourceChrom: "1", TargetChrom: "1", SourceStart: uint64(i) * 1e5, SourceEnd: uint64(i) * 1.1e5, TargetStart: uint64(i) * 1e5, TargetEnd: uint64(i) * 1.1e5}, func(entry *Entry) {})
	// 	}(i)
	// }

	//return &pairsFile, nil

	// fmt.Println("Finished parsing header, creating index...")

	// maxLinesPerIndex := 100000
	// //numBins := uint64(500)

	// //imageData := make([]uint32, numBins*numBins)

	// pairsFile.index = new(BGZFIndex)
	// pairsFile.index.mu.Lock()
	// pairsFile.index.reader = pairsFile.bgzfReader

	// pairsFile.index.ChromPairStart = make(map[string]bgzf.Chunk)
	// pairsFile.index.ChromPairEnd = make(map[string]bgzf.Chunk)
	// pairsFile.index.ChromPairChunks = make(map[string][]*ChromPairChunk)
	// pairsFile.index.ChromPairCounts = make(map[string]uint64)

	// /*lineData, err := bufReader.ReadBytes('\n')
	// if err != nil {
	// 	fmt.Println("Failed to read from buffer")
	// 	return nil, err
	// }
	// firstNonComment := string(lineData)

	// firstEntry, err := parseEntry(firstNonComment)
	// if err != nil {
	// 	return nil, err
	// }*/

	// pairsFile.index.DataStart = pairsFile.bgzfReader.LastChunk()
	// pairsFile.index.ChromPairStart[firstEntry.ChromPairName()] = pairsFile.bgzfReader.LastChunk()

	// lastEntry := firstEntry.ChromPairName()

	// curChromPairChunk := &ChromPairChunk{}
	// pairsFile.index.ChromPairChunks[firstEntry.ChromPairName()] = append(pairsFile.index.ChromPairChunks[firstEntry.ChromPairName()], curChromPairChunk)
	// curChromPairChunk.StartChunk = pairsFile.bgzfReader.LastChunk()
	// //curChromPairChunk.StartEntry = firstEntry
	// curChromPairChunk.MinX = firstEntry.SourcePosition
	// curChromPairChunk.MaxX = firstEntry.SourcePosition
	// curChromPairChunk.EndChunk = pairsFile.bgzfReader.LastChunk()
	// //curChromPairChunk.EndEntry = firstEntry
	// curChromPairChunk.MinY = firstEntry.TargetPosition
	// curChromPairChunk.MaxY = firstEntry.TargetPosition

	// //binSizeX := (pairsFile.chromsizes[firstEntry.SourceChrom].Length / numBins) + 1
	// //binSizeY := (pairsFile.chromsizes[firstEntry.TargetChrom].Length / numBins) + 1
	// //imageIndex := int(firstEntry.TargetPosition/binSizeY)*int(numBins) + int(firstEntry.SourcePosition/binSizeX)
	// //imageData[imageIndex]++
	// //imageIndex = int(firstEntry.SourcePosition/binSizeX)*int(numBins) + int(firstEntry.TargetPosition/binSizeY)
	// //imageData[imageIndex]++

	// // Already looked at the first line (above) so start at 1
	// lineCount := 1
	// totalLineCount := uint64(1)

	// for {
	// 	lineData, err := bufReader.ReadBytes('\n')
	// 	if err != nil {
	// 		if err == io.EOF {
	// 			//fmt.Println("Finished reading data")
	// 			break
	// 		}
	// 		return nil, err
	// 	}

	// 	lineToProcess := string(lineData[:len(lineData)-1])
	// 	curEntry, err := parseEntry(lineToProcess)
	// 	if err != nil {
	// 		return nil, err
	// 	}

	// 	/*if curEntry.SourceChrom == "chr3R" && curEntry.SourcePosition > 19843050 && curEntry.TargetPosition <= 20585520 {
	// 		fmt.Println(curEntry)
	// 		fmt.Println(curChromPairChunk)
	// 		fmt.Println(pairsFile.index.ChromPairChunks[curEntry.ChromPairName()])
	// 	}*/

	// 	// Check if the new line is describing a different source and target chromosome
	// 	if lastEntry != curEntry.ChromPairName() {
	// 		lineCount = 0
	// 		totalLineCount = 0

	// 		pairsFile.index.ChromPairEnd[lastEntry] = pairsFile.bgzfReader.LastChunk()
	// 		pairsFile.index.ChromPairCounts[lastEntry] = totalLineCount
	// 		pairsFile.index.ChromPairStart[curEntry.ChromPairName()] = pairsFile.bgzfReader.LastChunk()

	// 		//outputImage(imageData, int(numBins), lastEntry)
	// 		//imageData = make([]uint32, numBins*numBins)
	// 		//binSizeX = (pairsFile.chromsizes[curEntry.SourceChrom].Length / numBins) + 1
	// 		//binSizeY = (pairsFile.chromsizes[curEntry.TargetChrom].Length / numBins) + 1
	// 	}

	// 	// Starting a new chunk when lineCount reset to 0 (either because new source/target or too many lines)
	// 	if lineCount == 0 {
	// 		curChromPairChunk = &ChromPairChunk{}
	// 		pairsFile.index.ChromPairChunks[curEntry.ChromPairName()] = append(pairsFile.index.ChromPairChunks[curEntry.ChromPairName()], curChromPairChunk)

	// 		curChromPairChunk.StartChunk = pairsFile.bgzfReader.LastChunk()
	// 		//curChromPairChunk.StartEntry = curEntry
	// 		curChromPairChunk.MinX = curEntry.SourcePosition
	// 		curChromPairChunk.MaxX = curEntry.SourcePosition
	// 		curChromPairChunk.EndChunk = pairsFile.bgzfReader.LastChunk()
	// 		//curChromPairChunk.EndEntry = curEntry
	// 		curChromPairChunk.MinY = curEntry.TargetPosition
	// 		curChromPairChunk.MaxY = curEntry.TargetPosition
	// 	}

	// 	// Update the line count
	// 	lineCount++
	// 	totalLineCount++

	// 	// Update the latest 'end' chunk found and the current line count
	// 	curChromPairChunk.NumberLines = lineCount
	// 	curChromPairChunk.EndChunk = pairsFile.bgzfReader.LastChunk()

	// 	if curChromPairChunk.MinX > curEntry.SourcePosition {
	// 		curChromPairChunk.MinX = curEntry.SourcePosition
	// 	}
	// 	if curChromPairChunk.MaxX < curEntry.SourcePosition {
	// 		curChromPairChunk.MaxX = curEntry.SourcePosition
	// 	}
	// 	if curChromPairChunk.MinY > curEntry.TargetPosition {
	// 		curChromPairChunk.MinY = curEntry.TargetPosition
	// 	}
	// 	if curChromPairChunk.MaxY < curEntry.TargetPosition {
	// 		curChromPairChunk.MaxY = curEntry.TargetPosition
	// 	}
	// 	//curChromPairChunk.EndEntry = curEntry

	// 	//imageIndex = int(curEntry.TargetPosition/binSizeY)*int(numBins) + int(curEntry.SourcePosition/binSizeX)
	// 	//imageData[imageIndex]++
	// 	//imageIndex = int(curEntry.SourcePosition/binSizeX)*int(numBins) + int(curEntry.TargetPosition/binSizeY)
	// 	//imageData[imageIndex]++

	// 	// If we have too many lines, then start a new indexed chunk on the next line
	// 	if lineCount >= maxLinesPerIndex {
	// 		lineCount = 0
	// 	}

	// 	lastEntry = curEntry.ChromPairName()
	// }

	// pairsFile.index.ChromPairEnd[lastEntry] = pairsFile.bgzfReader.LastChunk()
	// pairsFile.index.ChromPairCounts[lastEntry] = totalLineCount

	// pairsFile.index.mu.Unlock()
	// fmt.Println("Finished creating index")

	//a, err := pairsFile.Index.Search(bReader, PairsQuery{SourceChrom: "chr2L", SourceStart: 12000000, SourceEnd: 15000000, TargetChrom: "chr2L", TargetStart: 10000000, TargetEnd: 15000000})

	//fmt.Println(len(a))
	return &pairsFile, nil
}

func ParsePlain(reader io.Reader) error {
	var err error
	scanner := bufio.NewScanner(reader)

	// Advance to the first line
	if !scanner.Scan() {
		return errors.New("invalid .pairs file: No data?")
	}
	firstLine := scanner.Text()
	if !strings.Contains(firstLine, "## pairs format v1.0") {
		return errors.New("Invalid .pairs file: Missing header line. First line is: " + firstLine)
	}

	var pairsFile baseFile
	pairsFile.chromsizes = make(map[string]Chromsize)

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

				pairsFile.chromsizes[chromsize.Name] = chromsize
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

type Entry struct {
	SourceChrom    string
	SourcePosition uint64
	TargetChrom    string
	TargetPosition uint64
}

func (entry Entry) ChromPairName() string {
	return entry.SourceChrom + "-" + entry.TargetChrom
}

func (entry Entry) IsInRange(query Query) bool {
	if entry.SourceChrom != query.SourceChrom || entry.TargetChrom != query.TargetChrom {
		return false
	}

	distance := uint64(0)
	if entry.SourcePosition > entry.TargetPosition {
		distance = entry.SourcePosition - entry.TargetPosition
	} else {
		distance = entry.TargetPosition - entry.SourcePosition
	}

	if entry.SourcePosition >= query.SourceStart && entry.SourcePosition <= query.SourceEnd &&
		entry.TargetPosition >= query.TargetStart && entry.TargetPosition <= query.TargetEnd &&
		(entry.SourceChrom == entry.TargetChrom && distance >= query.FilterDistance) {

		return true

	}

	return false
}

func parseEntry(line string) (*Entry, error) {
	var entry Entry
	var err error

	splitLine := strings.Split(line, "\t")

	if len(splitLine) < 4 {
		// We have a problem, the line isn't formatted correctly
		fmt.Println(line)
		return nil, errors.New("Invalid line: " + line)
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
