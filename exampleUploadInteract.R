library(httr)

interaction1 <- list(SourceChrom = "chr4", SourceStart = 717970, SourceEnd = 717975,
                     TargetChrom = "chr4", TargetStart = 757550, TargetEnd = 757555)
interaction2 <- list(SourceChrom = "chr4", SourceStart = 730815, SourceEnd = 730820,
                     TargetChrom = "chr4", TargetStart = 763140, TargetEnd = 763145)

interactionsJson <- list(
  Interactions = list(interaction1, interaction2)
)
res <- httr::POST("http://localhost:5002/interact"
            , body = interactionsJson
            , encode = "json")

browseURL("http://localhost:5002/?srcChrom=chr4&srcStart=697565&srcEnd=779194&tarChrom=chr4&tarStart=692617&tarEnd=779194")
#appData <- content(res)
