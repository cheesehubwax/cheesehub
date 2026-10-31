FROM ubuntu:22.04
RUN apt-get update && apt-get install -y wget ca-certificates && \
    wget https://github.com/AntelopeIO/cdt/releases/download/v4.1.0/cdt_4.1.0-1_amd64.deb && \
    apt-get install -y ./cdt_4.1.0-1_amd64.deb && rm cdt_4.1.0-1_amd64.deb
WORKDIR /work
