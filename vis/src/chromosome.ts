

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
}