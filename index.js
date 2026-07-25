const mineflayer = require('mineflayer');
const express = require('express');

// Render'ın kapanmaması için web sunucusu
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('xEregos_AFK Botu Aktif!');
});

app.listen(PORT, () => {
  console.log(`[WEB]: Web sunucusu ${PORT} portunda çalışıyor.`);
});

// Bot Ayarları
const USERNAME = 'xEregos_AFK';
const PASSWORD = 'mefe3215';
const SERVER_HOST = 'play.reborncraft.pw';
const SERVER_PORT = 25565;

let bot = null;
let ziplamaInterval = null;
let kontrolInterval = null;

function botuBaslat() {
  console.log('[BOT]: Sunucuya bağlanılıyor...');

  bot = mineflayer.createBot({
    host: SERVER_HOST,
    port: SERVER_PORT,
    username: USERNAME,
    version: false, // Sunucu sürümünü otomatik algılasın
    viewDistance: 'tiny',
    checkTimeoutInterval: 120 * 1000,
    physicsEnabled: true
  });

  // Komut gönderme fonksiyonu
  function komutGonder(komut) {
    if (bot && bot._client && typeof bot.chat === 'function') {
      try {
        bot.chat(komut);
      } catch (e) {
        console.log('[HATA]: Komut gönderilemedi:', e.message);
      }
    }
  }

  // Adaya ve evine dönme işlemi
  function adayaDon() {
    console.log('[BOT]: Adaya geçiş başlatılıyor (/skyblock -> /home)...');
    setTimeout(() => {
      komutGonder('/skyblock');
      console.log('[BOT]: /skyblock atıldı.');
    }, 4000);

    setTimeout(() => {
      komutGonder('/home');
      console.log('[BOT]: /home atıldı.');
    }, 12000);
  }

  // Sunucu mesajlarını dinleme
  bot.on('message', (jsonMsg) => {
    const mesaj = jsonMsg.toString().trim();
    if (mesaj) console.log(`[SUNUCU]: ${mesaj}`);

    const kucukMesaj = mesaj.toLowerCase();

    // 1. Otomatik Login Yakalayıcı (Giriş yap uyarısı çıkarsa anında girer)
    if (kucukMesaj.includes('/login') || kucukMesaj.includes('giriş yap') || kucukMesaj.includes('şifre')) {
      console.log('[BOT]: Giriş uyarısı algılandı, /login atılıyor...');
      komutGonder(`/login ${PASSWORD}`);
    }

    // 2. /msg ile "isinlan" yazıldığında tpa atma
    if (
      (kucukMesaj.includes('isinlan') || kucukMesaj.includes('ışınlan')) &&
      (kucukMesaj.includes('fısıldıyor') || kucukMesaj.includes('msg') || kucukMesaj.includes('size'))
    ) {
      console.log('[BOT]: Işınlanma isteği algılandı! /tpa xEregos atılıyor...');
      setTimeout(() => {
        komutGonder('/tpa xEregos');
      }, 1000);
    }

    // 3. Otomatik TPA Kabul Etme
    if (mesaj.includes('tpa') || mesaj.includes('Işınlanma isteği')) {
      setTimeout(() => {
        komutGonder('/tpaccept');
        console.log('[BOT]: TPA isteği kabul edildi!');
      }, 1000);
    }

    // 4. Lobiye düşme veya aktarılma kontrolü
    if (
      mesaj.includes('Lobiye') ||
      mesaj.includes('aktarıldınız') ||
      mesaj.includes('Aktarılıyorsunuz') ||
      mesaj.includes('yeniden başlatılıyor')
    ) {
      console.log('[BOT]: Lobiye düşüldü, tekrar adaya gidiliyor...');
      adayaDon();
    }
  });

  // Oyuna giriş yapıldığında (Spawn)
  bot.on('spawn', () => {
    console.log('[BOT]: Bot dünya verisini aldı (Spawn oldu).');

    // Ilk girişte şifre gönder
    setTimeout(() => {
      komutGonder(`/login ${PASSWORD}`);
      console.log('[BOT]: Ilk /login denemesi gönderildi.');
    }, 2000);

    // Skyblock dünyasına geçiş
    setTimeout(() => {
      adayaDon();
    }, 7000);

    // AFK Zıplaması (40 saniyede bir)
    if (ziplamaInterval) clearInterval(ziplamaInterval);
    ziplamaInterval = setInterval(() => {
      if (bot && bot.entity) {
        console.log('[BOT]: AFK zıplaması yapılıyor...');
        bot.setControlState('jump', true);
        setTimeout(() => {
          if (bot && bot.entity) bot.setControlState('jump', false);
        }, 600);
      }
    }, 40000);

    // Periyodik kontrol: 10 dakikada bir /home at
    if (kontrolInterval) clearInterval(kontrolInterval);
    kontrolInterval = setInterval(() => {
      if (bot && bot.entity) {
        console.log('[BOT]: Periyodik /home kontrolü yapılıyor...');
        komutGonder('/home');
      }
    }, 10 * 60 * 1000);
  });

  // Bağlantı kopma durumları
  bot.on('kicked', (reason) => console.log('[BOT]: Atıldı:', reason));

  bot.on('end', () => {
    console.log('[BOT]: Bağlantı koptu. 15 saniye sonra tekrar bağlanılıyor...');
    if (ziplamaInterval) clearInterval(ziplamaInterval);
    if (kontrolInterval) clearInterval(kontrolInterval);
    setTimeout(botuBaslat, 15000);
  });

  bot.on('error', (err) => {
    if (err.name === 'PartialReadError' || err.message?.includes('timed out')) return;
    console.log('[HATA]:', err.message);
  });
}

botuBaslat();
