# DODA server bosqichini joylashtirish

Bu yo‘riqnoma `vps12546`dagi mavjud `/opt/tajriba24/deploy/vps` Compose loyihasi uchun. `web` Caddy konteyneri 80/443 portlarini boshqaradi. Ma’lumotlar bazasi va boshqa saytlarga tegmang.

## Old shartlar

- `feature/doda-core` tarmog‘i ko‘rib chiqilgan va serverda `/opt/doda-agent-source` papkasiga olingan.
- OpenAI, Gemini va/yoki Anthropic Claude API kaliti hamda tegishli standart model nomi bor. Kalitlar faqat serverdagi `/opt/doda-private.env` faylida bo‘ladi. Google AI Studio kaliti Google Cloud loyihasiga bog‘liq; Vertex AI OAuth alohida adapter talab qiladi.
- Ishlaydigan SMTP xizmati, yuboruvchi manzil va tashkilot egasining elektron pochtasi belgilangan. Pochtasiz yangi kirish oqimini yoqmang.
- `/opt/doda-data` faqat `10001` UID’li API konteyneri tomonidan yoziladi; zaxira nusxasini alohida rejalashtiring.
- Oldingi ishlar shu `doda.tajriba24.uz` brauzerida saqlangan bo‘lsa, serverga kirgandan so‘ng ko‘chirish paneli chiqadi. Avval fayllari bilan JSON zaxira nusxasini yuklab oling, keyin **Serverga ko‘chirish** tugmasini bosing. Mahalliy nusxa o‘chirilmaydi. Boshqa domen, brauzer yoki qurilmadagi ishlar avtomatik topilmaydi.

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

`/opt/doda-private.env` uchun `0600` huquq qo‘ying. Unda `.env.example`dagi nomlarni haqiqiy qiymatlar bilan to‘ldiring; faylni chatga yoki GitHub’ga yubormang. `DODA_AI_ORDER` qaysi xizmat birinchi ishlashini belgilaydi; keyingisiga faqat vaqtinchalik xatoda o‘tiladi. Uch xizmatga ko‘chish xususiy ma’lumotni keyingi xizmatga ham yuborishi mumkin. `DODA_SESSION_SECRET` kamida 32 ta tasodifiy belgi bo‘lishi kerak. SMTP `starttls` yoki `ssl` bilan ishlaydi; kod yuborish sinovini o‘zingiz nazorat qiladigan pochta orqali o‘tkazing.

## Tekshirish tartibi

1. `cd /opt/tajriba24/deploy/vps` va Caddyfile hamda Compose override nusxalarini saqlang.
2. `docker compose config --quiet` bilan YAML’ni, `docker exec vps-web-1 caddy adapt --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null` bilan Caddy sintaksisini tekshiring.
3. `docker compose build doda-api && docker compose up -d --no-deps doda-api` bilan faqat API xizmatini qo‘shing. `docker compose up -d --no-deps --no-build web` faqat mountlar o‘zgargan bo‘lsa kerak; mavjud override allaqachon ishlayotgan bo‘lsa, `docker exec vps-web-1 caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile` yetarli.
4. `/opt/doda-agent-source`dan faqat `index.html`, `app.css`, `app.js`, `migration.js`, `model-picker.js`, `profile.js` fayllarini `/opt/doda-public`ga nusxalang. `.git`, `.env` yoki server kodini web ildiziga qo‘ymang.
5. `curl -I https://doda.tajriba24.uz/` hamda autentifikatsiyasiz `curl -i https://doda.tajriba24.uz/api/state`, `/api/ai/status`, `/api/ai/models` va `/api/me` (`401` bo‘lishi kerak) bilan tekshiring. Keyin brauzerda email kodi, tashkilot profili, uch xizmat model ro‘yxati, har birida haqiqiy javob, PDF, topshiriq, agentning yozma natijasi va Kapitan qabuli oqimini sinang. Eski ishlar bo‘lsa, zaxirani alohida saqlab, ko‘chirishdan keyin fayllar ham ochilishini tekshiring.

**Eslatma:** `caddy adapt` faqat sintaksisni ko‘radi; API ishlashini va kalit mosligini jonli funksional sinov tasdiqlaydi. Boshqa Compose xizmatlarini `--remove-orphans` bilan o‘chirmang.
