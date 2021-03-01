# hicvis

## Features
* Visualisation interactively customisable using GUI
* Optionally load interact file for visualising contacts
* Index generated automatically at start of run to enable random access of data
* User can select which chromosomes to view

## Current limitations
* Must use .gz compressed pairs file

## Getting started
* Download the latest archive from the releases page
* Extract and then run the following command (where `-g` specifies the genome):
```
./hicvis -d path/to/data.gz -i path/to/contacts.interact -g dm6
```
