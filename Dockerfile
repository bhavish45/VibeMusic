FROM python:3.11-slim-bookworm

RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates curl unzip \
    && rm -rf /var/lib/apt/lists/*

# Deno — required for YouTube n-challenge solving
RUN curl -fsSL https://deno.land/install.sh | DENO_INSTALL=/usr/local sh

# wgcf 2.3.1
RUN curl -fsSL -o /usr/local/bin/wgcf \
        https://github.com/ViRb3/wgcf/releases/download/v2.3.1/wgcf_2.3.1_linux_amd64 \
    && chmod +x /usr/local/bin/wgcf

# wireproxy 1.0.9 (userspace SOCKS5, no root)
RUN curl -fsSL -o /tmp/wireproxy.tar.gz \
        https://github.com/whyvl/wireproxy/releases/download/v1.0.9/wireproxy_linux_amd64.tar.gz \
    && tar -xzf /tmp/wireproxy.tar.gz -C /usr/local/bin \
    && chmod +x /usr/local/bin/wireproxy \
    && rm /tmp/wireproxy.tar.gz

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -U pip "yt-dlp[default]" -r requirements.txt
COPY . .
RUN chmod +x /app/start.sh

ENV PATH="/usr/local/bin:${PATH}"
CMD ["/app/start.sh"]

