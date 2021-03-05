
export interface  Locus {
    chr: string
    start: string
    //end?: string
    initialEnd: string 
}

export class Chromosome {
    name: string
    length: number

    constructor(name: string, length: number) {
        this.name = name;
        this.length = length;
    }

    static fromJSON(json: any): Chromosome {
        return new Chromosome(json['Name'], json['Length'])
    }


    nameWithChr(): string {
        if(!this.name.includes("chr")) {
            return "chr" + this.name
        }

        return this.name;
    }
}


export function getChromosomeFromMap(chromMap: Map<string, Chromosome>, name: string): Chromosome {
    let chromosome = chromMap.get(name);

    if(chromosome) {
        return chromosome
    }

    return <Chromosome>chromMap.get(name.replace("chr", ""))
}

export class Interaction {
    sourceChrom: Chromosome
    sourceStart: number
    sourceEnd: number

    targetChrom: Chromosome
    targetStart: number
    targetEnd: number

    constructor(sourceChrom: Chromosome, sourceStart: number, sourceEnd: number, targetChrom: Chromosome, targetStart: number, targetEnd: number) {
        this.sourceChrom = sourceChrom;
        this.sourceStart = sourceStart;
        this.sourceEnd = sourceEnd;

        this.targetChrom = targetChrom;
        this.targetStart = targetStart;
        this.targetEnd = targetEnd;
    }

    static fromJSON(json: any, chromMap: Map<string, Chromosome>): Interaction {
        return new Interaction(getChromosomeFromMap(chromMap, json['SourceChrom']), json['SourceStart'], json['SourceEnd'], 
        getChromosomeFromMap(chromMap, json['TargetChrom']), json['TargetStart'], json['TargetEnd']);
    }
}