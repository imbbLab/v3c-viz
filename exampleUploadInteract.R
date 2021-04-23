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
