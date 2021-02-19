package interact

import (
	"bufio"
	"encoding/csv"
	"io"
	"os"
	"strconv"
)

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

func Parse(filename string) (*InteractFile, error) {
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
