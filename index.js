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
  targetUser: 'xEregos' // Komutları dinleyeceği ana hesap
};

let bot = null;
let jumpInterval = null;
let homeInterval = null;
let isConnecting = false;
let tpaCooldown = false;
let isDropping = false; // Üst üste eşya atma komutunu engelleme

// Metin Temizleme: Renk kodlarını (§a, §f vs.) siler, Türkçe harfleri dönüştürür
function temizleMetin(metin) {
  return metin
    .replace(/§[0-9a-fk-or]/gi, '') // Minecraft renk kodlarını temizle
    .toLowerCase()
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c');
}

// Zamanlayıcıları Temizleme
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
// 3. GELİŞMİŞ ENVANTER BOŞALTMA MANTIĞI
// ==========================================
async function envanteriYereBosalt() {
  if (!bot || !bot.inventory) return;

  if (isDropping) {
    komutGonder(`/msg ${CONFIG.targetUser} Su an zaten envanter bosaltiliyor, lutfen bekle!`);
    return;
  }

  isDropping = true;

  try {
    // 1. ADIM: Açık olan herhangi bir GUI/Menü varsa kapat
    if (bot.currentWindow) {
      console.log('[BOT]: Açık menü saptandı, kapatılıyor...');
      try {
        bot.closeWindow(bot.currentWindow);
      } catch (e) {}
      await bekle(500);
    }

    // 2. ADIM: Envanterdeki eşyaları tara
    const items = bot.inventory.items();

    if (items.length === 0) {
      console.log('[BOT]: Envanter zaten boş.');
      komutGonder(`/msg ${CONFIG.targetUser} Envanterimde hic esya yok, zaten bos!`);
      isDropping = false;
      return;
    }

    console.log(`[BOT]: Envanter boşaltma başladı... Toplam ${items.length} slot atılacak.`);
    komutGonder(`/msg ${CONFIG.targetUser} Envanter bosaltiliyor (${items.length} slot esya var)...`);

    // 3. ADIM: Eşyaları tek tek yere at (Anti-Cheat korumalı 400ms gecikmeli)
    for (const item of items) {
      try {
        await bot.tossStack(item);
        console.log(`[BOT]: ${item.displayName || item.name} yere atıldı.`);
        await bekle(400); // Sunucunun botu spammeden atmaması için ideal süre
      } catch (err) {
        console.log(`[HATA]: Eşya atılamadı (${item.name}):`, err.message);
      }
    }

    console.log('[BOT]: Envanter tamamen boşaltıldı!');
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
    const hamMesaj = jsonMsg.toString().trim();
    if (!hamMesaj) return;

    console.log(`[SUNUCU]: ${hamMesaj}`);
    
    // Mesajı tamamen temizle (Renkler silinir, Türkçe harfler düzeltilir)
    const temiz = temizleMetin(hamMesaj);

    // 1. Şifre İsteme Mesajı
    if (temiz.includes('/login') || temiz.includes('giris yapin') || temiz.includes('sifre')) {
      setTimeout(() => {
        komutGonder(`/login ${CONFIG.password}`);
      }, 1000);
    }

    // 2. ENVANTER BOŞALTMA KOMUTU
    // Şart: Mesaj senin kullanıcı adını (xEregos) VE 'bosalt' kelimesini içermeli
    const hedefAitMi = temiz.includes(CONFIG.targetUser.toLowerCase());
    const bosaltIstegi = temiz.includes('bosalt') || temiz.includes('envanter');

    if (hedefAitMi && bosaltIstegi) {
      // Sunucunun kendi sistem duyurularını engelle
      if (!temiz.includes('temizlendi') && !temiz.includes('silindi') && !temiz.includes('baslatildi')) {
        console.log('[BOT]: xEregos kullanıcısından envanter boşaltma komutu geldi!');
        envanteriYereBosalt();
      }
    }

    // 3. IŞINLANMA TETİKLEYİCİSİ (Spam Önlemeli)
    if (hedefAitMi && temiz.includes('isinlan')) {
      const sistemMesaji =
        temiz.includes('gonderildi') ||
        temiz.includes('kabul') ||
        temiz.includes('saniye') ||
        temiz.includes('bekle') ||
        temiz.includes('isinlaniyor') ||
        temiz.includes('isinlandiniz');

      if (!sistemMesaji && !tpaCooldown) {
        console.log(`[BOT]: Işınlanma talebi algılandı! /tpa ${CONFIG.targetUser} gönderiliyor...`);
        tpaCooldown = true;
        komutGonder(`/tpa ${CONFIG.targetUser}`);

        // 15 saniye cooldown
        setTimeout(() => {
          tpaCooldown = false;
        }, 15000);
      }
    }

    // 4. GELEN TPA İSTEKLERİNİ KABUL ETME
    if (temiz.includes('tpa') || temiz.includes('isinlanma istegi')) {
      if (!temiz.includes('gonderildi') && !temiz.includes('kabul edildi')) {
        console.log('[BOT]: TPA isteği kabul ediliyor (/tpaccept)...');
        setTimeout(() => {
          komutGonder('/tpaccept');
        }, 1000);
      }
    }

    // 5. LOBİYE DÜŞME KONTROLÜ
    if (
      temiz.includes('lobiye') ||
      temiz.includes('aktarildiniz') ||
      temiz.includes('aktariliyorsunuz') ||
      temiz.includes('yeniden baslatiliyor')
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

// Botu çalıştır
botuBaslat();
