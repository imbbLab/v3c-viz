
#include <iostream>
#include <fstream>
#include "HTTPRequest.hpp"

uint32_t read_u32(const std::vector<uint8_t> &v, size_t &pos)
{
    uint32_t value = (static_cast<uint32_t>(v[pos]) << 24) | (static_cast<uint32_t>(v[pos + 1]) << 16) | (static_cast<uint32_t>(v[pos + 2]) << 8) | v[pos + 3];
    pos += 4;

    return value;
}

double read_double(const std::vector<uint8_t> &v, size_t &pos)
{
    uint64_t value = (static_cast<uint64_t>(v[pos]) << 56) | (static_cast<uint64_t>(v[pos + 1]) << 48) | (static_cast<uint64_t>(v[pos + 2]) << 40) |
                     (static_cast<uint64_t>(v[pos + 3]) << 32) | (static_cast<uint64_t>(v[pos + 4]) << 24) | (static_cast<uint64_t>(v[pos + 5]) << 16) |
                     (static_cast<uint64_t>(v[pos + 6]) << 8) | v[pos + 7];
    double d;
    memcpy(&d, &value, sizeof(d));

    pos += 8;

    return d;
}

struct Point
{
    double x;
    double y;
};

struct Entry
{
    double area;
    Point centroid;
    Point dataPoint;
    std::vector<Point> points;
    bool isPolygonClipped;
};

Point read_point(const std::vector<uint8_t> &v, size_t &pos)
{
    Point point;
    point.x = read_double(v, pos);
    point.y = read_double(v, pos);

    return point;
}

Entry read_entry(const std::vector<uint8_t> &v, size_t &pos)
{
    Entry entry;

    uint32_t numPoints = read_u32(v, pos);
    entry.area = read_double(v, pos);

    entry.isPolygonClipped = v[pos] == 1;
    pos += 1;

    entry.dataPoint = read_point(v, pos);
    entry.centroid = read_point(v, pos);

    entry.points.reserve(numPoints);

    for (uint32_t i = 0; i < numPoints; i++)
    {
        entry.points.push_back(read_point(v, pos));
    }

    return entry;
}

struct Data
{
    uint32_t numBinsX;
    uint32_t numBinsY;

    std::vector<uint32_t> contactMap;
    std::vector<Entry> entries;
};

Data read_data(const std::vector<uint8_t> &v, size_t &pos)
{
    Data data;

    data.numBinsX = read_u32(v, pos);
    data.numBinsY = read_u32(v, pos);

    uint32_t numIntensities = data.numBinsX * data.numBinsY;
    data.contactMap.reserve(numIntensities);

    for (uint32_t i = 0; i < numIntensities; i++)
    {
        data.contactMap.push_back(read_u32(v, pos));
    }

    uint32_t numEntries = read_u32(v, pos);
    data.entries.reserve(numEntries);

    for (uint32_t i = 0; i < numEntries; i++)
    {
        data.entries.push_back(read_entry(v, pos));
    }

    return data;
}

int main(int argc, const char *argv[])
{
    try
    {
        std::string uri = "http://localhost:5002/voronoiandimage?smoothingIterations=1&binSizeX=5000&binSizeY=5000&sourceChrom=chr3R&targetChrom=chr3R&xStart=15887016&xEnd=16390631&yStart=15947403&yEnd=16411610";
        std::string method = "GET";
        std::string arguments;
        std::string output;
        auto protocol = http::InternetProtocol::V4;

        http::Request request{uri};

        const auto response = request.send("GET");

        size_t index = 0;

        Data data = read_data(response.body, index);

        std::cout << data.numBinsX << " x " << data.numBinsY << '\n';
        std::cout << data.entries.size() << '\n';

        // std::cout << std::string{response.body.begin(), response.body.end()} << '\n'; // print the result

        // const auto response = request.send(method, arguments, {{"Content-Type", "application/x-www-form-urlencoded"}, {"User-Agent", "runscope/0.1"}, {"Accept", "*/*"}}, std::chrono::seconds(2));

        // std::cout << response.status.reason << '\n';

        // if (response.status.code == http::Status::Ok)
        // {
        //     if (!output.empty())
        //     {
        //         std::ofstream outfile{output, std::ofstream::binary};
        //         outfile.write(reinterpret_cast<const char *>(response.body.data()),
        //                       static_cast<std::streamsize>(response.body.size()));
        //     }
        //     else
        //         std::cout << std::string{response.body.begin(), response.body.end()} << '\n';
        // }
    }
    catch (const http::RequestError &e)
    {
        std::cerr << "Request error: " << e.what() << '\n';
        return EXIT_FAILURE;
    }
    catch (const http::ResponseError &e)
    {
        std::cerr << "Response error: " << e.what() << '\n';
        return EXIT_FAILURE;
    }
    catch (const std::exception &e)
    {
        std::cerr << "Error: " << e.what() << '\n';
        return EXIT_FAILURE;
    }

    return EXIT_SUCCESS;
}