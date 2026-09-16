# ⚡ QuizLive — Gerçek Zamanlı Multiplayer Quiz Web Uygulaması

Kahoot benzeri, gerçek zamanlı (WebSocket tabanlı), profesyonel yarışma programı atmosferine sahip, modern ve responsive çok oyunculu bilgi yarışması web uygulaması.

---

## 🎯 Projenin Amacı ve Özellikleri

- **Admin / Güvenli Oda Oluşturma:**
  - Normal kullanıcılar oda oluşturamaz; ana sayfada yalnızca **"Odaya Katıl"** ekranı yer alır.
  - Oda oluşturma yetkisi yalnızca **Yöneticiye (Admin)** aittir.
  - Üst kısımdaki **"🛡️ Yönetici"** butonu veya `/admin` adresi üzerinden açılan şifreli panel ile güvenli şekilde yeni yarışma odası açılır (Varsayılan Şifre: `admin123`, ortam değişkeni `ADMIN_PASSWORD` ile değiştirilebilir).
  - İzinsiz API çağrıları sunucu seviyesinde `403 Forbidden` ile engellenir.
- **6 Haneli Benzersiz Oda Kodu:** Sunucu tarafından otomatik üretilen (Örn: `ABC123`), büyük/küçük harf duyarsız benzersiz oda sistemi.
- **Host ve Oyuncu Rolleri:** Odayı oluşturan admin kullanıcı host yetkisine sahip olur. Sadece host oyunu başlatabilir, rauntları yönetebilir veya tekrar başlatabilir.
- **Gerçek Zamanlı Lobi:** Katılan oyuncular WebSocket üzerinden anlık olarak lobi ekranına düşer ve tüm ekranlarda senkronize güncellenir.
- **İsim Çakışması Kontrolü:** Aynı odada aynı kullanıcı adının tekrar kullanılması sunucu seviyesinde engellenir.
- **Güvenli (Server-Authoritative) Oyun Mimarisi:**
  - Doğru cevap seçeneği soru aşamasında **asla istemciye gönderilmez**.
  - Puanlama hesaplaması istemciye emanet edilmez; sunucuda milisaniye hassasiyetinde ölçülen cevap zamanına göre hesaplanır.
- **Doğruluk + Hız Puanlama Sistemi:**
  - Doğru Cevap = 500 Taban Puan + (Maksimum 500 Puan Hız Bonusu).
  - Ne kadar erken cevap verilirse o kadar yüksek hız puanı kazanılır (maksimum 1000 puan).
  - Yanlış Cevap = 0 Puan.
  - Puanlama mantığı `scoring.py` içinde modüler bir fonksiyon olarak ayrılmıştır.
- **Soru Sonucu ve Anlık Liderlik Tablosu:** Her soru bittiğinde doğru cevap açıklanır, oyuncuların kazandığı puanlar gösterilir ve güncel sıralama listelenir.
- **Final Podyumu (Oyun Sonu):** Tüm sorular bittiğinde 1., 2. ve 3. podyum basamakları (kupa, madalyalar) ve tam yarışma sıralaması gösterilir.
- **🎵 Profesyonel Yarışma Programı Ses Motoru (Web Audio API):**
  - "Kim Milyoner Olmak İster" geriliminden ilham alan, sıfır harici dosya/telif gerektirmeyen 11 adet özgün sentezleyici ses efekti:
    1. **Oyuncu Katıldığında:** Sıcak iki tonlu karşılama zili (F5 -> C6).
    2. **Oyun Başladığında:** Sinematik derin başlangıç gongu ve yükselen sub-bass stinger.
    3. **Soru Gösterildiğinde:** Gerilimli C minör soru akoru (dramatik drone ve rezonans filtresi).
    4. **Geri Sayım Sırasında:** Dramatik kalp atışı (heartbeat) ve saat tıkırtısı (son 5 saniyede hızlanan çift atış!).
    5. **Cevap Seçildiğinde:** Keskin mekanik karar kilitlenme sesi (Lock-In transient + confirmation resonance).
    6. **Doğru Cevap Verildiğinde:** Görkemli zafer akoru ve muzaffer arpej.
    7. **Yanlış Cevap Verildiğinde:** Dramatik hayal kırıklığı düşüşü (dissonant slide + sub rumble).
    8. **Soru Süresi Bittiğinde:** Tok süre doldu gongu.
    9. **Skor Açıklandığında:** Yükselen pentatonik kristal puan ışıltısı.
    10. **Oyun Sona Erdiğinde:** Final öncesi orkestral vuruş ve riser.
    11. **Kazanan Açıklandığında:** Büyük şampiyon coronation fanfarı.
- **Sitenin Alt Kısmında Sade "Batlıcan" İmzası:** Sayfa tasarımını bozmayan, dikkat dağıtmayan zarif ve minimalist "Batlıcan" yazısı.

---

## 🛠️ Seçilen Teknolojiler

### 1. Backend: Python FastAPI + WebSockets + Uvicorn
- Python 3.13 `asyncio` mimarisiyle sıfır gecikmeli gerçek zamanlı WebSocket iletişimi.
- Sunucu tarafında tam yetkilendirme (Admin password doğrulaması).

### 2. Frontend: HTML5 + Vanilla Modern JavaScript (ES6+) + CSS3 + Web Audio API
- Derleme süreci (build tool) olmadan doğrudan tarayıcıda çalışan hızlı SPA.
- Web Audio API ile sıfır gecikmeli, kesintisiz ses sentezleme.

---

## 📂 Dosya Yapısı

```
quiz-app/
├── requirements.txt         # Gerekli Python paketleri (fastapi, uvicorn, websockets)
├── main.py                  # FastAPI sunucu giriş noktası, Admin doğrulaması ve WebSocket router
├── scoring.py               # Doğruluk ve hıza göre puan hesaplayan bağımsız modül
├── questions.py             # Soru havuzu ve istemci için güvenlik filtresi (sanitize)
├── room_manager.py          # Odalar, oyuncular, sunucu zamanlayıcıları ve senkronizasyon mantığı
├── test_quiz.py             # 10 adet birim testi (admin yetkisi, puanlama, oda çakışmaları)
├── test_e2e_simulation.py   # Çok oyunculu tam WebSocket akış simülasyon testi
├── static/
│   ├── index.html           # Modern tek sayfa (SPA) arayüzü, Admin Modal ve "Batlıcan" imzası
│   ├── css/
│   │   └── style.css        # Responsive cam efektli karanlık tema, modal ve footer stilleri
│   └── js/
│       ├── sound.js         # Web Audio API ile 11 adet dramatik yarışma programı ses efekti
│       └── app.js           # WebSocket istemcisi, admin akışı, sayaçlar ve ses tetikleyicileri
└── README.md                # Dokümantasyon ve kılavuz
```

---

## 🚀 Projeyi Çalıştırma Adımları

### 1. Gerekli Paketleri Yükleyin
```bash
cd C:\Users\USER\.gemini\antigravity\scratch\quiz-app
pip install -r requirements.txt
```

### 2. Sunucuyu Başlatın
```bash
python main.py
```

Konsolda sunucunun `http://localhost:8000` adresinde çalıştığını göreceksiniz.

### 3. Nasıl Oynanır?
1. **Admin Olarak Oda Açma:**
   - Tarayıcınızda `http://localhost:8000` adresini açın.
   - Sağ üstteki **"🛡️ Yönetici"** butonuna tıklayın (veya doğrudan `http://localhost:8000/admin` adresine gidin).
   - Admin şifresini (`admin123`) ve Host adınızı girip **"Yeni Oda Oluştur"** butonuna basın.
   - Oluşturulan 6 haneli oda kodu (Örn: `ABC123`) ekranda gösterilir.
2. **Oyuncu Olarak Katılma:**
   - Yeni bir sekmede `http://localhost:8000` adresini açın.
   - Doğrudan ana sayfadaki formdan oda kodunu ve oyuncu adınızı girip **"Odaya Katıl"** butonuna tıklayın.
3. **Oyunu Başlatma:**
   - Host ekranında **"▶️ Oyunu Başlat"** butonuna basıldığında tüm oyuncular yarışma sesleri ve efektleri eşliğinde soruları çözmeye başlar.

---

## 🧪 Testleri Çalıştırma

Tüm testleri (Admin yetkisi, puanlama, soru güvenliği ve E2E simülasyonu) çalıştırmak için:

```bash
pytest -v
```
veya
```bash
python test_e2e_simulation.py
```
