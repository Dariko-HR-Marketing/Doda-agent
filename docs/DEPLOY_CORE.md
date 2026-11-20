# DODA server bosqichini joylashtirish

Bu yo‘riqnoma `vps12546`dagi mavjud `/opt/tajriba24/deploy/vps` Compose loyihasi uchun. `web` Caddy konteyneri 80/443 portlarini boshqaradi. Ma’lumotlar bazasi va boshqa saytlarga tegmang.

## Old shartlar

- `feature/doda-core` tarmog‘i ko‘rib chiqilgan va serverda `/opt/doda-agent-source` papkasiga olingan.
- OpenAI API kaliti va foydalanish mumkin bo‘lgan model nomi bor. Kalit faqat serverdagi `/opt/doda-private.env` faylida bo‘ladi.
- `/opt/doda-data` faqat `10001` UID’li API konteyneri tomonidan yoziladi; zaxira nusxasini alohida rejalashtiring.
- Oldingi brauzer `localStorage`/`IndexedDB` ishlari avtomatik ko‘chmaydi. Ularni yo‘qotmaslik uchun ishlab chiqarish muhitiga o‘tishdan oldin eksport/migratsiya qiling.

## Tarkib

`docker-compose.override.yml` ichidagi mavjud `web` mountlarini saqlang va `doda-api` xizmatini qo‘shing:

```yaml
services:
  web:
    volumes:
      - /opt/doda-public:/srv/doda:ro
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
  doda-api:
    build:
      context: /opt/doda-agent-source
      dockerfile: backend/Dockerfile
    restart: unless-stopped
    env_file: /opt/doda-private.env
    volumes:
      - /opt/doda-data:/data
```

Yangi API uchun hostga port chiqarmang. Caddyfile’dagi mavjud `doda.tajriba24.uz` blokining ichini quyidagiga almashtiring:

```caddyfile
doda.tajriba24.uz {
    import security
    encode zstd gzip
    handle /api/* {
        reverse_proxy doda-api:8000
    }
    handle {
        root * /srv/doda
        header / Cache-Control "no-store"
        file_server
    }
}
```

`/opt/doda-private.env` uchun `0600` huquq qo‘ying. Unda `.env.example`dagi nomlarni haqiqiy qiymatlar bilan to‘ldiring; faylni chatga yoki GitHub’ga yubormang. Serverda image’ni qurgach, login hashini interaktiv yarating: `docker run --rm -it --entrypoint python doda-api -m backend.server hash-password` (image nomini `docker compose images doda-api` bilan aniqlang). `DODA_SESSION_SECRET` kamida 32 ta tasodifiy belgi bo‘lishi kerak.

## Tekshirish tartibi

1. `cd /opt/tajriba24/deploy/vps` va Caddyfile hamda Compose override nusxalarini saqlang.
2. `docker compose config --quiet` bilan YAML’ni, `docker exec vps-web-1 caddy adapt --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null` bilan Caddy sintaksisini tekshiring.
3. `docker compose build doda-api && docker compose up -d --no-deps doda-api` bilan faqat API xizmatini qo‘shing. `docker compose up -d --no-deps --no-build web` faqat mountlar o‘zgargan bo‘lsa kerak; mavjud override allaqachon ishlayotgan bo‘lsa, `docker exec vps-web-1 caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile` yetarli.
4. `/opt/doda-agent-source`dan faqat `index.html`, `app.css`, `app.js` fayllarini `/opt/doda-public`ga nusxalang. `.git`, `.env` yoki server kodini web ildiziga qo‘ymang.
5. `curl -I https://doda.tajriba24.uz/` hamda autentifikatsiyasiz `curl -i https://doda.tajriba24.uz/api/state` (`401` bo‘lishi kerak) bilan tekshiring. Keyin brauzerda kirish, suhbat, fayl, topshiriq va Kapitan qabuli oqimini sinang.

**Eslatma:** `caddy adapt` faqat sintaksisni ko‘radi; API ishlashini va kalit mosligini jonli funksional sinov tasdiqlaydi. Boshqa Compose xizmatlarini `--remove-orphans` bilan o‘chirmang.
