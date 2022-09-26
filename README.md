# v3c-vis

![Screenshot](/docs/hicvis-screenshot.png?raw=true "Screenshot")

## Features
* Visualisation interactively customisable using GUI
* Full matrix view and triangle view 
* Optionally load interact file for visualising contacts
* pairix format used (and accompanying index). See: https://github.com/4dn-dcic/pairix
* User can select which chromosomes to view

## Current limitations
* Must use .gz compressed pairs file

## Getting started
* Download the latest archive from the releases page
* Extract and then run the following command (where `-g` specifies the genome):
```
./hicvis -d path/to/data.gz -i path/to/contacts.interact -g dm6
```
## Optional Commands 
### Maximum points for Voronoi
Optional additional command line controls the maximum number of points used to calculate voronoi (when more points are requested, no voronoi is calculated):
```
./hicvis -d path/to/data.gz -i path/to/contacts.interact -g dm6 --maxpoints 100000
```
### Port
Optional additional command line controls which port is used for the server (change if conflict with other software):
```
./hicvis -d path/to/data.gz -i path/to/contacts.interact -g dm6 -p 5002
```

### Server mode
hicvis can be started in server mode and will not automatically open the browser:
```
./hicvis -d path/to/data.gz -i path/to/contacts.interact -g dm6 --server
```
