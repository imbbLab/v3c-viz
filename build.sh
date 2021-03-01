#!/usr/bin/env bash

BUILD_DIR=$(cd $(dirname $BASH_SOURCE) && pwd)

# Derive the project name from the directory
PROJECT="$(basename $BUILD_DIR)"

# Build the project
cd $BUILD_DIR

mkdir -p bin
mkdir -p bin/linux
mkdir -p bin/darwin
mkdir -p dist

# Clean up static
rm -R static/temp

# Linux
go build -o bin/linux/$PROJECT
rm -f dist/$PROJECT-linux.zip
zip -j dist/$PROJECT-linux.zip bin/linux/$PROJECT 
zip -r dist/$PROJECT-linux.zip static/

# MacOS
env GOOS=darwin GOARCH=amd64 go build -o bin/darwin/$PROJECT
rm -f dist/$PROJECT-macos.zip
zip -j dist/$PROJECT-macos.zip bin/darwin/$PROJECT 
zip -r dist/$PROJECT-macos.zip static/

# Change back to where we were
cd $PRE_PWD