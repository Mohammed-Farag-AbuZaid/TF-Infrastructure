#!/bin/bash
# =============================================================================
# TF Unions — Idempotent VPS Host Hardening Script (Ubuntu / Debian)
# Configures UFW (22, 80, 443), Fail2ban (sshd), unattended-upgrades,
# and key-only SSH authentication. Run as root.
# =============================================================================
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "ERROR: harden-host.sh must be run as root." >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive

echo "[1/4] Installing ufw, fail2ban, and unattended-upgrades..."
apt-get update -qq
apt-get install -y -qq ufw fail2ban unattended-upgrades

echo "[2/4] Configuring UFW firewall (22/tcp, 80/tcp, 443/tcp)..."
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "[3/4] Configuring Fail2ban and unattended security upgrades..."
mkdir -p /etc/fail2ban/jail.d
cat <<'EOF' > /etc/fail2ban/jail.d/tfunions-sshd.local
[sshd]
enabled = true
port = ssh
maxretry = 5
findtime = 10m
bantime = 1h
EOF
systemctl enable fail2ban
systemctl restart fail2ban

dpkg-reconfigure -f noninteractive unattended-upgrades

echo "[4/4] Enforcing SSH key-only authentication..."
mkdir -p /etc/ssh/sshd_config.d
cat <<'EOF' > /etc/ssh/sshd_config.d/99-tfunions-hardening.conf
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin prohibit-password
PubkeyAuthentication yes
EOF

sshd -t
systemctl reload ssh || systemctl reload sshd

echo "Host hardening complete."
