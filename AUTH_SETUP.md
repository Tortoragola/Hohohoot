# 🔐 Supabase Auth Integration - Setup Guide

## ✅ Tamamlanan İşlemler

### 1. Oluşturulan Dosyalar
- ✅ `public/supabase-client.js` - Ortak Supabase client
- ✅ `public/auth.html` - Login/Signup sayfası
- ✅ `public/host.html` - Auth kontrolü eklendi
- ✅ `supabase-auth-setup.sql` - SQL güncellemeleri

### 2. Özellikler

#### 🎯 Soft Auth Yaklaşımı
- **Guest Mode**: Login olmadan quiz oynayabilir (geçici)
- **Logged In Mode**: Quiz oluştur, kaydet, tekrar kullan

#### 📱 Kullanıcı Akışı

**Guest (Anonim):**
```
/ → Host → Quiz seç veya oluştur → Oynat (kayıt yok)
```

**Logged In:**
```
/ → Host → [Login istemi] → auth.html → Login → Host
→ Kendi quizlerini gör
→ Quiz oluştur ve KAYDET
→ Tekrar kullan
```

---

## 🚀 Kurulum Adımları

### 1. Supabase SQL Güncellemeleri

Supabase Dashboard'a git:
1. **SQL Editor** sekmesini aç
2. `supabase-auth-setup.sql` dosyasındaki SQL'i kopyala
3. "Run" butonuna tıkla

**Veya manuel olarak:**

```sql
-- UPDATE policy ekle
CREATE POLICY "Users can update own quizzes" 
ON quizzes FOR UPDATE 
USING (auth.uid() = user_id);

-- DELETE policy ekle
CREATE POLICY "Users can delete own quizzes" 
ON quizzes FOR DELETE 
USING (auth.uid() = user_id);
```

### 2. Supabase Auth Ayarları

Dashboard → Authentication → Settings:

1. **Email Auth**
   - ✅ Enable email provider
   - ✅ Confirm email: OFF (development için)
   - ✅ Auto-confirm users: ON

2. **Site URL** (Production için)
   - `http://localhost:3000` (development)
   - Production URL'inizi ekleyin

3. **Redirect URLs**
   - `http://localhost:3000/host.html`
   - Production URL'inizi ekleyin

---

## 🧪 Test Etme

### 1. Guest Olarak Test
```bash
npm start
# Tarayıcı: http://localhost:3000
# Host → Continue as Guest
# Quiz oluştur (kaydedilmez)
```

### 2. Logged In Test
```bash
# Tarayıcı: http://localhost:3000/auth.html
# Sign Up ile hesap oluştur
# Otomatik host.html'e yönlendirilir
# "My Quizzes" bölümünü gör
# Quiz oluştur ve kaydet
```

---

## 📁 Dosya Yapısı

```
public/
├── index.html           # Ana sayfa (değişmedi)
├── auth.html            # ✨ YENİ - Login/Signup
├── host.html            # 🔄 Güncellendi - Auth kontrolü
├── player.html          # (değişmedi)
└── supabase-client.js   # ✨ YENİ - Ortak Supabase client
```

---

## 🎨 UI Değişiklikleri (host.html)

### Guest Mode
```
┌────────────────────────────────┐
│ 🎯 Hohohoot Host               │
│                                │
│ 🔐 Login to save your quizzes │
│      [Login / Sign Up]         │
├────────────────────────────────┤
│ 📚 Public Quizzes              │
│  └─ BİL499 Network →           │
│                                │
│ [✏️ Create Quiz (Not Saved)]  │
└────────────────────────────────┘
```

### Logged In Mode
```
┌────────────────────────────────┐
│ 🎯 Hohohoot Host               │
│ 👤 user@email.com   [Logout]   │
├────────────────────────────────┤
│ 👤 MY QUIZZES                  │
│  └─ My Custom Quiz →           │
│                                │
│ 📚 PUBLIC QUIZZES              │
│  └─ BİL499 Network →           │
│                                │
│ [✏️ Create & Save New Quiz]   │
└────────────────────────────────┘
```

---

## 🔧 Teknik Detaylar

### Auth State Kontrolü
```javascript
// Her sayfa yüklendiğinde
const user = await getCurrentUser();

if (user) {
  // Logged in - show user features
  loadMyQuizzes(user.id);
} else {
  // Guest - limited features
  showLoginPrompt();
}
```

### Quiz Kaydetme
```javascript
// Logged in user
const { data } = await supabase
  .from('quizzes')
  .insert({
    user_id: currentUser.id,
    title: title,
    questions: questions
  });

// Guest user
socket.emit('host-create-game', { 
  questions: questions // Sadece session için
});
```

---

## ⚙️ Supabase Anon Key

`public/supabase-client.js` dosyasında kullanılan key:

```javascript
const SUPABASE_ANON_KEY = 'eyJhbGc...' // Anon/Public key (güvenli)
```

⚠️ **NOT:** Bu key public tarafta kullanılabilir, RLS kuralları güvenliği sağlar.

---

## 🐛 Sorun Giderme

### "Invalid API key" hatası
✅ Çözüm: Supabase Dashboard → Settings → API → Anon key'i kopyala

### "Row Level Security" hatası
✅ Çözüm: `supabase-auth-setup.sql` dosyasını çalıştır

### Email confirmation bekliyor
✅ Çözüm: Auth Settings → Auto-confirm users: ON

### Quiz kaydedilmiyor
✅ Kontrol: `quizzes` tablosunda `user_id` kolonu var mı?
✅ Kontrol: INSERT policy ayarlandı mı?

---

## 🎉 Başarılı!

Auth entegrasyonu tamamlandı. Artık:
- ✅ Guest olarak hızlıca test edebilirsin
- ✅ Login yaparak quiz kaydedebilirsin
- ✅ Kendi quizlerini yönetebilirsin
- ✅ Player deneyimi değişmedi (hala basit)

---

## 📚 İleride Eklenebilecekler

- 🗑️ Quiz silme butonu (My Quizzes'de)
- ✏️ Quiz düzenleme sayfası
- 📊 Oyun istatistikleri (kaç kez oynandı)
- 👥 Quiz'i başkalarıyla paylaşma (public/private toggle)
- 🔗 OAuth providers (Google, GitHub)
- 🔐 Magic Link (passwordless login)
