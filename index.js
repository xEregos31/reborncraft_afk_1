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
  targetUser: 'xEregos' // Ana hesap
};

let bot = null;
let jumpInterval = null;
let homeInterval = null;
let isConnecting = false;
let tpaCooldown = false; // TPA spamını önlemek için koruma

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

// Bekletme Yardımcısı
const bekle = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ==========================================
// 3. ENVANTER BOŞALTMA MANTIĞI (Ctrl+Q Mantığı)
// ==========================================
async function envanteriYereBosalt() {
  if (!bot || !bot.inventory) return;

  const items = bot.inventory.items();
  if (items.length === 0) {
    console.log('[BOT]: Envanterde atılacak eşya bulunamadı (Envanter boş).');
    return;
  }

  console.log(`[BOT]: Envanter boşaltılıyor... Toplam ${items.length} slot eşya atılacak.`);

  for (const item of items) {
    try {
      // tossStack = Slottaki tüm eşyayı yere atar (Ctrl+Q ile aynı işlem)
      await bot.tossStack(item);
      console.log(`[BOT]: ${item.displayName || item.name} yere atıldı.`);
      await bekle(300); // Sunucudan kick yememek için kısa gecikme
    } catch (err) {
      console.log('[HATA]: Eşya atılırken sorun oluştu:', err.message);
    }
  }

  console.log('[BOT]: Envanter tamamen boşaltıldı!');
}

// ==========================================
// 4. BOT MANTIĞI VE BAĞLANTI
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
  // 5. SUNUCU MESAJLARINI DİNLEME
  // ==========================================
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

    // 2. ENVANTER BOŞALT TALEBİ ("bosalt", "boşalt", "at", "envanter")
    if (
      kucukMesaj.includes('bosalt') ||
      kucukMesaj.includes('boşalt') ||
      (kucukMesaj.includes('envanter') && kucukMesaj.includes('at'))
    ) {
      if (!kucukMesaj.includes('temizlendi') && !kucukMesaj.includes('silindi')) {
        console.log('[BOT]: Envanter boşaltma komutu algılandı!');
        envanteriYereBosalt();
      }
    }

    // 3. IŞINLANMA TETİKLEYİCİSİ (Spam Engelleyici Filtreli)
    if (kucukMesaj.includes('isinlan') || kucukMesaj.includes('ışınlan')) {
      // Sunucu sistem mesajlarını filtrele (Döngüyü kıran kısım)
      const sistemMesajiMi =
        kucukMesaj.includes('gönderildi') ||
        kucukMesaj.includes('kabul') ||
        kucukMesaj.includes('saniye') ||
        kucukMesaj.includes('bekle') ||
        kucukMesaj.includes('ışınlanıyor') ||
        kucukMesaj.includes('ışınlandınız') ||
        kucukMesaj.includes('istek');

      if (!sistemMesajiMi && !tpaCooldown) {
        console.log(`[BOT]: Işınlanma talebi algılandı! /tpa ${CONFIG.targetUser} gönderiliyor...`);
        tpaCooldown = true;
        komutGonder(`/tpa ${CONFIG.targetUser}`);

        // 15 saniye boyunca yeni TPA atmasını engeller (Spam Koruması)
        setTimeout(() => {
          tpaCooldown = false;
        }, 15000);
      }
    }

    // 4. GELEN TPA İSTEKLERİNİ KABUL ETME
    if (kucukMesaj.includes('tpa') || kucukMesaj.includes('ışınlanma isteği') || kucukMesaj.includes('isinlanma istegi')) {
      if (!kucukMesaj.includes('gönderildi') && !kucukMesaj.includes('kabul edildi')) {
        console.log('[BOT]: TPA isteği kabul ediliyor (/tpaccept)...');
        setTimeout(() => {
          komutGonder('/tpaccept');
        }, 1000);
      }
    }

    // 5. LOBİYE DÜŞME KONTROLÜ
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
    tpaCooldown = false;
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
