#!/usr/bin/env bash
# Serverda BIR MARTA ishga tushiriladi (root sifatida):
#   bash server-setup.sh "<deploy-public-key>"
#
# Xavfsizlik: boshqa saytlar/xizmatlarga TEGMAYDI.
#  - faqat doda.tajriba24.uz uchun alohida Nginx fayli qo'shadi
#  - mavjud Nginx saytlarini o'chirmaydi/o'zgartirmaydi
#  - firewall (ufw) sozlamalariga tegmaydi
#  - 80-port boshqa dastur (Nginx emas) band qilgan bo'lsa, to'xtaydi
set -euo pipefail

DOMAIN="doda.tajriba24.uz"
WEBROOT="/var/www/doda"
DEPLOY_USER="deploy"
PUBKEY="${1:?Deploy ochiq (public) kalitini argument sifatida bering}"

echo "== Mavjud holat =="
ss -ltnp 2>/dev/null | grep -E ':(80|443)\s' || echo "80/443 portlarni hech kim tinglamayapti"
ls /etc/nginx/sites-enabled 2>/dev/null || true

# 80/443 ni Nginx'dan boshqa dastur band qilgan bo'lsa, to'xtaymiz
if ss -ltnp 2>/dev/null | grep -E ':(80|443)\s' | grep -qv nginx; then
  echo "XATO: 80/443 portni Nginx emas, boshqa dastur ishlatyapti. To'xtadim, hech narsa o'zgartirilmadi." >&2
  exit 1
fi

apt-get update
apt-get install -y nginx certbot python3-certbot-nginx rsync

id "$DEPLOY_USER" >/dev/null 2>&1 || adduser --disabled-password --gecos "" "$DEPLOY_USER"
install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh"
grep -qxF "$PUBKEY" "/home/$DEPLOY_USER/.ssh/authorized_keys" 2>/dev/null \
  || echo "$PUBKEY" >> "/home/$DEPLOY_USER/.ssh/authorized_keys"
chown "$DEPLOY_USER:$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh/authorized_keys"
chmod 600 "/home/$DEPLOY_USER/.ssh/authorized_keys"

install -d -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$WEBROOT"

# Faqat o'z faylimiz; boshqa saytlar va default'ga tegmaymiz
cp "$(dirname "$0")/nginx-doda.conf" /etc/nginx/sites-available/doda
ln -sf /etc/nginx/sites-available/doda /etc/nginx/sites-enabled/doda
nginx -t
systemctl reload nginx

# Sertifikat faqat shu domen uchun
certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email --redirect
nginx -t && systemctl reload nginx
echo "Tayyor: https://$DOMAIN"
