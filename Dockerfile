# Dockerfile for ndi-dockrecorder
FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV NDI_VERSION=6
ENV LD_LIBRARY_PATH=/usr/local/lib:$LD_LIBRARY_PATH

# Install system dependencies & build tools
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    git \
    build-essential \
    ffmpeg \
    avahi-daemon \
    avahi-utils \
    libavahi-client3 \
    libavahi-client-dev \
    dbus \
    ca-certificates \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Download, extract, and install official NDI SDK v6 for Linux (libndi.so + C headers)
RUN mkdir -p /tmp/ndi && cd /tmp/ndi \
    && curl -fsSL -o Install_NDI_SDK_v6_Linux.tar.gz "https://downloads.ndi.tv/SDK/NDI_SDK_Linux/Install_NDI_SDK_v6_Linux.tar.gz" \
    && tar -xzf Install_NDI_SDK_v6_Linux.tar.gz \
    && yes | PAGER="cat" sh Install_NDI_SDK_v6_Linux.sh \
    && mv "NDI SDK for Linux" ndisdk \
    && cp ndisdk/include/*.h /usr/local/include/ 2>/dev/null || true \
    && cp -r ndisdk/include/* /usr/local/include/ 2>/dev/null || true \
    && case "$(uname -m)" in \
         x86_64) cp -r ndisdk/lib/x86_64-linux-gnu/* /usr/local/lib/ 2>/dev/null || true ;; \
         aarch64) cp -r ndisdk/lib/aarch64-rpi4-linux-gnueabi/* /usr/local/lib/ 2>/dev/null || true ;; \
       esac \
    && ln -s /usr/local/lib/libndi.so.6 /usr/local/lib/libndi.so.5 2>/dev/null || true \
    && ln -s /usr/local/lib/libndi.so.6 /usr/local/lib/libndi.so 2>/dev/null || true \
    && ldconfig \
    && rm -rf /tmp/ndi

# Set up NDI Access Manager config directory
ENV NDI_CONFIG_DIR=/app/config
RUN mkdir -p /app/config

# Set up working directory
WORKDIR /app

# Copy application files & package.json
COPY package.json ./
COPY src/ ./src/

# Compile NDI C helper executable
RUN gcc -O2 src/ndi_capture.c -I/usr/local/include -L/usr/local/lib -lndi -o /usr/local/bin/ndi_capture

# Install Node.js dependencies
RUN npm install --omit=dev

# Expose API and WebSocket ports
EXPOSE 3000

# Start application with dbus & avahi-daemon running
CMD ["sh", "-c", "service dbus start 2>/dev/null || true; service avahi-daemon start 2>/dev/null || true; npm start"]
