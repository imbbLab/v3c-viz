# v3c-viz

![Screenshot](/docs/screenshot-cut.png?raw=true "Screenshot")

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
./v3c-viz -d path/to/data.gz -i path/to/contacts.interact -g dm6
```
## Optional Commands 
### Maximum points for Voronoi
Optional additional command line controls the maximum number of points used to calculate voronoi (when more points are requested, no voronoi is calculated):
```
./v3c-viz -d path/to/data.gz -i path/to/contacts.interact -g dm6 --maxpoints 100000
```
### Port
Optional additional command line controls which port is used for the server (change if conflict with other software):
```
./v3c-viz -d path/to/data.gz -i path/to/contacts.interact -g dm6 -p 5002
```

### Server mode
v3c-viz can be started in server mode and will not automatically open the browser:
```
./v3c-viz -d path/to/data.gz -i path/to/contacts.interact -g dm6 --server
```


### API

It is possible to interact with v3c-viz programmatically via GET/POST requests. In the following, it is assumed that v3c-viz is running locally on port 5002. If you are running v3c-viz on a separate machine or a different port, then all URLs should be updated accordingly.

#### Genome details

This command retrieves the genome information corresponding to the genome of the loaded pairs file.

```
http://localhost:5002/details
```

The output is in JSON and has the following format.

```json
{
   "Genome":"dm6",
   "Chromosomes":[
      {
         "Name":"chr3R",
         "Length":32079331
      },
      {
         "Name":"chr3L",
         "Length":28110227
      },
      {
         "Name":"chr2R",
         "Length":25286936
      },
      ...
   ],
   "hasInteract":1
}
```



#### Compute Voronoi

This command reads data between the supplied start and end loci, generates a contact matrix with the user-specified bin size as well as computing a Voronoi diagram from the same data. Issued with a GET request to a URL formatted like below.

*Example* 
```
http://localhost:5002/voronoiandimage?smoothingIterations=1&binSizeX=5000&binSizeY=5000&sourceChrom=chr3R&targetChrom=chr3R&xStart=15887016&xEnd=16390631&yStart=15947403&yEnd=16411610
```

*Parameters*

| Name | Description |
|------|-------------|
| `binSizeX` | The size of the bins (in base pairs) in the *x*-dimension when generating the contact matrix. |
| `binSizeY` | The size of the bins (in base pairs) in the *y*-dimension when generating the contact matrix. |
| `sourceChrom` | The chromosome identifier (e.g. chr3) to visualise in the *x*-dimension.  |
| `targetChrom` | The chromosome identifier (e.g. chr3) to visualise in the *y*-dimension. |
| `xStart` | The left-most position in the chromosome (in base pairs) marking the region of data to visualise (*x*-dimension). |
| `xEnd` | The right-most position in the chromosome (in base pairs) marking the region of data to visualise (*x*-dimension). |
| `yStart` | The left-most position in the chromosome (in base pairs) marking the region of data to visualise (*y*-dimension). |
| `yEnd` | The right-most position in the chromosome (in base pairs) marking the region of data to visualise (*y*-dimension).  |
| `smoothingIterations` | The number of iterations of Lloyd's algorithm to apply to approximate centroided Voronoi |

*Output*

The resulting data is transmitted in binary format, with the form described below.

| Type | Number | Name | Description |
| ---- | ------: | ----------- | --- |
| `u32`  | 1 | `numBinsX` | Number of bins in the *x*-dimension for the contact matrix. |
| `u32`  | 1 | `numBinsY` | Number of bins in the *y*-dimension for the contact matrix. |
| `u32`  | `numBinsX*numBinsY` | `contactMatrix` | Contract matrix binned at the supplied bin size. |
| `u32`  | 1 | `numDataEntries` | Number of data points (entries) described by the Voronoi diagram. |
| `dataEntry` | `numDataEntries` | `dataEntries` | The data points and the corresponding Voronoi cells. |

The following table describes the format of each `dataEntry`.


| Type | Number | Name | Description |
| ---- | ------: | ----------- | --- |
| `u32` | 1 | `numPoints` | Number of points describing the Voronoi cell (polygon). |
| `f64` | 1 | `polygonArea` | The area of the Voronoi cell (polygon). |
| `u8` | 1 | `isPolygonClipped` | `0` if polygon is not clipped by the bounding rectangle (defined by `xStart:xEnd` and `yStart:yEnd`). `1` otherwise. |
| `[f64,f64]` | 1 | `dataPoint` | Coordinates of the original data point as recorded in the .pairs file. |
| `[f64,f64]` | 1 | `polygonCentroid` | Coordinates of the centroid of the Voronoi cell (polygon). |
| `[f64,f64]` | `numPoints` | `polygonVertices` | Set of coordinates describing the Voronoi cell (polygon). |

#### Set interactions to visualise

This command specifies which interactions should be visualised alongside the .pairs data. To pass a set of interactions to v3c-viz, a POST request should be sent to `http://localhost:5002/interact` with a JSON body of the form below (which describes two interactions). Once this is successfully processed, refreshing the interface will show the submitted interactions. This replaces all previously submitted interactions.

```json
{
    "Interactions":[
        {
            "SourceChrom":"chr3R",
            "SourceStart":717970,
            "SourceEnd":728975,
            "TargetChrom":"chr3R",
            "TargetStart":756550,
            "TargetEnd":757555
        },{
            "SourceChrom":"chr3R",
            "SourceStart":730815,
            "SourceEnd":731820,
            "TargetChrom":"chr3R",
            "TargetStart":762140,
            "TargetEnd":763145
        }
    ]
}
```
