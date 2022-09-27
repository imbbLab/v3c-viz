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
./v3c-vis -d path/to/data.gz -i path/to/contacts.interact -g dm6
```
## Optional Commands 
### Maximum points for Voronoi
Optional additional command line controls the maximum number of points used to calculate voronoi (when more points are requested, no voronoi is calculated):
```
./v3c-vis -d path/to/data.gz -i path/to/contacts.interact -g dm6 --maxpoints 100000
```
### Port
Optional additional command line controls which port is used for the server (change if conflict with other software):
```
./v3c-vis -d path/to/data.gz -i path/to/contacts.interact -g dm6 -p 5002
```

### Server mode
v3c-vis can be started in server mode and will not automatically open the browser:
```
./v3c-vis -d path/to/data.gz -i path/to/contacts.interact -g dm6 --server
```


### API

It is possible to interact with v3c-vis programmatically via GET/POST requests. In the following, it is assumed that v3c-vis is running locally on port 5002. If you are running v3c-vis on a separate machine or a different port, then all URLs should be updated accordingly.

#### Compute Voronoi

This command reads data between the supplied start and end loci, generates a

*Example* 
```
http://localhost:5002/voronoiandimage?smoothingIterations=1&binSizeX=5000&binSizeY=5000&sourceChrom=chr3R&targetChrom=chr3R&xStart=15887016&xEnd=16390631&yStart=15947403&yEnd=16411610
```

*Options*

| Name | Description |
|------|-------------|
| binSizeX | The size of  |
| binSizeY |  |
| sourceChromX | |
| sourceChromY | |
| targetChromX | |
| targetChromY | |
| xStart | |
| xEnd | |
| yStart | |
| yEnd | |
| smoothingIterations | The number of iterations of Lloyd's algorithm to apply to approximate centroided Voronoi |


#### Set interactions to visualise