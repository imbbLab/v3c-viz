import { Point, Polygon, Voronoi } from "./voronoi";

export interface VoronoiAndImage {
    vor: Voronoi,
    overviewImage: Image
}

export interface Image {
    width: number,
    height: number,
    data: Uint32Array
}

export function parseVoronoiAndImage(buffer: ArrayBuffer, area_scale: number): VoronoiAndImage {

    let dataView = new DataView(buffer);
    let offset = 0;
    let numBinsX = dataView.getUint32(offset);
    offset += 4;
    let numBinsY = dataView.getUint32(offset);
    offset += 4;

    let imageSize = numBinsX * numBinsY;
    let overviewImage = new Uint32Array(imageSize);

    for (let i = 0; i < imageSize; i++) {
        overviewImage[i] = dataView.getUint32(offset);
        offset += 4;
    }

    // TODO: Create voronoi representation from binary data
    let vor = new Voronoi();

    let numPolygons = dataView.getUint32(offset);
    offset += 4;

    for (let i = 0; i < numPolygons; i++) {
        let polygon = new Polygon();
        let numPoints = dataView.getUint32(offset);
        offset += 4;

        polygon.area = dataView.getFloat64(offset) * area_scale;
        offset += 8;

        //polygon.logArea = Math.log(polygon.area)

        polygon.clipped = dataView.getUint8(offset) == 1;
        offset += 1

        polygon.dataPoint = new Point(dataView.getFloat64(offset), dataView.getFloat64(offset + 8))
        offset += 16;

        polygon.centroid = new Point(dataView.getFloat64(offset), dataView.getFloat64(offset + 8))
        offset += 16;

        for (let j = 0; j < numPoints; j++) {
            polygon.points.push(new Point(dataView.getFloat64(offset), dataView.getFloat64(offset + 8)))
            offset += 16;
        }

        vor.polygons.push(polygon)
    }

    return { vor: vor, overviewImage: { width: numBinsX, height: numBinsY, data: overviewImage } }
}