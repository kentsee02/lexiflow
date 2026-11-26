#!/usr/bin/env bash
set -euo pipefail

# Initial Ubuntu 24.04 / 22.04 LTS VPS bootstrap script for LexiFlow.
# Run as root or with sudo: sudo bash setup-vps.sh

if [ "$(id -u)" -ne 0 ]; then
  echo "Please run as root (e.g., sudo bash setup-vps.sh)"
  exit 1
fi

echo "==> [1/6] Ensuring 2GB swap exists for smooth Vite builds on 2GB RAM VPS..."
if ! swapon --show | grep -q '/swapfile'; then
  if [ ! -f /swapfile ]; then
    fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
  fi
fi

echo "==> [2/6] Updating system packages and installing Nginx, Git, UFW..."
apt-get update
apt-get upgrade -y
apt-get install -y git nginx ufw curl ca-certificates gnupg

echo "==> [3/6] Configuring UFW firewall (OpenSSH + Nginx Full)..."
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

echo "==> [4/6] Installing Node.js 22 LTS and PM2..."
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | sed 's/v//' | cut -d. -f1)" -lt 22 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
npm install -g pm2

echo "==> [5/6] Installing Docker Engine & Docker Compose plugin..."
if ! command -v docker >/dev/null 2>&1; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  . /etc/os-release
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
    $VERSION_CODENAME stable" > /etc/apt/sources.list.d/docker.list
  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi

echo "==> [6/6] Preparing application & log directories..."
mkdir -p /var/www /var/log/pm2 /var/backups/lexiflow

echo ""
echo "VPS bootstrap completed!"
echo "Node: $(node -v) | Docker: $(docker --version)"
echo "Next: clone the repo into /var/www/lexiflow, configure .env files, start DB, and enable Nginx."
