package pairs

import (
	"bufio"
	"errors"
	"fmt"
	"image"
	"image/color"
	"image/png"
	"io"
	"log"
	"os"
	"strconv"
	"strings"

	"github.com/biogo/hts/bgzf"
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

	StartEntry *Entry
	EndEntry   *Entry
}

type File struct {
	Sorted         Order
	Shape          Shape
	GenomeAssembly string
	Chromsizes     map[string]Chromsize
	Samheader      []string

	Index Index
}

/*func NewFile() *File {
	var pairsFile File
	pairsFile.Chromsizes = make(map[string]Chromsize)

	return &pairsFile
}*/

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

func Parse(filename string) (*File, error) {
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

	return ParseBGZF(file)
}

func ParseBGZF(reader io.Reader) (*File, error) {
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

	var pairsFile File
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

func ParsePlain(reader io.Reader) error {
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

	var pairsFile File
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
	if entry.SourcePosition >= query.SourceStart && entry.SourcePosition <= query.SourceEnd &&
		entry.TargetPosition >= query.TargetStart && entry.TargetPosition <= query.TargetEnd {
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
