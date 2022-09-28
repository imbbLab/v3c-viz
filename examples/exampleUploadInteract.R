library(httr)

interaction1 <- list(SourceChrom = "chr3R", SourceStart = 717970, SourceEnd = 728975,
                     TargetChrom = "chr3R", TargetStart = 756550, TargetEnd = 757555)
interaction2 <- list(SourceChrom = "chr3R", SourceStart = 730815, SourceEnd = 731820,
                     TargetChrom = "chr3R", TargetStart = 762140, TargetEnd = 763145)

interactionsJson <- list(
  Interactions = list(interaction1, interaction2)
)
res <- httr::POST("http://localhost:5002/interact"
            , body = interactionsJson
            , encode = "json")


interaction1 <- list(SourceChrom = "chr3R", SourceStart = 727970, SourceEnd = 738975,
                     TargetChrom = "chr3R", TargetStart = 756550, TargetEnd = 757555)
interaction2 <- list(SourceChrom = "chr3R", SourceStart = 740815, SourceEnd = 741820,
                     TargetChrom = "chr3R", TargetStart = 762140, TargetEnd = 763145)

interactionsJson <- list(
  Name = 'test',
  Interactions = list(interaction1, interaction2)
)
res <- httr::POST("http://localhost:5002/interact"
                  , body = interactionsJson
                  , encode = "json")

browseURL("http://localhost:5002/?srcChrom=chr3R&srcStart=697565&srcEnd=779194&tarChrom=chr3R&tarStart=692617&tarEnd=779194")
#appData <- content(res)


##########################
# Get access to Voronoi
##########################

binaryData = httr::GET("http://localhost:5002/voronoiandimage?smoothingIterations=1&binSizeX=5000&binSizeY=5000&sourceChrom=chr3R&targetChrom=chr3R&xStart=15887016&xEnd=16390631&yStart=15947403&yEnd=16411610")
binaryBlob = binaryData$content

readUint32 <- function(blob, index) {
  return(packBits(rawToBits(rev(blob[index:(index+3)])), type="int"))
}

readf64 <- function(blob, index) {
  return(packBits(rawToBits(rev(blob[index:(index+7)])), type="double"))
}

readPoint <- function(blob, index) {
  return(c(readf64(blob, index), readf64(blob, index + 8)))
}

readDataEntry <- function(blob, index) {
  numPoints = readUint32(binaryBlob, index)
  index = index + 4
  polygonArea = readf64(binaryBlob, index)
  index = index + 8
  
  isPolygonClipped = binaryBlob[index]
  index = index + 1
  
  
  dataPoint = readPoint(binaryBlob, index)
  index = index + 16
  polygonCentroid = readPoint(binaryBlob, index)
  index = index + 16
  
  points = c()
  
  for(i in 1:numPoints) {
    points = append(points, readPoint(binaryBlob, index))
    index = index + 16
  }
  
  dataEntry = list()
  dataEntry$area = polygonArea
  dataEntry$centroid = polygonCentroid
  dataEntry$dataPoint = dataPoint
  dataEntry$polygonPoints = points
  dataEntry$isClipped = isPolygonClipped
  
  return(list(entry = dataEntry, index = index))
}

# Process binary blob
index = 1
numBinsX = readUint32(binaryBlob, index)
index = index + 4
numBinsY = readUint32(binaryBlob, index)
index = index + 4

numIntensities = numBinsX * numBinsY

intensities = c()

for(i in 1:numIntensities) {
  intensities = append(intensities, readUint32(binaryBlob, index))
  index = index + 4
}

numEntries = readUint32(binaryBlob, index)
index = index + 4

dataPoints = list()

for(i in 1:numEntries) {
  entry = readDataEntry(binaryBlob, index)
  index = entry$index
  entry = entry$entry
  
  dataPoints = append(dataPoints, list(entry))
}
  
