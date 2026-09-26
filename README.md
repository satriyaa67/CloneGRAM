# CloneGRAM

Sade bir içerik yayın stüdyosu: yetkili olduğunuz Telegram kaynaklarından gelen uygun içerikleri gözden geçirin, düzenleyin ve yönettiğiniz hedef kanalda yayımlayın. Ayrı kampanya modülü yalnızca bota açıkça abone olmuş kullanıcılara mesaj göndermek için tasarlanır.

> **Şu an:** `site/` statik panel önizlemesi (örnek veri) ve `worker/` içinde Faz 1 API'si: Telegram Bot API ile kayıtlı kaynaklardan içerik alma, izin kontrolleri ve içerik kuyruğu. API yerelde 38 testle doğrulandı, henüz canlıya alınmadı. Yayınlama, medya düzenleme ve kampanyalar sonraki fazlarda.

## Yerel önizleme

`site/index.html` dosyasını tarayıcıda açın ya da yerel bir statik sunucuda `site/` klasörünü yayınlayın.

## API (Faz 1)

Kurulum, uç noktalar ve test komutu: [`worker/README.md`](worker/README.md). Testler: `cd worker && node --test` (Node 22+, kurulum gerekmez).

## Cloudflare Pages ücretsiz prototip

1. Cloudflare hesabınızda **Workers & Pages → Create → Pages → Connect to Git** yolunu izleyin.
2. `satriyaa67/CloneGRAM` deposunu seçin.
3. Framework preset: **None**, build command boş, output directory: `site`.
4. İlk dağıtım sonrası `*.pages.dev` adresi oluşur. Özel alan adını satın aldığınızda Pages ayarlarından eklersiniz.

Alternatif: `ops/github-workflows/deploy-pages.yml` şablonunu `.github/workflows/` altına kopyalayıp `CLOUDFLARE_API_TOKEN` ve `CLOUDFLARE_ACCOUNT_ID` repo secret'larını eklerseniz her `site/` değişikliği otomatik yayınlanır. Ücretsiz katman demo içindir; üretim garantisi sayılmaz.

## Ekipteki üç geliştirici aracı

Claude Code proje ayarları `.claude/settings.json` içinde paylaşılır: Frontend Design ve Superpowers eklentileri etkinleştirilmiştir; ilk proje güveninde marketplace/eklenti kurulum onayı istenebilir. Context7 remote MCP `.mcp.json` ile tanımlanır; ayrıca `CLAUDE.md` kaynak belgeler için Context7 kullanımını ister. Superpowers çıktıları `docs/superpowers/specs` ve `docs/superpowers/plans` altında tutulur.

Daha yüksek Context7 limitleri için isteğe bağlı API anahtarını kendi yerel ortamınızda tanımlayın, anahtarı depoya commit etmeyin. Projeye özel çalışma kuralları `CLAUDE.md` dosyasındadır.

## Güvenli ürün sınırları

- Korumalı içerik, indirme/iletme kısıtlaması ya da erişim engelini aşmaya çalışma yok.
- Yalnızca yeniden yayımlama hakkınız olan ve botun erişebildiği içerikleri işleyin.
- Kullanıcı/üye kazıma, soğuk DM, proxy/hesap rotasyonu veya yaptırımları atlatma yok.
- Kampanyalar yalnızca açıkça abone olan ve pazarlama izni bulunan kitleye; çıkış/engelleme durumları her gönderimden önce uygulanmalı.
- Telegram açılma/görüntülenme ölçümleri Bot API ile her zaman mevcut değildir; gösterilmeyen metriği uydurmayın.
- Telegram API şartları üçüncü taraf kanal içerik erişimi ve resmi sponsorlu mesajlarla ilgili yükümlülükler içerir. Ürünün dağıtım modelini canlıya almadan önce hukuki ve platform gereksinimleriyle doğrulayın.

## Teknoloji yönü

Panel: düz HTML/CSS/JS, Cloudflare Pages.
API: Cloudflare Worker (bağımlılıksız JavaScript) + D1 (SQLite) veri deposu; tüm SQL tek bir adaptörde, ileride Postgres'e geçiş tek dosya işidir. Medya için Cloudflare R2 ve ağır medya işleme için ayrı container worker planlanıyor. Büyük medya dosyalarını edge işlevlerinde belleğe almayın.

## Plan

Aşamalar ve kabul ölçütleri: [`docs/MVP-PLAN.md`](docs/MVP-PLAN.md).
