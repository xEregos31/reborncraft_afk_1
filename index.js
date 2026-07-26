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
  targetUser: 'xEregos' // Komut verecek ana hesap
};

let bot = null;
let jumpInterval = null;
let homeInterval = null;
let isConnecting = false;
let tpaCooldown = false;
let isDropping = false;

// Zamanlayıcı Temizliği
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
// 3. PROTOKOL SEVİYESİNDE ENVANTER BOŞALTMA
// ==========================================
async function envanteriYereBosalt() {
  if (!bot || !bot.inventory) return;

  if (isDropping) {
    komutGonder(`/msg ${CONFIG.targetUser} Zaten envanter bosaltiliyor, lutfen bekle!`);
    return;
  }

  isDropping = true;

  try {
    // 1. ADIM: Açık menü varsa kapat (Açık menü varken item atılamaz)
    if (bot.currentWindow) {
      try { bot.closeWindow(bot.currentWindow); } catch (e) {}
      await bekle(500);
    }

    // 2. ADIM: Envanterdeki eşyaları tara
    const items = bot.inventory.items();

    if (!items || items.length === 0) {
      console.log('[BOT]: Envanter tamamen boş.');
      komutGonder(`/msg ${CONFIG.targetUser} Envanterimde hic esya yok, zaten bos!`);
      isDropping = false;
      return;
    }

    console.log(`[BOT]: Envanterde ${items.length} slot eşya tespit edildi. Atılıyor...`);
    komutGonder(`/msg ${CONFIG.targetUser} Envanter bosaltiliyor (${items.length} slot var)...`);

    // 3. ADIM: Eşyaları ham Ctrl+Q paketi ile fırlat
    for (const item of items) {
      try {
        // Mode 4, Button 1 = Minecraft Protokolünde Ctrl+Q (Slottaki grubun tamamını at)
        await bot.clickWindow(item.slot, 1, 4);
        console.log(`[BOT]: Slot ${item.slot} (${item.displayName || item.name}) yere atıldı.`);
      } catch (err1) {
        // Paket reddedilirse alternatif olarak tossStack dene
        try {
          await bot.tossStack(item);
        } catch (err2) {
          console.log(`[HATA]: Slot ${item.slot} atılamadı:`, err2.message);
        }
      }
      await bekle(300); // Anti-cheat takılmaması için ideal gecikme
    }

    console.log('[BOT]: Envanter boşaltma tamamlandı!');
    komutGonder(`/msg ${CONFIG.targetUser} Envanter tamamen bosaltildi!`);

  } catch (err) {
    console.log('[HATA]: Envanter boşaltma genel hatası:', err.message);
  } finally {
    isDropping = false;
  }
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

  // SPAWN
  bot.on('spawn', () => {
    console.log('[BOT]: Bot oyuna yüklendi (Spawn).');

    if (ilkGiris) {
      ilkGiris = false;

      // Login
      setTimeout(() => komutGonder(`/login ${CONFIG.password}`), 3000);

      // Skyblock
      setTimeout(() => komutGonder('/skyblock'), 8000);

      // Ada Home
      setTimeout(() => komutGonder('/home'), 16000);

      // AFK Zıplama
      jumpInterval = setInterval(() => {
        if (bot && bot.entity) {
          bot.setControlState('jump', true);
          setTimeout(() => { if (bot && bot.entity) bot.setControlState('jump', false); }, 500);
        }
      }, 30000);

      // Periyodik Home
      homeInterval = setInterval(() => {
        if (bot && bot.entity) komutGonder('/home');
      }, 10 * 60 * 1000);
    }
  });

  // ==========================================
  // 5. FISILTI VE MESAJ DİNLENMESİ (Çift Katmanlı)
  // ==========================================
  
  // KATMAN 1: Özel Fısıltı Modülü (Standart /msg yakalayıcı)
  bot.on('whisper', (username, message) => {
    console.log(`[FISILTI]: ${username} -> ${message}`);
    if (username.toLowerCase() === CONFIG.targetUser.toLowerCase()) {
      const msg = message.toLowerCase();
      if (msg.includes('drop') || msg.includes('bosalt') || msg.includes('at') || msg.includes('envanter')) {
        envanteriYereBosalt();
      } else if (msg.includes('isinlan')) {
        if (!tpaCooldown) {
          tpaCooldown = true;
          komutGonder(`/tpa ${CONFIG.targetUser}`);
          setTimeout(() => { tpaCooldown = false; }, 15000);
        }
      }
    }
  });

  // KATMAN 2: Ham Chat Modülü (Özel Sunucu Chat Formatları İçin)
  bot.on('message', (jsonMsg) => {
    const hamMesaj = jsonMsg.toString().trim();
    if (!hamMesaj) return;

    console.log(`[SUNUCU]: ${hamMesaj}`);
    const temiz = hamMesaj.toLowerCase();

    // 1. Şifre İsteme
    if (temiz.includes('/login') || temiz.includes('giris yapin') || temiz.includes('sifre')) {
      setTimeout(() => komutGonder(`/login ${CONFIG.password}`), 1000);
    }

    const hedefAitMi = temiz.includes(CONFIG.targetUser.toLowerCase());

    // 2. ENVANTER BOŞALTMA KOMUTU
    if (hedefAitMi && (temiz.includes('drop') || temiz.includes('bosalt') || temiz.includes('envanter') || temiz.includes('at'))) {
      if (!temiz.includes('temizlendi') && !temiz.includes('silindi') && !temiz.includes('bosaltildi')) {
        envanteriYereBosalt();
      }
    }

    // 3. IŞINLANMA TETİKLEYİCİSİ
    if (hedefAitMi && temiz.includes('isinlan')) {
      const sistemMesaji =
        temiz.includes('gonderildi') ||
        temiz.includes('kabul') ||
        temiz.includes('saniye') ||
        temiz.includes('bekle') ||
        temiz.includes('isinlaniyor') ||
        temiz.includes('isinlandiniz');

      if (!sistemMesaji && !tpaCooldown) {
        tpaCooldown = true;
        komutGonder(`/tpa ${CONFIG.targetUser}`);
        setTimeout(() => { tpaCooldown = false; }, 15000);
      }
    }

    // 4. GELEN TPA İSTEKLERİNİ KABUL ETME
    if (temiz.includes('tpa') || temiz.includes('isinlanma istegi')) {
      if (!temiz.includes('gonderildi') && !temiz.includes('kabul edildi')) {
        setTimeout(() => komutGonder('/tpaccept'), 1000);
      }
    }

    // 5. LOBİYE DÜŞME
    if (temiz.includes('lobiye') || temiz.includes('aktarildiniz') || temiz.includes('yeniden baslatiliyor')) {
      setTimeout(() => komutGonder('/skyblock'), 4000);
      setTimeout(() => komutGonder('/home'), 12000);
    }
  });

  // KOPMA YÖNETİMİ
  bot.on('kicked', (reason) => console.log('[BOT]: Kicked:', reason));
  bot.on('end', () => {
    console.log('[BOT]: Bağlantı koptu. 15 sn sonra tekrar bağlanıyor...');
    isConnecting = false;
    tpaCooldown = false;
    isDropping = false;
    tumZamanlayicilariTemizle();
    bot = null;
    setTimeout(botuBaslat, 15000);
  });
  bot.on('error', (err) => {
    if (err.name === 'PartialReadError' || err.message?.includes('timed out')) return;
    console.log('[HATA]:', err.message);
  });
}

botuBaslat();
