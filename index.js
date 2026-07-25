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
    }, 3000);

    setTimeout(() => {
      komutGonder('/home');
      console.log('[BOT]: /home atıldı.');
    }, 15000);
  }

  // Sunucu mesajlarını dinleme
  bot.on('message', (jsonMsg) => {
    const mesaj = jsonMsg.toString().trim();
    if (mesaj) console.log(`[SUNUCU]: ${mesaj}`);

    // /msg ile "isinlan" veya "ışınlan" yazıldığında /tpa xEregos gönderme
    const kucukMesaj = mesaj.toLowerCase();
    if (
      (kucukMesaj.includes('isinlan') || kucukMesaj.includes('ışınlan')) &&
      (kucukMesaj.includes('fısıldıyor') || kucukMesaj.includes('msg') || kucukMesaj.includes('size'))
    ) {
      console.log('[BOT]: Işınlanma isteği algılandı! /tpa xEregos atılıyor...');
      setTimeout(() => {
        komutGonder('/tpa xEregos');
      }, 1000);
    }

    // Otomatik TPA Kabul Etme (Gelen istekler için emniyet)
    if (mesaj.includes('tpa') || mesaj.includes('Işınlanma isteği')) {
      setTimeout(() => {
        komutGonder('/tpaccept');
        console.log('[BOT]: TPA isteği kabul edildi!');
      }, 1000);
    }

    // Lobiye düşme kontrolü
    if (
      mesaj.includes('Lobiye') ||
      mesaj.includes('aktarıldınız') ||
      mesaj.includes('Aktarılıyorsunuz') ||
      mesaj.includes('yeniden başlatılıyor') ||
      mesaj.includes('Lütfen giriş komutunu kullanın')
    ) {
      console.log('[BOT]: Lobiye düşüldü, tekrar adaya gidiliyor...');
      adayaDon();
    }
  });

  // Oyuna giriş yapıldığında
  bot.on('spawn', () => {
    console.log('[BOT]: Oyuna bağlantı sağlandı. İşlemler başlatılıyor...');

    // 1. ADIM: Login
    setTimeout(() => {
      komutGonder(`/login ${PASSWORD}`);
      console.log('[BOT]: /login gönderildi.');
    }, 5000);

    // 2. ADIM: Skyblock ve Home
    setTimeout(() => {
      adayaDon();
    }, 10000);

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
