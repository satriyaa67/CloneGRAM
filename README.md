# CloneGRAM

Sade bir içerik yayın stüdyosu: yetkili olduğunuz Telegram kaynaklarından gelen uygun içerikleri gözden geçirin, düzenleyin ve yönettiğiniz hedef kanalda yayımlayın. Ayrı kampanya modülü yalnızca bota açıkça abone olmuş kullanıcılara mesaj göndermek için tasarlanır.

> **Şu an:** Faz 1 canlıda, Faz 1.1 eklendi. Tek bir Cloudflare Worker hem paneli (`site/`) hem API'yi (`worker/`) aynı adresten sunar: bot bağlantısı, botun eklendiği kanalları otomatik listeleme, izin kontrolleri, içerik kuyruğu, tek tıkla hedefe gönderme, iptal/geri alma, test mesajı, açık/koyu tema. 58 otomatik test. Metin düzenleme, filigran, otomatik yayın ve kampanyalar sonraki fazlarda.

## Canlıya alma (ücretsiz, Cloudflare)

Adımlar: [`ops/github-workflows/README.md`](ops/github-workflows/README.md). Özetle: `deploy.yml` dosyasını `.github/workflows/` altına taşı, dört repo secret'ı ekle, **Actions > Deploy > Run workflow**. Panel adresi çalıştırma özetinde çıkar (`https://clonegram.<alt-alan>.workers.dev`). Alan adı alındığında Worker'a özel alan adı olarak bağlanır.

## Yerel önizleme

`site/index.html` dosyasını açıp **Örnek verilerle incele** seçeneğiyle paneli ağsız gezebilirsiniz. API: [`worker/README.md`](worker/README.md), testler `cd worker && node --test` (Node 22+, kurulum gerekmez).

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

Panel: düz HTML/CSS/JS, Worker'ın statik varlıkları olarak sunulur (aynı origin, sıkı CSP).
API: Cloudflare Worker (bağımlılıksız JavaScript) + D1 (SQLite); tüm SQL tek bir adaptörde, ileride Postgres'e geçiş tek dosya işidir. Medya için Cloudflare R2 ve ağır medya işleme için ayrı container worker planlanıyor. Büyük medya dosyalarını edge işlevlerinde belleğe almayın.

## Plan

Aşamalar ve kabul ölçütleri: [`docs/MVP-PLAN.md`](docs/MVP-PLAN.md).
