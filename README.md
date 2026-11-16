# Smart Building System

Yapay zeka destekli, akıllı bina enerji yönetimi ve simülasyonu yapan mikro servis mimarili bitirme projesi ana deposu.

---

## 👥 Takım ve Modül Ayrımı

Bu repo çoklu modül (monorepo) mimarisiyle yönetilmektedir. Her ekip sadece kendi sorumluluk alanında çalışır:

* 🏢 **/backend**: Ana Backend Katmanı (Node.js/Express, TimescaleDB, RabbitMQ, Enerji Stratejileri)
* 📊 **/frontend**: Kullanıcı Arayüzü (React.js, Chart.js) *(İlgili ekip tarafından eklenecektir)*
* ⚡ **/simulation**: Veri Simülasyonu ve Streaming *(İlgili ekip tarafından eklenecektir)*
* ⚙️ **/core-engine**: Hesaplama Motoru (Java Spring Boot) *(İlgili ekip tarafından eklenecektir)*

---

## 🚀 Backend'i Başlatma

Backend ile ilgili tüm kaynak kodlar, konfigürasyonlar ve dokümantasyon `backend/` klasöründedir:

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

Detaylı backend API dokümantasyonu için [backend/README.md](backend/README.md) dosyasını inceleyebilirsiniz.
