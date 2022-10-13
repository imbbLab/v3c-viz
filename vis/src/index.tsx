import * as React from "react";
import * as ReactDOM from "react-dom";
import { App } from "./App";
import { Chromosome, getChromosomeFromMap } from "./chromosome";
import { GenomeDetails, getGenomeDetails } from "./genome";

const VERSION = "0.9.0";

function parseUrlParam(value: string | null): number | undefined {
    if (value) {
        return parseInt(value);
    }

    return undefined;
}

console.log("v3c-vis version ", VERSION);

fetch('/details').then(response => {
    if (response.status !== 200) {
        console.log('Looks like there was a problem. Status Code: ' +
            response.status);
        return;
    }

    const queryString = window.location.search;
    const urlParams = new URLSearchParams(queryString);

    var chromosomes: Map<string, Chromosome> = new Map();
    var sourceChrom: Chromosome;
    var targetChrom: Chromosome;


    response.json().then(details => {
        var chromosomeDetails = details['Chromosomes'];
        chromosomeDetails.forEach((chromosome: any) => {
            chromosomes.set(chromosome['Name'], Chromosome.fromJSON(chromosome))
        });

        var locusBottom: string
        var locusRight: string


        const srcChrom = urlParams.get('srcChrom');
        const tarChrom = urlParams.get('tarChrom');
        const srcStart = parseUrlParam(urlParams.get('srcStart'));
        const srcEnd = parseUrlParam(urlParams.get('srcEnd'));
        const tarStart = parseUrlParam(urlParams.get('tarStart'));
        const tarEnd = parseUrlParam(urlParams.get('tarEnd'));

        const intrachromosomeView = urlParams.get('triangleView') == 'true';


        if (srcChrom && srcStart && srcEnd && tarChrom && tarStart && tarEnd) {
            sourceChrom = getChromosomeFromMap(chromosomes, srcChrom)
            targetChrom = getChromosomeFromMap(chromosomes, tarChrom)

            locusBottom = sourceChrom.name + ":" + srcStart + "-" + srcEnd;
            locusRight = targetChrom.name + ":" + tarStart + "-" + tarEnd;
        } else {
            sourceChrom = getChromosomeFromMap(chromosomes, details['Chromosomes'][0]['Name'])
            targetChrom = sourceChrom

            locusBottom = sourceChrom.name + ":0-" + sourceChrom.length; //'chr4:0-1348131'
            locusRight = locusBottom
        }
        console.log(locusBottom)

        let genomeDetails = getGenomeDetails(details['Genome']) as GenomeDetails;
        console.log(genomeDetails)



        ReactDOM.render(
            <React.StrictMode>
                <App chromosomes={chromosomes} genome={genomeDetails} sourceChrom={sourceChrom} targetChrom={targetChrom} srcStart={srcStart} srcEnd={srcEnd} tarStart={tarStart} tarEnd={tarEnd}
                    intrachromosomeView={intrachromosomeView} hasInteract={details['hasInteract'] as boolean}></App>
            </React.StrictMode>,
            document.getElementById("output")
        );

        //this.setState({ genome: genomeDetails, sourceChrom: sourceChrom, targetChrom: targetChrom, chromosomes: chromosomes });
    });
})
