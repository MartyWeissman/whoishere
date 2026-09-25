// Shared by the student page and the instructor page. Everything here runs in the browser.
(function () {
  const enc = new TextEncoder();

  // Make "0123 456", "123456" and "123-456" all mean the same ID.
  function normalizeId(raw) {
    return String(raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/^0+(?=.)/, "");
  }

  function b64urlToBytes(s) {
    s = s.replace(/-/g, "+").replace(/_/g, "/");
    while (s.length % 4) s += "=";
    return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  }
  function bytesToB64url(bytes) {
    return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function newCourseKey() {
    return bytesToB64url(crypto.getRandomValues(new Uint8Array(16)));
  }
  function isCourseKey(k) {
    return typeof k === "string" && /^[A-Za-z0-9_-]{22}$/.test(k);
  }

  // The scrambled code sent to the server: HMAC-SHA256(courseKey, "wih1:" + ID), first 128 bits, hex.
  // Without the course key it cannot be turned back into a student ID.
  const keyCache = new Map();
  async function pseudonym(courseKey, rawId) {
    let key = keyCache.get(courseKey);
    if (!key) {
      key = await crypto.subtle.importKey("raw", b64urlToBytes(courseKey),
        { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
      keyCache.set(courseKey, key);
    }
    const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode("wih1:" + normalizeId(rawId))));
    return Array.from(sig.slice(0, 16), (b) => b.toString(16).padStart(2, "0")).join("");
  }

  // A short fingerprint of the course key, stored with the course so the instructor page can
  // tell whether a pasted key is the right one. It reveals nothing about student IDs.
  async function keyCheck(courseKey) {
    return (await pseudonym(courseKey, "\u0000key-check")).slice(0, 12);
  }

  // QR contents: <student page URL>#s=<session code>&k=<course key>
  // Everything after "#" stays in the browser; it is never sent to any web server.
  function parseCheckinUrl(text) {
    try {
      const u = new URL(text);
      const p = new URLSearchParams(u.hash.slice(1));
      const s = p.get("s"), k = p.get("k");
      if (s && /^[0-9a-f]{32}$/.test(s) && isCourseKey(k)) return { code: s, key: k };
    } catch (e) { /* not a URL */ }
    return null;
  }

  // Tiny, safe localStorage wrapper (private browsing can throw).
  const store = {
    get(k, fallback) {
      try { const v = localStorage.getItem(k); return v == null ? fallback : JSON.parse(v); }
      catch (e) { return fallback; }
    },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } },
  };

  window.WIH = { normalizeId, pseudonym, keyCheck, newCourseKey, isCourseKey, parseCheckinUrl, store };
})();
