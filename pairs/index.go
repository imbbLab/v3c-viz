package pairs

import (
	"bufio"
	"log"
	"sort"

	"github.com/biogo/hts/bgzf"
)

type Query struct {
	SourceChrom string
	SourceStart uint64
	SourceEnd   uint64

	TargetChrom string
	TargetStart uint64
	TargetEnd   uint64
}

func (query Query) Reverse() Query {
	var revQuery Query
	revQuery.SourceChrom = query.TargetChrom
	revQuery.SourceStart = query.TargetStart
	revQuery.SourceEnd = query.TargetEnd

	revQuery.TargetChrom = query.SourceChrom
	revQuery.TargetStart = query.SourceStart
	revQuery.TargetEnd = query.SourceEnd

	return revQuery
}

type Index struct {
	DataStart bgzf.Chunk

	ChromPairStart map[string]bgzf.Chunk
	ChromPairEnd   map[string]bgzf.Chunk

	ChromPairChunks map[string][]*ChromPairChunk
}

func (index Index) Search(reader *bgzf.Reader, pairsQuery Query) ([]*Entry, error) {
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

	var pairs []*Entry

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
