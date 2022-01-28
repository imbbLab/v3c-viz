import * as genomesJson from './genomes.json';

var genomes: Map<string, GenomeDetails> = new Map();

export interface GenomeDetails {
    id: string
    name: string
    fastaURL: string
    indexURL: string
    cytobandURL: string | undefined

    tracks: TrackDetails[]
}

export interface TrackDetails {
    format: string
    name: string
    url: string
    indexURL: string
    order: number
    removable: boolean
    visibilityWindow: number
}

for (let i = 0; i < genomesJson.length; i++) {
    var genome: GenomeDetails = {
        id: genomesJson[i]['id'],
        name: genomesJson[i]['name'],
        fastaURL: genomesJson[i]['fastaURL'],
        indexURL: genomesJson[i]['indexURL'],
        cytobandURL: genomesJson[i]['cytobandURL'],

        tracks: [],
    }

    for (let j = 0; j < genomesJson[i]['tracks'].length; j++) {
        let trackJson = genomesJson[i]['tracks'][j];

        var track: TrackDetails = {
            format: trackJson['format'],
            name: trackJson['name'],
            url: trackJson['url'],
            indexURL: trackJson['indexURL'],
            order: trackJson['order'],
            removable: trackJson['removable'],
            visibilityWindow: trackJson['visibilityWindow'],
        }

        genome.tracks.push(track)
    }

    genomes.set(genome.id, genome)
}


export function getGenomeDetails(genome: string): GenomeDetails | undefined {
    return genomes.get(genome)
    // switch(genome) {
    //     case "dm6":
    //         return {fastaURL: "https://s3.amazonaws.com/igv.broadinstitute.org/genomes/seq/dm6/dm6.fa", indexURL: "https://s3.amazonaws.com/igv.broadinstitute.org/genomes/seq/dm6/dm6.fa.fai"}
    //     case "hg19":
    //         return {fastaURL: "https://s3.amazonaws.com/igv.broadinstitute.org/genomes/seq/hg19/hg19.fasta", indexURL: "https://s3.amazonaws.com/igv.broadinstitute.org/genomes/seq/hg19/hg19.fasta.fai"}
    //     case "hg38":
    //         return {fastaURL: "https://s3.amazonaws.com/igv.broadinstitute.org/genomes/seq/hg38/hg38.fa", indexURL: "https://s3.amazonaws.com/igv.broadinstitute.org/genomes/seq/hg38/hg38.fa.fai"}
    // }
    // // TODO: Unknown genome - should ask the user for the fasta files?

    // // Try a default
    // return {fastaURL: "https://s3.amazonaws.com/igv.broadinstitute.org/genomes/seq/" + genome + "/" + genome + ".fa", indexURL: "https://s3.amazonaws.com/igv.broadinstitute.org/genomes/seq/" + genome + "/" + genome + ".fa.fai"}
}