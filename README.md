# CloneGRAM

Sade bir içerik yayın stüdyosu: yetkili olduğunuz Telegram kaynaklarından gelen uygun içerikleri gözden geçirin, düzenleyin ve yönettiğiniz hedef kanalda yayımlayın. Ayrı kampanya modülü yalnızca bota açıkça abone olmuş kullanıcılara mesaj göndermek için tasarlanır.

> **Şu an:** Statik, etkileşimli UI önizlemesi. Telegram API, kimlik doğrulama, veritabanı, medya işleme veya gerçek gönderim bağlı değildir.

## Yerel önizleme

`site/index.html` dosyasını tarayıcıda açın ya da yerel bir statik sunucuda `site/` klasörünü yayınlayın.

## Cloudflare Pages ücretsiz prototip

1. Cloudflare hesabınızda **Workers & Pages → Create → Pages → Connect to Git** yolunu izleyin.
2. `satriyaa67/CloneGRAM` deposunu seçin.
3. Framework preset: **None**, build command boş, output directory: `site`.
4. İlk dağıtım sonrası `*.pages.dev` adresi oluşur. Özel alan adını satın aldığınızda Pages ayarlarından eklersiniz.

`wrangler.toml` Pages çıkış klasörünü belirtir. Bu konuşmada Cloudflare hesabı/API yetkisi bağlı olmadığından canlı dağıtım yapılmış değildir. Ücretsiz katman demo içindir; sürekli worker ve medya dönüştürme için üretim garantisi sayılmaz.

## Ekipteki üç geliştirici aracı

Claude Code proje ayarları `.claude/settings.json` içinde paylaşılır: Frontend Design ve Superpowers eklentileri etkinleştirilmiştir; ilk proje güveninde marketplace/eklenti kurulum onayı istenebilir. Context7 remote MCP `.mcp.json` ile tanımlanır; ayrıca `CLAUDE.md` kaynak belgeler için Context7 kullanımını ister.

Daha yüksek Context7 limitleri için isteğe bağlı API anahtarını kendi yerel ortamınızda tanımlayın, anahtarı depoya commit etmeyin. Projeye özel çalışma kuralları `CLAUDE.md` dosyasındadır.

## Güvenli ürün sınırları

- Korumalı içerik, indirme/iletme kısıtlaması ya da erişim engelini aşmaya çalışma yok.
- Yalnızca yeniden yayımlama hakkınız olan ve botun erişebildiği içerikleri işleyin.
- Kullanıcı/üye kazıma, soğuk DM, proxy/hesap rotasyonu veya yaptırımları atlatma yok.
- Kampanyalar yalnızca açıkça abone olan ve pazarlama izni bulunan kitleye; çıkış/engelleme durumları her gönderimden önce uygulanmalı.
- Telegram açılma/görüntülenme ölçümleri Bot API ile her zaman mevcut değildir; gösterilmeyen metriği uydurmayın.
- Telegram API şartları üçüncü taraf kanal içerik erişimi ve resmi sponsorlu mesajlarla ilgili yükümlülükler içerir. Ürünün dağıtım modelini canlıya almadan önce hukuki ve platform gereksinimleriyle doğrulayın.

## Teknoloji yönü

Önizleme: düz HTML/CSS/JS, Cloudflare Pages.
Ürün arka ucu önerisi: Cloudflare Workers ile webhook ve kısa API işleri, Supabase Postgres/Auth, Cloudflare R2 medya nesneleri, kuyruk üzerinden job yönlendirme; ağır medya işleme için ayrı container worker. Büyük medya dosyalarını edge işlevlerinde belleğe almayın.

## Plan

Aşamalar ve kabul ölçütleri: [`docs/MVP-PLAN.md`](docs/MVP-PLAN.md).