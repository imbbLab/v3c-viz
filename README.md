# hicvis

## Features
* Visualisation interactively customisable using GUI
* Optionally load interact file for visualising contacts

## Current limitations
* Load one chromosome at a time (.pairs file should only contain data from a single chromosome)
* Loads .pairs file into memory for fast access, so may fail for large .pairs files

## Getting started
* Download the latest archive from the releases page
* Extract and then run the following command:
```
./hicvis -d path/to/data.pairs -i path/to/contacts.interact
```
