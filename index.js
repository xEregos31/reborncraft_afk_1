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
  targetUser: 'xEregos' // Komutları atan ana hesap
};

let bot = null;
let jumpInterval = null;
let homeInterval = null;
let isConnecting = false;
let bekleyenTakas = false;

// Zamanlayıcıları temizleme
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

// Bekletme (Delay) Yardımcısı
const bekle = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
    version: false,
    viewDistance: 'tiny',
    checkTimeoutInterval: 120 * 1000,
    physicsEnabled: true
  });

  let ilkGiris = true;

  // SPAWN (Dünyaya Giriş)
  bot.on('spawn', () => {
    console.log('[BOT]: Bot oyuna yüklendi (Spawn).');

    if (ilkGiris) {
      ilkGiris = false;

      // 1. ADIM: Otomatik Login
      setTimeout(() => {
        console.log('[BOT]: /login komutu gönderiliyor...');
        komutGonder(`/login ${CONFIG.password}`);
      }, 3000);

      // 2. ADIM: Skyblock Geçişi
      setTimeout(() => {
        console.log('[BOT]: /skyblock komutu gönderiliyor...');
        komutGonder('/skyblock');
      }, 8000);

      // 3. ADIM: Adaya Geçiş
      setTimeout(() => {
        console.log('[BOT]: /home komutu gönderiliyor...');
        komutGonder('/home');
      }, 16000);

      // AFK Zıplaması (30s)
      jumpInterval = setInterval(() => {
        if (bot && bot.entity) {
          console.log('[BOT]: AFK zıplaması yapılıyor...');
          bot.setControlState('jump', true);
          setTimeout(() => {
            if (bot && bot.entity) bot.setControlState('jump', false);
          }, 500);
        }
      }, 30000);

      // Periyodik Ada Emniyeti (10dk)
      homeInterval = setInterval(() => {
        if (bot && bot.entity) {
          console.log('[BOT]: Periyodik /home atılıyor...');
          komutGonder('/home');
        }
      }, 10 * 60 * 1000);
    }
  });

  // ==========================================
  // 4. OTOMATİK TAKAS VE MENÜ YÖNETİMİ
  // ==========================================
  bot.on('windowOpen', async (window) => {
    console.log('[BOT]: Bir menü/pencere açıldı.');

    // Takas penceresi algılama
    if (bekleyenTakas || (window.title && window.title.includes('Takas'))) {
      bekleyenTakas = false;
      console.log('[BOT]: Takas menüsü tespit edildi! Envanter boşaltılıyor...');

      await bekle(1000); // Menünün tam yüklenmesini bekle

      // Envanterdeki eşyaları takas penceresine aktar (Shift + Sol Tık)
      const invStart = window.inventoryStart;
      const invEnd = window.inventoryEnd;

      for (let slot = invStart; slot < invEnd; slot++) {
        const item = window.slots[slot];
        if (item) {
          try {
            await bot.clickWindow(slot, 0, 1); // 0: Sol Tık, 1: Shift-Click
            console.log(`[BOT]: ${item.displayName} takas alanına koyuldu.`);
            await bekle(250); // Sunucu korumasına takılmamak için hafif bekleme
          } catch (err) {
            console.log('[HATA]: Eşya aktarılırken hata oluştu:', err.message);
          }
        }
      }

      await bekle(1000);

      // Soldaki Kırmızı Onay Butonuna Basma (Slot 39)
      let confirmSlot = 39; // Görseldeki soldaki kırmızı butonun slot indeksi

      // Dinamik kontrol: 36-44 arası kırmızı materyal arayalım
      for (let s = 36; s <= 44; s++) {
        const item = window.slots[s];
        if (item && (item.name.includes('red') || item.name.includes('kirmizi') || item.name.includes('dye') || item.name.includes('wool') || item.name.includes('concrete'))) {
          confirmSlot = s;
          break;
        }
      }

      try {
        console.log(`[BOT]: Kırmızı onay butonuna (${confirmSlot}. slot) basılıyor...`);
        await bot.clickWindow(confirmSlot, 0, 0); // Normal Sol Tık
        console.log('[BOT]: Takas onaylandı!');
      } catch (err) {
        console.log('[HATA]: Onay butonuna basılamadı:', err.message);
      }
    }
  });

  // SUNUCU MESAJLARINI DİNLEME
  bot.on('message', (jsonMsg) => {
    const mesaj = jsonMsg.toString().trim();
    if (!mesaj) return;

    console.log(`[SUNUCU]: ${mesaj}`);
    const kucukMesaj = mesaj.toLowerCase();

    // 1. Şifre İsteme Mesajı
    if (kucukMesaj.includes('/login') || kucukMesaj.includes('giriş yapın') || kucukMesaj.includes('sifre')) {
      setTimeout(() => {
        komutGonder(`/login ${CONFIG.password}`);
      }, 1000);
    }

    // 2. /msg ile "isinlan" Komutu
    if (
      (kucukMesaj.includes('isinlan') || kucukMesaj.includes('ışınlan')) &&
      (kucukMesaj.includes('fısıldı') || kucukMesaj.includes('msg') || kucukMesaj.includes('size') || kucukMesaj.includes('->'))
    ) {
      console.log(`[BOT]: Işınlanma talebi alındı! /tpa ${CONFIG.targetUser} gönderiliyor...`);
      setTimeout(() => {
        komutGonder(`/tpa ${CONFIG.targetUser}`);
      }, 1500);
    }

    // 3. /msg ile "takas" Komutu
    if (
      kucukMesaj.includes('takas') &&
      (kucukMesaj.includes('fısıldı') || kucukMesaj.includes('msg') || kucukMesaj.includes('size') || kucukMesaj.includes('->'))
    ) {
      console.log(`[BOT]: Takas talebi alındı! /takas ${CONFIG.targetUser} gönderiliyor...`);
      bekleyenTakas = true;
      setTimeout(() => {
        komutGonder(`/takas ${CONFIG.targetUser}`);
      }, 1500);
    }

    // 4. Gelen TPA İsteklerini Kabul Etme
    if (kucukMesaj.includes('tpa') || kucukMesaj.includes('ışınlanma isteği') || kucukMesaj.includes('isinlanma istegi')) {
      console.log('[BOT]: TPA isteği kabul ediliyor (/tpaccept)...');
      setTimeout(() => {
        komutGonder('/tpaccept');
      }, 1500);
    }

    // 5. Lobiye Düşme
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
    console.log('[BOT]: Bağlantı koptu. 15 saniye sonra tekrar bağlanılıyor...');
    isConnecting = false;
    bekleyenTakas = false;
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
