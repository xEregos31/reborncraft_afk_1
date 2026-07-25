const mineflayer = require('mineflayer');
const express = require('express');

// ==========================================
// 1. RENDER WEB SUNUCUSU (Keep-Alive)
// ==========================================
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('xEregos_AFK Botu 7/24 Aktif!');
});

app.listen(PORT, () => {
  console.log(`[WEB]: Web sunucusu ${PORT} portunda sorunsuz başlatıldı.`);
});

// ==========================================
// 2. BOT AYARLARI
// ==========================================
const CONFIG = {
  host: 'play.reborncraft.pw',
  port: 25565,
  username: 'xEregos_AFK',
  password: 'mefe3215',
  targetUser: 'xEregos' // Işınlanılacak ana hesap
};

let bot = null;
let jumpInterval = null;
let homeInterval = null;
let isConnecting = false;

// Zamanlayıcıları temizleme fonksiyonu (Bellek ve çakışma önleyici)
function tumZamanlayicilariTemizle() {
  if (jumpInterval) {
    clearInterval(jumpInterval);
    jumpInterval = null;
  }
  if (homeInterval) {
    clearInterval(homeInterval);
    homeInterval = null;
  }
}

// Güvenli Komut Gönderme
function komutGonder(komut) {
  if (bot && bot._client && typeof bot.chat === 'function') {
    try {
      bot.chat(komut);
    } catch (err) {
      console.log(`[HATA]: Komut gönderilemedi (${komut}):`, err.message);
    }
  }
}

// ==========================================
// 3. BOT MANTIĞI VE BAĞLANTI
// ==========================================
function botuBaslat() {
  if (isConnecting) return;
  isConnecting = true;
  tumZamanlayicilariTemizle();

  console.log('[BOT]: Sunucuya bağlantı kuruluyor...');

  bot = mineflayer.createBot({
    host: CONFIG.host,
    port: CONFIG.port,
    username: CONFIG.username,
    version: false, // Sunucu protokolünü otomatik algılar
    viewDistance: 'tiny',
    checkTimeoutInterval: 120 * 1000,
    physicsEnabled: true
  });

  let ilkGiris = true;

  // SPAWN (Oyuna / Dünya Yüklenmesine Giriş)
  bot.on('spawn', () => {
    console.log('[BOT]: Bot oyuna yüklendi (Spawn).');

    if (ilkGiris) {
      ilkGiris = false;

      // 1. ADIM: Otomatik Login (3. saniye)
      setTimeout(() => {
        console.log('[BOT]: /login komutu gönderiliyor...');
        komutGonder(`/login ${CONFIG.password}`);
      }, 3000);

      // 2. ADIM: Skyblock Sunucusuna Geçiş (8. saniye)
      setTimeout(() => {
        console.log('[BOT]: /skyblock komutu gönderiliyor...');
        komutGonder('/skyblock');
      }, 8000);

      // 3. ADIM: Adaya / Ev Konumuna Geçiş (16. saniye)
      setTimeout(() => {
        console.log('[BOT]: /home komutu gönderiliyor...');
        komutGonder('/home');
      }, 16000);

      // AFK KALMAMA ZIPLAMASI (30 saniyede bir)
      jumpInterval = setInterval(() => {
        if (bot && bot.entity) {
          console.log('[BOT]: AFK zıplaması yapılıyor...');
          bot.setControlState('jump', true);
          setTimeout(() => {
            if (bot && bot.entity) bot.setControlState('jump', false);
          }, 500);
        }
      }, 30000);

      // PERİYODİK ADA EMNİYETİ (10 dakikada bir /home)
      homeInterval = setInterval(() => {
        if (bot && bot.entity) {
          console.log('[BOT]: Periyodik /home atılıyor...');
          komutGonder('/home');
        }
      }, 10 * 60 * 1000);
    }
  });

  // SUNUCU MESAJLARINI DİNLEME
  bot.on('message', (jsonMsg) => {
    const mesaj = jsonMsg.toString().trim();
    if (!mesaj) return;

    console.log(`[SUNUCU]: ${mesaj}`);
    const kucukMesaj = mesaj.toLowerCase();

    // 1. Şifre/Giriş İsteme Mesajı Tespiti
    if (kucukMesaj.includes('/login') || kucukMesaj.includes('giriş yapın') || kucukMesaj.includes('sifre')) {
      setTimeout(() => {
        komutGonder(`/login ${CONFIG.password}`);
      }, 1000);
    }

    // 2. MSG ile "isinlan" veya "ışınlan" komutu geldiğinde sana TPA atar
    if (
      (kucukMesaj.includes('isinlan') || kucukMesaj.includes('ışınlan')) &&
      (kucukMesaj.includes('fısıldı') || kucukMesaj.includes('msg') || kucukMesaj.includes('size') || kucukMesaj.includes('->'))
    ) {
      console.log(`[BOT]: Işınlanma talebi alındı! /tpa ${CONFIG.targetUser} gönderiliyor...`);
      setTimeout(() => {
        komutGonder(`/tpa ${CONFIG.targetUser}`);
      }, 1500);
    }

    // 3. Sana gelen TPA isteklerini otomatik kabul eder
    if (kucukMesaj.includes('tpa') || kucukMesaj.includes('ışınlanma isteği') || kucukMesaj.includes('isinlanma istegi')) {
      console.log('[BOT]: TPA isteği kabul ediliyor (/tpaccept)...');
      setTimeout(() => {
        komutGonder('/tpaccept');
      }, 1500);
    }

    // 4. Lobiye düşme / aktarılma durumu
    if (
      kucukMesaj.includes('lobiye') ||
      kucukMesaj.includes('aktarıldınız') ||
      kucukMesaj.includes('aktarılıyorsunuz') ||
      kucukMesaj.includes('yeniden başlatılıyor')
    ) {
      console.log('[BOT]: Lobiye geçiş saptandı! Tekrar /skyblock ve /home atılıyor...');
      setTimeout(() => komutGonder('/skyblock'), 4000);
      setTimeout(() => komutGonder('/home'), 12000);
    }
  });

  // HATA VE KOPMA YÖNETİMİ
  bot.on('kicked', (reason) => {
    console.log('[BOT]: Sunucudan atıldı. Sebep:', reason);
  });

  bot.on('end', () => {
    console.log('[BOT]: Bağlantı koptu. 15 saniye sonra temiz başlatma yapılacak...');
    isConnecting = false;
    tumZamanlayicilariTemizle();
    bot = null;
    setTimeout(botuBaslat, 15000);
  });

  bot.on('error', (err) => {
    if (err.name === 'PartialReadError' || err.message?.includes('timed out')) return;
    console.log('[HATA]:', err.message);
  });
}

// Botu çalıştır
botuBaslat();
