package pairs

import (
	"bufio"
	"fmt"
	"sort"
	"sync"

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

type Index interface {
	ChromPairList() []string
	Search(pairsQuery Query) ([]*Entry, error)

	//Image(pairsQuery Query, numBins int) ([]uint32, error)
}

type BGZFIndex struct {
	reader *bgzf.Reader

	DataStart bgzf.Chunk

	ChromPairStart map[string]bgzf.Chunk
	ChromPairEnd   map[string]bgzf.Chunk

	ChromPairCounts map[string]uint64
	ChromPairChunks map[string][]*ChromPairChunk

	mu sync.Mutex
}

func (index BGZFIndex) ChromPairList() []string {
	keys := make([]string, 0, len(index.ChromPairChunks))
	for k := range index.ChromPairChunks {
		keys = append(keys, k)
	}

	return keys
}

func (index BGZFIndex) getChunksFromQuery(query Query) []*ChromPairChunk {
	// TODO: Check validity of search (e.g. start < end)

	var chunkstoLoad []*ChromPairChunk

	chromPairName := query.SourceChrom + "-" + query.TargetChrom
	if chromPairs, ok := index.ChromPairChunks[chromPairName]; ok {
		lastLoadedChunk := 0

		for index, pair := range chromPairs {
			//if (query.SourceStart < pair.EndEntry.SourcePosition) && (pair.StartEntry.SourcePosition < query.SourceEnd) &&
			//	(query.TargetStart < pair.EndEntry.TargetPosition) && (pair.StartEntry.TargetPosition < query.TargetEnd) {
			if (query.SourceStart <= pair.MaxX) && (pair.MinX <= query.SourceEnd) &&
				(query.TargetStart <= pair.MaxY) && (pair.MinY <= query.TargetEnd) {

				chunkstoLoad = append(chunkstoLoad, chromPairs[index])
				lastLoadedChunk = index
			} else if lastLoadedChunk == index-1 {
				chunkstoLoad = append(chunkstoLoad, chromPairs[index])
			}
		}
	}

	// Process the inverse chrom pair
	chromPairName = query.TargetChrom + "-" + query.SourceChrom
	if chromPairs, ok := index.ChromPairChunks[chromPairName]; ok {
		lastLoadedChunk := 0

		for index, pair := range chromPairs {
			if (query.TargetStart <= pair.MaxX) && (pair.MaxX <= query.TargetEnd) &&
				(query.SourceStart <= pair.MaxY) && (pair.MinY <= query.SourceEnd) {
				chunkstoLoad = append(chunkstoLoad, chromPairs[index])
				lastLoadedChunk = index
			} else if lastLoadedChunk == index-1 {
				chunkstoLoad = append(chunkstoLoad, chromPairs[index])
			}
			/*if query.TargetStart >= pair.StartEntry.SourcePosition && query.TargetStart <= pair.EndEntry.SourcePosition {
				withinBounds = true
			}
			if withinBounds {
				chunkstoLoad = append(chunkstoLoad, chromPairs[index])
			}

			if query.TargetEnd >= pair.StartEntry.SourcePosition && query.TargetEnd <= pair.EndEntry.SourcePosition {
				withinBounds = false
			}*/
		}
	}

	// Sort the chunks to load by File position
	sort.Slice(chunkstoLoad, func(i, j int) bool {
		return chunkstoLoad[i].StartChunk.Begin.File < chunkstoLoad[j].StartChunk.Begin.File
	})

	return chunkstoLoad
}

func (index *BGZFIndex) Query(query Query, entryFunction func(entry *Entry)) error {
	var err error

	// Create the reverse query to make searching easier
	revQuery := query.Reverse()
	chunks := index.getChunksFromQuery(query)

	// Merge together chunks (skipping) they follow on from one another to
	// avoid seeking, then read in necessary number of lines to find desired data points
	seekRequired := true
	var bufReader *bufio.Reader
	var lineData []byte
	var entry *Entry

	//fmt.Printf("About to process chunks %v\n", chunks)

	index.mu.Lock()

	for chunkIndex, chunk := range chunks {
		//defer func() {
		//	if x := recover(); x != nil {
		//		// recovering from a panic; x contains whatever was passed to panic()
		//		log.Printf("run time panic: %v", x)
		//		log.Printf("%v Start [%v]\n", chunk, index.reader)

		//		// if you just want to log the panic, panic again
		//		panic(x)
		//	}
		//}()

		//fmt.Printf("About to process chunk %v\n", chunk)
		if chunkIndex > 0 {
			// Same chunk as before, so skip it
			if chunk == chunks[chunkIndex-1] {
				continue
			}

			// Chunks follow on, so don't need to seek
			if chunk.StartChunk.Begin.File == chunks[chunkIndex-1].EndChunk.End.File {
				seekRequired = false
			} else {
				seekRequired = true
			}
		}

		if seekRequired {
			err = index.reader.Seek(chunk.StartChunk.Begin)
			if err != nil {
				return err
			}

			bufReader = bufio.NewReader(index.reader)

			// Skip the first partial line, this should be captured by the previous chunk
			_, err = bufReader.ReadBytes('\n')
			if err != nil {
				return err
			}
		}

		for i := 0; i < chunk.NumberLines; i++ {
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
		}
	}

	index.mu.Unlock()

	return err
}

func (index *BGZFIndex) Search(query Query) ([]*Entry, error) {
	var err error

	var pairs []*Entry

	err = index.Query(query, func(entry *Entry) {
		pairs = append(pairs, entry)
	})

	return pairs, err
}
