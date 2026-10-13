/* ============================================================
   MARKETPLACE — Dompetku (FB-style)
   Jual/beli barang: harga, deskripsi, foto, kondisi, lokasi.
   Cari di peta (contoh: motor beat) → gambar terdekat.
   ============================================================ */
(function () {
  'use strict';

  var MP_KEY = 'dk_marketplace';
  var DEFAULT_RADIUS_KM = 25;
  var DEFAULT_LAT = -6.175392, DEFAULT_LNG = 106.827153;
  var myLat = DEFAULT_LAT, myLng = DEFAULT_LNG, gpsReady = false;
  var mapMP = null, markersMP = [];

  function rd(k, d) {
    try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; }
  }
  function wr(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {
      alert('Penyimpanan penuh. Hapus listing lama.');
    }
  }
  function getUserId() {
    var s = rd('dk_session', null);
    return s && s.id ? s.id : null;
  }
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function haversineKm(lat1, lon1, lat2, lon2) {
    var R = 6371;
    var dLat = (lat2 - lat1) * Math.PI / 180;
    var dLon = (lon2 - lon1) * Math.PI / 180;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  function fmtRp(n) {
    if (typeof window.dkFmtMoney === 'function') return window.dkFmtMoney(n);
    return 'Rp ' + Number(n || 0).toLocaleString('id-ID');
  }

  function getListings() {
    var list = rd(MP_KEY, []);
    if (!Array.isArray(list) || !list.length) {
      // seed demo once
      list = seedDemo();
      wr(MP_KEY, list);
    }
    return list;
  }
  function saveListings(list) { wr(MP_KEY, list); }

  function seedDemo() {
    return [
      {
        id: 'mp-demo1', sellerId: 'budi44', title: 'Motor Beat 2020',
        price: 12500000, desc: 'Honda Beat CBS 2020, pajak hidup, mesin halus.',
        condition: 'bekas', category: 'kendaraan',
        photos: [], lat: -6.1800, lng: 106.8200, address: 'Jakarta Pusat',
        created: Date.now() - 86400000
      },
      {
        id: 'mp-demo2', sellerId: 'andiservice', title: 'iPhone 12 128GB',
        price: 4500000, desc: 'Fullset, baterai 88%, no minus.',
        condition: 'bekas', category: 'elektronik',
        photos: [], lat: -6.1900, lng: 106.8300, address: 'Jakarta Selatan',
        created: Date.now() - 3600000
      },
      {
        id: 'mp-demo3', sellerId: 'tukanglistrik', title: 'Kursi kayu jati',
        price: 350000, desc: 'Kursi makan kayu jati solid, 1 set 4 kursi.',
        condition: 'baru', category: 'rumah',
        photos: [], lat: -6.1700, lng: 106.8100, address: 'Jakarta Barat',
        created: Date.now() - 7200000
      },
      {
        id: 'mp-demo4', sellerId: 'jokoelektronik', title: 'Motor Beat Street 2019',
        price: 9800000, desc: 'Beat Street, surat lengkap, siap pakai.',
        condition: 'bekas', category: 'kendaraan',
        photos: [], lat: -6.1950, lng: 106.8250, address: 'Jakarta Timur',
        created: Date.now() - 172800000
      }
    ];
  }

  function injectCSS() {
    if (document.getElementById('mp-styles')) return;
    var s = document.createElement('style');
    s.id = 'mp-styles';
    s.textContent = `
      .mp-overlay {
        display:none;position:fixed;inset:0;
        background:rgba(8,8,12,.92);backdrop-filter:blur(8px);
        z-index:99997;justify-content:center;align-items:center;
        padding:16px;box-sizing:border-box;font-family:inherit;color:#F4F4F5;
      }
      .mp-overlay.mp-open{display:flex}
      .mp-modal {
        background:linear-gradient(180deg,#1a1a28,#12121c);
        width:100%;max-width:440px;border-radius:22px;padding:22px;
        position:relative;max-height:92vh;overflow-y:auto;
        box-shadow:0 24px 60px rgba(0,0,0,.65);
        border:1px solid rgba(124,58,237,.3);box-sizing:border-box;
      }
      .mp-close {
        position:absolute;top:12px;right:14px;
        background:rgba(255,255,255,.06);border:none;color:#94a3b8;
        width:34px;height:34px;border-radius:10px;font-size:20px;cursor:pointer;
      }
      .mp-title{text-align:center;margin:0 0 4px;font-size:20px;font-weight:800}
      .mp-sub{text-align:center;color:#8B8B9C;font-size:13px;margin:0 0 14px}
      .mp-tabs{display:flex;gap:6px;margin-bottom:14px}
      .mp-tab{
        flex:1;padding:10px;border:none;border-radius:10px;
        background:rgba(255,255,255,.04);color:#8B8B9C;font-weight:700;
        font-size:12px;cursor:pointer;font-family:inherit;
      }
      .mp-tab.on{background:rgba(124,58,237,.25);color:#c4b5fd}
      .mp-field{margin-bottom:12px}
      .mp-field label{
        display:block;margin-bottom:5px;font-size:11px;color:#8B8B9C;
        font-weight:600;text-transform:uppercase;letter-spacing:.5px;
      }
      .mp-field input,.mp-field textarea,.mp-field select{
        width:100%;padding:12px 14px;border-radius:12px;
        border:1px solid rgba(255,255,255,.08);background:rgba(0,0,0,.35);
        color:#fff;box-sizing:border-box;font-family:inherit;font-size:14px;
      }
      .mp-map{width:100%;height:180px;border-radius:14px;margin-bottom:12px;
        border:1px solid rgba(255,255,255,.08);overflow:hidden;z-index:1}
      .mp-submit{
        width:100%;padding:14px;border:none;border-radius:14px;
        background:linear-gradient(135deg,#7C3AED,#3b82f6);
        color:#fff;font-weight:700;font-size:15px;cursor:pointer;font-family:inherit;
      }
      .mp-search-row{display:flex;gap:8px;margin-bottom:10px}
      .mp-search-row input{flex:1}
      .mp-search-row button{
        padding:0 14px;background:#7C3AED;border:none;border-radius:12px;
        color:#fff;font-weight:700;cursor:pointer;font-family:inherit;font-size:13px;
      }
      .mp-radius{display:flex;align-items:center;gap:8px;margin-bottom:12px;font-size:12px;color:#8B8B9C}
      .mp-radius select{
        background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.08);
        color:#fff;border-radius:10px;padding:8px 12px;font-family:inherit;
      }
      .mp-card{
        background:rgba(255,255,255,.04);border-radius:14px;margin-bottom:12px;
        border:1px solid rgba(255,255,255,.07);overflow:hidden;
      }
      .mp-card-img{
        width:100%;height:140px;object-fit:cover;background:#1a1a28;
        display:flex;align-items:center;justify-content:center;font-size:48px;color:#475569;
      }
      .mp-card-img img{width:100%;height:140px;object-fit:cover}
      .mp-card-body{padding:12px 14px}
      .mp-card h4{margin:0 0 4px;font-size:14px;color:#E9EDEF}
      .mp-price{color:#10b981;font-weight:800;font-size:15px;margin:4px 0}
      .mp-meta{font-size:11px;color:#8B8B9C;line-height:1.4}
      .mp-actions{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap}
      .mp-btn{
        flex:1;min-width:80px;padding:10px;border-radius:10px;border:none;
        font-weight:700;font-size:12px;cursor:pointer;font-family:inherit;
      }
      .mp-btn-chat{background:#25D366;color:#0B141A}
      .mp-btn-map{background:rgba(255,255,255,.08);color:#E9EDEF}
      .mp-btn-del{background:rgba(244,33,46,.2);color:#F87171}
      .mp-cond{
        display:inline-block;font-size:10px;padding:2px 8px;border-radius:8px;
        font-weight:700;margin-left:6px;
      }
      .mp-cond.baru{background:rgba(16,185,129,.2);color:#34D399}
      .mp-cond.bekas{background:rgba(245,158,11,.2);color:#FBBF24}
      .mp-empty{color:#8B8B9C;font-size:13px;text-align:center;padding:20px}
      .mp-hidden{display:none!important}
      .mp-photo-preview{max-width:100%;max-height:120px;border-radius:10px;margin-top:8px}
    `;
    document.head.appendChild(s);
  }

  function injectLeaflet(cb) {
    if (window.L && window.L.map) { cb(); return; }
    if (!document.getElementById('mp-leaflet-css')) {
      var l = document.createElement('link');
      l.id = 'mp-leaflet-css';
      l.rel = 'stylesheet';
      l.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(l);
    }
    var s = document.createElement('script');
    s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    s.onload = cb;
    s.onerror = function () { console.warn('[MP] Leaflet gagal'); cb(); };
    document.head.appendChild(s);
  }

  function injectModal() {
    if (document.getElementById('mpOverlay')) return;
    var div = document.createElement('div');
    div.innerHTML =
      '<div class="mp-overlay" id="mpOverlay">' +
        '<div class="mp-modal">' +
          '<button class="mp-close" type="button" onclick="MP_close()">&times;</button>' +
          '<h2 class="mp-title">🛒 Marketplace</h2>' +
          '<p class="mp-sub">Jual · Beli · Cari di peta terdekat</p>' +
          '<div class="mp-tabs">' +
            '<button type="button" class="mp-tab on" id="mpTabBrowse" onclick="MP_tab(\'browse\')">Cari / Beli</button>' +
            '<button type="button" class="mp-tab" id="mpTabSell" onclick="MP_tab(\'sell\')">Jual Barang</button>' +
            '<button type="button" class="mp-tab" id="mpTabMine" onclick="MP_tab(\'mine\')">Listing Saya</button>' +
          '</div>' +
          '<div id="mpBrowse">' +
            '<div class="mp-search-row">' +
              '<input type="text" id="mpSearch" placeholder="motor beat / iphone / kursi">' +
              '<button type="button" onclick="MP_search()">Cari</button>' +
            '</div>' +
            '<div class="mp-radius">' +
              '<span>Radius</span>' +
              '<select id="mpRadius">' +
                '<option value="5">5 km</option><option value="10">10 km</option>' +
                '<option value="25" selected>25 km</option><option value="50">50 km</option>' +
                '<option value="100">100 km</option>' +
              '</select>' +
              '<button type="button" class="mp-btn mp-btn-map" style="flex:0;padding:8px 12px" onclick="MP_gps()">📍 GPS</button>' +
            '</div>' +
            '<div id="mpMap" class="mp-map"></div>' +
            '<div id="mpResults"></div>' +
          '</div>' +
          '<div id="mpSell" class="mp-hidden">' +
            '<div class="mp-field"><label>Judul barang</label><input type="text" id="mpTitle" placeholder="Motor Beat 2020"></div>' +
            '<div class="mp-field"><label>Harga (Rp)</label><input type="number" id="mpPrice" placeholder="12500000" inputmode="numeric"></div>' +
            '<div class="mp-field"><label>Deskripsi</label><textarea id="mpDesc" rows="3" placeholder="Kondisi, kelengkapan, alasan jual..."></textarea></div>' +
            '<div class="mp-field"><label>Kondisi</label>' +
              '<select id="mpCond"><option value="baru">Baru</option><option value="bekas">Bekas</option></select></div>' +
            '<div class="mp-field"><label>Kategori</label>' +
              '<select id="mpCat">' +
                '<option value="kendaraan">Kendaraan</option>' +
                '<option value="elektronik">Elektronik</option>' +
                '<option value="rumah">Rumah Tangga</option>' +
                '<option value="fashion">Fashion</option>' +
                '<option value="lainnya">Lainnya</option>' +
              '</select></div>' +
            '<div class="mp-field"><label>Foto barang</label>' +
              '<input type="file" id="mpPhoto" accept="image/*">' +
              '<img id="mpPhotoPrev" class="mp-photo-preview mp-hidden" alt="">' +
            '</div>' +
            '<div class="mp-field"><label>Alamat / lokasi</label>' +
              '<input type="text" id="mpAddress" placeholder="Kelurahan / jalan (opsional)">' +
              '<button type="button" class="mp-btn mp-btn-map" style="width:100%;margin-top:8px" onclick="MP_gpsSell()">📍 Pakai Lokasi GPS Saya</button>' +
            '</div>' +
            '<button class="mp-submit" type="button" onclick="MP_publish()">📢 Pasang Iklan</button>' +
          '</div>' +
          '<div id="mpMine" class="mp-hidden"><div id="mpMineList"></div></div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(div.firstChild);

    var photoInp = document.getElementById('mpPhoto');
    if (photoInp) {
      photoInp.onchange = function () {
        var f = this.files && this.files[0];
        var prev = document.getElementById('mpPhotoPrev');
        if (!f || !prev) return;
        if (f.size > 900 * 1024) { alert('Foto maks ~900 KB. Kompres dulu.'); this.value = ''; return; }
        var fr = new FileReader();
        fr.onload = function () {
          prev.src = fr.result;
          prev.classList.remove('mp-hidden');
          prev.dataset.dataurl = fr.result;
        };
        fr.readAsDataURL(f);
      };
    }
  }

  function tab(name) {
    document.getElementById('mpBrowse').classList.toggle('mp-hidden', name !== 'browse');
    document.getElementById('mpSell').classList.toggle('mp-hidden', name !== 'sell');
    document.getElementById('mpMine').classList.toggle('mp-hidden', name !== 'mine');
    document.getElementById('mpTabBrowse').classList.toggle('on', name === 'browse');
    document.getElementById('mpTabSell').classList.toggle('on', name === 'sell');
    document.getElementById('mpTabMine').classList.toggle('on', name === 'mine');
    if (name === 'browse') {
      injectLeaflet(function () {
        setTimeout(function () {
          initMap();
          search();
        }, 150);
      });
    }
    if (name === 'mine') renderMine();
  }

  function initMap() {
    if (!window.L) return;
    var el = document.getElementById('mpMap');
    if (!el) return;
    var lat = gpsReady ? myLat : DEFAULT_LAT;
    var lng = gpsReady ? myLng : DEFAULT_LNG;
    if (!mapMP) {
      mapMP = L.map('mpMap').setView([lat, lng], 13);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
      }).addTo(mapMP);
    } else {
      mapMP.invalidateSize();
      mapMP.setView([lat, lng], 13);
    }
  }

  function requestGPS(cb) {
    if (!navigator.geolocation) {
      alert('Browser tidak support GPS.');
      if (cb) cb(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(function (pos) {
      myLat = pos.coords.latitude;
      myLng = pos.coords.longitude;
      gpsReady = true;
      if (cb) cb(true);
    }, function (err) {
      alert('Gagal GPS: ' + err.message);
      if (cb) cb(false);
    }, { enableHighAccuracy: true, timeout: 12000 });
  }

  function search() {
    var q = (document.getElementById('mpSearch').value || '').toLowerCase().trim();
    var radius = parseFloat((document.getElementById('mpRadius') || {}).value) || DEFAULT_RADIUS_KM;
    var results = document.getElementById('mpResults');
    if (!results) return;
    results.innerHTML = '';
    markersMP.forEach(function (m) { if (mapMP) mapMP.removeLayer(m); });
    markersMP = [];

    var data = getListings();
    var cLat = gpsReady ? myLat : DEFAULT_LAT;
    var cLng = gpsReady ? myLng : DEFAULT_LNG;
    if (mapMP) {
      var c = mapMP.getCenter();
      cLat = c.lat; cLng = c.lng;
      if (gpsReady) { cLat = myLat; cLng = myLng; }
    }

    var filtered = data.filter(function (item) {
      if (typeof item.lat !== 'number' || typeof item.lng !== 'number') return false;
      var dist = haversineKm(cLat, cLng, item.lat, item.lng);
      item._dist = dist;
      if (dist > radius) return false;
      var hay = ((item.title || '') + ' ' + (item.desc || '') + ' ' + (item.category || '') + ' ' + (item.address || '')).toLowerCase();
      return !q || hay.indexOf(q) !== -1;
    });
    filtered.sort(function (a, b) { return a._dist - b._dist; });

    if (!filtered.length) {
      results.innerHTML = '<p class="mp-empty">Tidak ada barang dalam radius ' + radius +
        ' km' + (q ? ' untuk "' + escapeHtml(q) + '"' : '') +
        '.<br>Coba perbesar radius atau pasang iklan sendiri.</p>';
      return;
    }

    filtered.forEach(function (item) {
      var distTxt = item._dist < 1 ? Math.round(item._dist * 1000) + ' m' : item._dist.toFixed(1) + ' km';
      var photoHtml = '';
      if (item.photos && item.photos[0]) {
        photoHtml = '<div class="mp-card-img"><img src="' + item.photos[0] + '" alt=""></div>';
      } else {
        var emoji = item.category === 'kendaraan' ? '🛵' : (item.category === 'elektronik' ? '📱' : (item.category === 'rumah' ? '🪑' : '📦'));
        photoHtml = '<div class="mp-card-img">' + emoji + '</div>';
      }
      var card = document.createElement('div');
      card.className = 'mp-card';
      card.innerHTML =
        photoHtml +
        '<div class="mp-card-body">' +
          '<h4>' + escapeHtml(item.title) +
            '<span class="mp-cond ' + escapeHtml(item.condition || 'bekas') + '">' +
              (item.condition === 'baru' ? 'BARU' : 'BEKAS') + '</span></h4>' +
          '<div class="mp-price">' + fmtRp(item.price) + '</div>' +
          '<p class="mp-meta">' + escapeHtml((item.desc || '').slice(0, 80)) +
            (item.desc && item.desc.length > 80 ? '…' : '') + '</p>' +
          '<p class="mp-meta">📍 ' + distTxt +
            (item.address ? ' · ' + escapeHtml(item.address) : '') +
            ' · by ' + escapeHtml(item.sellerId) + '</p>' +
          '<div class="mp-actions">' +
            '<button type="button" class="mp-btn mp-btn-chat" data-uid="' + escapeHtml(item.sellerId) + '">💬 Chat Penjual</button>' +
            '<button type="button" class="mp-btn mp-btn-map" data-lat="' + item.lat + '" data-lng="' + item.lng + '">🗺️ Maps</button>' +
          '</div>' +
        '</div>';
      results.appendChild(card);

      if (mapMP && window.L) {
        var mk = L.marker([item.lat, item.lng]).addTo(mapMP)
          .bindPopup('<b>' + escapeHtml(item.title) + '</b><br>' + fmtRp(item.price) + '<br>' + distTxt);
        markersMP.push(mk);
      }
    });

    results.querySelectorAll('.mp-btn-chat').forEach(function (b) {
      b.onclick = function () { chatSeller(this.getAttribute('data-uid')); };
    });
    results.querySelectorAll('.mp-btn-map').forEach(function (b) {
      b.onclick = function () {
        var lat = parseFloat(this.getAttribute('data-lat'));
        var lng = parseFloat(this.getAttribute('data-lng'));
        if (mapMP) mapMP.setView([lat, lng], 16);
        window.open('https://www.google.com/maps?q=' + lat + ',' + lng, '_blank', 'noopener');
      };
    });
    if (markersMP.length && mapMP) {
      var g = new L.featureGroup(markersMP);
      mapMP.fitBounds(g.getBounds().pad(0.2));
    }
  }

  function chatSeller(uid) {
    var me = getUserId();
    if (!me) { alert('Login dulu'); return; }
    if (uid === me) { alert('Ini listing Anda sendiri'); return; }
    try {
      var users = rd('dk_users', []);
      if (!users.some(function (u) { return u.id === uid; })) {
        users.push({ id: uid, pw: '', balance: 0, created: Date.now(), ghost: true });
        wr('dk_users', users);
      }
    } catch (e) {}
    // free chat from marketplace (or use connection fee 0)
    try {
      var CONN_KEY = 'dk_connections';
      var all = rd(CONN_KEY, {});
      if (!all[me]) all[me] = {};
      if (!all[me][uid]) {
        all[me][uid] = { ts: Date.now(), fee: 0, source: 'marketplace' };
        if (!all[uid]) all[uid] = {};
        all[uid][me] = { ts: Date.now(), fee: 0, from: me, source: 'marketplace' };
        wr(CONN_KEY, all);
      }
    } catch (e) {}
    closeMP();
    if (typeof window.dkChatOpen === 'function') {
      window.dkChatOpen();
      setTimeout(function () {
        var inp = document.getElementById('dkc-nwid');
        if (inp) {
          var dlg = document.getElementById('dkc-dlg');
          if (dlg) dlg.classList.add('active');
          inp.value = uid;
        }
      }, 400);
    } else {
      alert('Buka Chat, ketik ID: ' + uid);
    }
  }

  function publish() {
    var me = getUserId();
    if (!me) { alert('Login dulu'); return; }
    var title = (document.getElementById('mpTitle').value || '').trim();
    var price = parseInt(document.getElementById('mpPrice').value, 10) || 0;
    var desc = (document.getElementById('mpDesc').value || '').trim();
    var cond = (document.getElementById('mpCond') || {}).value || 'bekas';
    var cat = (document.getElementById('mpCat') || {}).value || 'lainnya';
    var address = (document.getElementById('mpAddress').value || '').trim();
    var prev = document.getElementById('mpPhotoPrev');
    var photo = (prev && prev.dataset.dataurl) || null;

    if (!title) { alert('Isi judul barang'); return; }
    if (price < 1) { alert('Isi harga'); return; }
    if (!gpsReady && (myLat === DEFAULT_LAT)) {
      // still allow with default or last GPS
    }
    var item = {
      id: 'mp-' + Date.now() + Math.random().toString(36).slice(2, 5),
      sellerId: me,
      title: title,
      price: price,
      desc: desc,
      condition: cond,
      category: cat,
      photos: photo ? [photo] : [],
      lat: myLat,
      lng: myLng,
      address: address,
      created: Date.now()
    };
    var list = getListings();
    list.unshift(item);
    saveListings(list);
    alert('✅ Iklan dipasang! Bisa ditemukan pembeli dalam radius GPS.');
    document.getElementById('mpTitle').value = '';
    document.getElementById('mpPrice').value = '';
    document.getElementById('mpDesc').value = '';
    document.getElementById('mpAddress').value = '';
    if (prev) { prev.src = ''; prev.classList.add('mp-hidden'); delete prev.dataset.dataurl; }
    var fi = document.getElementById('mpPhoto');
    if (fi) fi.value = '';
    tab('browse');
  }

  function renderMine() {
    var me = getUserId();
    var box = document.getElementById('mpMineList');
    if (!box) return;
    var list = getListings().filter(function (x) { return x.sellerId === me; });
    if (!list.length) {
      box.innerHTML = '<p class="mp-empty">Belum ada listing. Buka tab <b>Jual Barang</b>.</p>';
      return;
    }
    box.innerHTML = '';
    list.forEach(function (item) {
      var card = document.createElement('div');
      card.className = 'mp-card';
      card.innerHTML =
        '<div class="mp-card-body">' +
          '<h4>' + escapeHtml(item.title) + '</h4>' +
          '<div class="mp-price">' + fmtRp(item.price) + '</div>' +
          '<p class="mp-meta">' + escapeHtml(item.condition) + ' · ' + escapeHtml(item.category) + '</p>' +
          '<div class="mp-actions">' +
            '<button type="button" class="mp-btn mp-btn-del" data-id="' + escapeHtml(item.id) + '">🗑 Hapus</button>' +
          '</div>' +
        '</div>';
      box.appendChild(card);
    });
    box.querySelectorAll('[data-id]').forEach(function (b) {
      b.onclick = function () {
        if (!confirm('Hapus listing ini?')) return;
        var id = this.getAttribute('data-id');
        var all = getListings().filter(function (x) { return x.id !== id; });
        saveListings(all);
        renderMine();
      };
    });
  }

  function openMP() {
    if (!getUserId()) { alert('Login dulu'); return; }
    injectCSS();
    injectModal();
    document.getElementById('mpOverlay').classList.add('mp-open');
    tab('browse');
    if (!gpsReady) {
      requestGPS(function () {
        if (mapMP) mapMP.setView([myLat, myLng], 13);
        search();
      });
    }
  }
  function closeMP() {
    var el = document.getElementById('mpOverlay');
    if (el) el.classList.remove('mp-open');
  }

  window.MP_open = openMP;
  window.MP_close = closeMP;
  window.MP_tab = tab;
  window.MP_search = search;
  window.MP_publish = publish;
  window.MP_gps = function () {
    requestGPS(function () {
      if (mapMP) mapMP.setView([myLat, myLng], 14);
      search();
    });
  };
  window.MP_gpsSell = function () {
    requestGPS(function (ok) {
      if (ok) alert('Lokasi GPS tersimpan untuk iklan ini.');
    });
  };

  console.log('[Marketplace] FB-style jual/beli + peta + foto ✅');
})();
