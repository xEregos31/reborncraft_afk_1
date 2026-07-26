const mineflayer = require('mineflayer');
const express = require('express');
const vec3 = require('vec3'); // İnşaat konum hesaplamaları için gerekli

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
let isExecutingCustom = false;
let isBuilding = false; // İnşaat durum takibi

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

// Anti-Bot Koruma Yürüyüşü (2 Blok İleri)
async function antiBotHareketi() {
  if (!bot || !bot.entity) return;
  console.log('[BOT]: Anti-Bot engeli için hareket ediliyor...');
  bot.setControlState('jump', true);
  bot.setControlState('forward', true);
  await bekle(1200);
  bot.setControlState('forward', false);
  bot.setControlState('jump', false);
  await bekle(500); // Sunucunun konumu işlemesi için bekleme
}

// ==========================================
// 3. ENVANTER ARAMA & OTO-İNŞAAT MODÜLÜ (3'ü 1 Arada + Shift Koruma)
// ==========================================
function envanterdeBul(isim) {
  if (!bot || !bot.inventory) return null;
  return bot.inventory.items().find(item => 
    item.name.toLowerCase().includes(isim) || 
    (item.displayName && item.displayName.toLowerCase().includes(isim))
  );
}

// Tek Turda: Kaktüs -> İp -> Üst Katın Kumu
async function kaktusIpKumInsaEt(x1, y1, z1, x2, y2, z2) {
  if (isBuilding) {
    console.log('[BOT]: Zaten aktif bir inşaat işlemi yürütülüyor!');
    return;
  }

  isBuilding = true;
  console.log(`[İNŞAAT]: Tek geçişli 3'lü dizilim başlatıldı! Alan: (${x1}, ${y1}, ${z1}) -> (${x2}, ${y2}, ${z2})`);

  // İnşaat boyunca kaktüslere/boşluğa düşmeyi önlemek için SHIFT'e basılı tut
  if (bot && bot.entity) {
    bot.setControlState('sneak', true);
    console.log('[İNŞAAT]: Düşmeyi önlemek için Shift (Sneak) aktif edildi.');
  }

  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  const minZ = Math.min(z1, z2);
  const maxZ = Math.max(z1, z2);
  const baslangicY = y1; // Tabandaki kumların bulunduğu Y seviyesi

  let tamamlananNokta = 0;

  try {
    for (let x = minX; x <= maxX; x++) {
      for (let z = minZ; z <= maxZ; z++) {

        // Satranç Tahtası (Çapraz) Düzeni
        if ((x + z) % 2 !== 0) continue;

        // Malzeme Kontrolleri
        const kaktus = envanterdeBul('cactus') || envanterdeBul('kaktus');
        const ip = envanterdeBul('string') || envanterdeBul('ip');
        const kum = envanterdeBul('sand') || envanterdeBul('kum');

        if (!kaktus || !ip || !kum) {
          console.log('[İNŞAAT HATA]: Envanterde Kaktüs, İp veya Kum eksik! İnşaat durduruldu.');
          break;
        }

        // 1. ADIM: KAKTÜS (Tabandaki Kumun Üstüne)
        const kumPos = vec3(x, baslangicY, z);
        const kumBlock = bot.blockAt(kumPos);
        if (kumBlock) {
          if (bot.entity) await bot.lookAt(kumPos);
          await bot.equip(kaktus, 'hand');
          await bot.placeBlock(kumBlock, vec3(0, 1, 0));
          await bekle(150);
        }

        // 2. ADIM: İP (Kaktüsün Üstüne)
        const kaktusPos = vec3(x, baslangicY + 1, z);
        const kaktusBlock = bot.blockAt(kaktusPos);
        if (kaktusBlock) {
          if (bot.entity) await bot.lookAt(kaktusPos);
          await bot.equip(ip, 'hand');
          await bot.placeBlock(kaktusBlock, vec3(0, 1, 0));
          await bekle(150);
        }

        // 3. ADIM: YENİ KUM (İpin Üstüne)
        const ipPos = vec3(x, baslangicY + 2, z);
        const ipBlock = bot.blockAt(ipPos);
        if (ipBlock) {
          if (bot.entity) await bot.lookAt(ipPos);
          await bot.equip(kum, 'hand');
          await bot.placeBlock(ipBlock, vec3(0, 1, 0));
          await bekle(150);
        }

        tamamlananNokta++;
        await bekle(200); // Sunucu kick/lag koruması
      }
    }

    console.log(`[İNŞAAT]: Kat başarıyla tamamlandı! Toplam ${tamamlananNokta} noktaya Kaktüs + İp + Kum koyuldu.`);

  } catch (err) {
    console.log('[HATA]: İnşaat sırasında hata oluştu:', err.message);
  } finally {
    isBuilding = false;

    // İnşaat bitince Shift'i bırak
    if (bot && bot.entity) {
      bot.setControlState('sneak', false);
      console.log('[İNŞAAT]: İnşaat bitti, Shift bırakıldı.');
    }

    // Anti-bot adımı atıp /home çek
    await antiBotHareketi();
    komutGonder('/home');
    console.log('[BOT]: /home çekildi.');
  }
}

// ==========================================
// 4. ÖZEL DİNAMİK KOMUT YÜRÜTÜCÜ
// ==========================================
async function noktaliKomutCalistir(komutMetni) {
  if (!bot || !komutMetni) return;
  if (isExecutingCustom) return;

  isExecutingCustom = true;

  try {
    console.log(`[BOT]: Noktalı komut algılandı: "${komutMetni}". Hareket ediliyor...`);
    
    // 1. ADIM: Anti-bot yürüyüşünü yap
    await antiBotHareketi();

    // 2. ADIM: Doğrudan genel chate yaz / komutu çalıştır
    komutGonder(komutMetni);
    console.log(`[BOT]: Genel chate yazıldı/komut çalıştırıldı: "${komutMetni}"`);

  } catch (err) {
    console.log('[HATA]: Dinamik komut hatası:', err.message);
  } finally {
    isExecutingCustom = false;
  }
}

// ==========================================
// 5. ENVANTER BOŞALTMA MANTIĞI
// ==========================================
async function envanteriYereBosalt() {
  if (!bot || !bot.inventory) return;

  if (isDropping) return;

  isDropping = true;

  try {
    if (bot.currentWindow) {
      try { bot.closeWindow(bot.currentWindow); } catch (e) {}
      await bekle(500);
    }

    await antiBotHareketi();

    const skippedSlots = new Set();
    let droppedCount = 0;

    while (true) {
      const currentItems = bot.inventory.items().filter(item => !skippedSlots.has(item.slot));

      if (currentItems.length === 0) break;

      const item = currentItems[0];
      console.log(`[BOT]: Slot ${item.slot} (${item.displayName || item.name}) atılıyor...`);

      try {
        if (bot.entity) {
          await bot.look(bot.entity.yaw, 0, true);
        }

        await bot.tossStack(item);
        droppedCount++;
        console.log(`[BOT]: ${item.displayName || item.name} başarıyla atıldı.`);
      } catch (err) {
        console.log(`[HATA]: Slot ${item.slot} (${item.name}) atılamadı, atlanıyor. Sebep:`, err.message);
        skippedSlots.add(item.slot);
      }

      await bekle(400);
    }

    if (droppedCount > 0) {
      console.log(`[BOT]: Toplam ${droppedCount} slot eşya atıldı!`);
    } else {
      console.log('[BOT]: Atılabilecek eşya bulunamadı.');
    }

  } catch (err) {
    console.log('[HATA]: Envanter boşaltma genel hatası:', err.message);
  } finally {
    isDropping = false;
  }
}

// ==========================================
// 6. BOT MANTIĞI VE BAĞLANTI
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

      // 1. AŞAMA: Giriş Komutları
      setTimeout(() => komutGonder(`/login ${CONFIG.password}`), 3000);
      setTimeout(() => komutGonder('/skyblock'), 8000);
      setTimeout(() => komutGonder('/home'), 16000);

      // 2. AŞAMA: Texture Yükleme & 240 Sn Bekleme
      setTimeout(() => {
        console.log('[BOT]: /farmtexture komutu gönderiliyor...');
        komutGonder('/farmtexture');
      }, 20000);

      // 20. saniyeden itibaren 240 saniye (4 dk) bekle = 260. saniyede bildirim at
      setTimeout(() => {
        console.log('[BOT]: Texture bekleme süresi doldu. Bildirim gönderiliyor...');
        komutGonder(`/msg ${CONFIG.targetUser} Hazirim Efendim`);
      }, 260000);

      // AFK Zıplama
      jumpInterval = setInterval(() => {
        if (bot && bot.entity) {
          bot.setControlState('jump', true);
          setTimeout(() => { if (bot && bot.entity) bot.setControlState('jump', false); }, 500);
        }
      }, 30000);

      // Periyodik Home (İnşaat yapmıyorsa)
      homeInterval = setInterval(() => {
        if (bot && bot.entity && !isBuilding) komutGonder('/home');
      }, 10 * 60 * 1000);
    }
  });

  // EKRAN PENCERELERİ (GUI) GELDİĞİNDE HAREKETLERİ DONDUR
  bot.on('windowOpen', (window) => {
    console.log(`[BİLGİ]: Ekrana bir menü/pencere geldi ("${window.title}"). Hareketler durduruldu.`);
    if (bot && bot.entity) {
      bot.clearControlStates();
    }
  });

  // ==========================================
  // 7. FISILTI VE MESAJ DİNLENMESİ
  // ==========================================
  
  // KATMAN 1: Özel Fısıltı Modülü
  bot.on('whisper', (username, message) => {
    console.log(`[FISILTI]: ${username} -> ${message}`);
    if (username.toLowerCase() === CONFIG.targetUser.toLowerCase()) {
      const msg = message.trim().toLowerCase();

      // 1. OYUNDAN ÇIKIŞ KOMUTU (/msg xEregos_AFK oyundan cik)
      if (msg.includes('oyundan cik') || msg.includes('oyundan çık') || msg === 'cik' || msg === 'çık' || msg === '.quit') {
        console.log('[BOT]: Çıkış komutu algılandı! Oyundan çıkılıyor...');
        tumZamanlayicilariTemizle();
        isConnecting = false;
        bot.quit('Eregos tarafından verilen komut ile oyundan çıkıldı.');
        return;
      }

      // 2. INSAAT KOMUTU: .insa X1 Y1 Z1 X2 Y2 Z2
      const insaMatch = message.trim().match(/^\.insa\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)/i);
      if (insaMatch) {
        const [, x1, y1, z1, x2, y2, z2] = insaMatch.map(Number);
        kaktusIpKumInsaEt(x1, y1, z1, x2, y2, z2);
        return;
      }

      // 3. NOKTALI DINAMIK KOMUT KONTROLÜ
      if (message.trim().startsWith('.')) {
        const komut = message.trim().substring(1).trim();
        noktaliKomutCalistir(komut);
        return;
      }
      
      // 4. ENVANTER BOŞALTMA & IŞINLANMA
      if (msg.includes('drop') || msg.includes('bosalt') || msg.includes('at')) {
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

  // KATMAN 2: Ham Chat Modülü
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

    if (hedefAitMi) {
      // INSAAT KOMUTU ALGISI (Genel Chat Üzerinden)
      const insaMatch = hamMesaj.match(/\.insa\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)/i);
      if (insaMatch) {
        const [, x1, y1, z1, x2, y2, z2] = insaMatch.map(Number);
        kaktusIpKumInsaEt(x1, y1, z1, x2, y2, z2);
        return;
      }

      // HAM CHAT NOKTALI KOMUT YAKALAYICI (Örn: .selam)
      const noktaliEsllesme = hamMesaj.match(new RegExp(`${CONFIG.targetUser}.*?[»>:]\\s*\\.(.+)`, 'i'));
      if (noktaliEsllesme && noktaliEsllesme[1] && !noktaliEsllesme[1].startsWith('insa')) {
        const komut = noktaliEsllesme[1].trim();
        noktaliKomutCalistir(komut);
        return;
      }
    }

    // ENVANTER BOŞALTMA KOMUTU
    if (hedefAitMi && (temiz.includes('drop') || temiz.includes('bosalt') || temiz.includes('at'))) {
      if (!temiz.includes('temizlendi') && !temiz.includes('silindi') && !temiz.includes('bosaltildi')) {
        envanteriYereBosalt();
      }
    }

    // IŞINLANMA TETİKLEYİCİSİ
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

    // GELEN TPA İSTEKLERİNİ KABUL ETME
    if (temiz.includes('tpa') || temiz.includes('isinlanma istegi')) {
      if (!temiz.includes('gonderildi') && !temiz.includes('kabul edildi')) {
        setTimeout(() => komutGonder('/tpaccept'), 1000);
      }
    }

    // LOBİYE DÜŞME
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
    isExecutingCustom = false;
    isBuilding = false;
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
