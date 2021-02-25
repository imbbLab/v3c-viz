# hicvis

## Features
* Visualisation interactively customisable using GUI
* Optionally load interact file for visualising contacts
* Index generated automatically at start of run to enable random access of data
* User can select which chromosomes to view

## Current limitations
* Must use .gz compressed pairs file
* Can only load .bed files into IGV viewers
* Resizing window causes IGV browser to change view (locus), which in turn causes voronoi to be recalculated. This is unncessary
* Contacts (.interact file) are only shown on image view

## Getting started
* Download the latest archive from the releases page
* Extract and then run the following command:
```
./hicvis -d path/to/data.gz -i path/to/contacts.interact
```
