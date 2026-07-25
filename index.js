const mineflayer = require('mineflayer');
const express = require('express');

// Render'ın kapanmaması için basit web sunucusu
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
    version: '1.21.6',
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

  // Adaya ve evine dönme
  function adayaDon() {
    console.log('[BOT]: Adaya dönülüyor (/skyblock -> /home)...');
    setTimeout(() => komutGonder('/skyblock'), 2000);
    setTimeout(() => komutGonder('/home'), 12000);
  }

  // Sunucu mesajlarını dinleme
  bot.on('message', (jsonMsg) => {
    const mesaj = jsonMsg.toString().trim();
    if (mesaj) console.log(`[SUNUCU]: ${mesaj}`);

    if (
      mesaj.includes('Lobiye') ||
      mesaj.includes('aktarıldınız') ||
      mesaj.includes('Aktarılıyorsunuz') ||
      mesaj.includes('yeniden başlatılıyor') ||
      mesaj.includes('Lütfen giriş komutunu kullanın')
    ) {
      console.log('[BOT]: Lobiye düşüldü veya aktarıldı, tekrar adaya gidiliyor...');
      adayaDon();
    }
  });

  // Oyuna giriş yapıldığında
  bot.on('spawn', () => {
    console.log('[BOT]: Oyuna başarıyla girildi.');

    // 1. Login yap
    setTimeout(() => {
      komutGonder(`/login ${PASSWORD}`);
      console.log('[BOT]: /login komutu gönderildi.');
    }, 4000);

    // 2. Skyblock ve Home komutları
    setTimeout(() => {
      adayaDon();
    }, 8000);

    // AFK kalmamak için zıplama (40 saniyede bir)
    if (ziplamaInterval) clearInterval(ziplamaInterval);
    ziplamaInterval = setInterval(() => {
      if (bot && bot.entity) {
        console.log('[BOT]: AFK zıplaması yapılıyor...');
        bot.setControlState('jump', true);
        setTimeout(() => {
          if (bot && bot.entity) bot.setControlState('jump', false);
        }, 500);
      }
    }, 40000);

    // Periyodik olarak 15 dakikada bir /home çek
    if (kontrolInterval) clearInterval(kontrolInterval);
    kontrolInterval = setInterval(() => {
      if (bot && bot.entity) {
        console.log('[BOT]: Periyodik /home atılıyor...');
        komutGonder('/home');
      }
    }, 15 * 60 * 1000);
  });

  // Bağlantı koptuğunda veya atıldığında otomatik tekrar bağlan
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
