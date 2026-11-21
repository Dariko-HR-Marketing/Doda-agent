#!/usr/bin/env bash
# Serverda BIR MARTA ishga tushiriladi (root sifatida):
#   bash server-setup.sh <deploy-public-key>
# Nginx, HTTPS (Let's Encrypt) va deploy foydalanuvchisini sozlaydi.
set -euo pipefail

DOMAIN="doda.tajriba24.uz"
WEBROOT="/var/www/doda"
DEPLOY_USER="deploy"
PUBKEY="${1:?Deploy ochiq (public) kalitini argument sifatida bering}"

apt-get update
apt-get install -y nginx certbot python3-certbot-nginx rsync ufw

id "$DEPLOY_USER" >/dev/null 2>&1 || adduser --disabled-password --gecos "" "$DEPLOY_USER"
install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh"
grep -qxF "$PUBKEY" "/home/$DEPLOY_USER/.ssh/authorized_keys" 2>/dev/null \
  || echo "$PUBKEY" >> "/home/$DEPLOY_USER/.ssh/authorized_keys"
chown "$DEPLOY_USER:$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh/authorized_keys"
chmod 600 "/home/$DEPLOY_USER/.ssh/authorized_keys"

install -d -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$WEBROOT"

cp "$(dirname "$0")/nginx-doda.conf" /etc/nginx/sites-available/doda
ln -sf /etc/nginx/sites-available/doda /etc/nginx/sites-enabled/doda
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

ufw allow OpenSSH && ufw allow 'Nginx Full' && ufw --force enable

certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email --redirect
echo "Tayyor: https://$DOMAIN"
