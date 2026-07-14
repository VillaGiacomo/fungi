(function () {
  "use strict";

  const ACCESS_VERSION = "fungi-access-v1";
  const STORAGE_KEY = "fungi.mobile.access.v1";
  const SALT = "fungi-ai-pwa-gate-v1";
  const ITERATIONS = 210000;
  const EXPECTED = "xs3mwCBF6eoYmN+ijYNFm2hgRHWmQdviKWQo+LTFw38=";

  document.addEventListener("DOMContentLoaded", initializeGate);

  function initializeGate() {
    const form = document.querySelector("#accessForm");
    form.addEventListener("submit", verifyAccess);
    if (localStorage.getItem(STORAGE_KEY) === ACCESS_VERSION
        || sessionStorage.getItem(STORAGE_KEY) === ACCESS_VERSION) {
      unlockApp();
    } else {
      document.querySelector("#accessCode").focus();
    }
  }

  async function verifyAccess(event) {
    event.preventDefault();
    const input = document.querySelector("#accessCode");
    const button = document.querySelector("#accessSubmit");
    const error = document.querySelector("#accessError");
    button.disabled = true;
    button.textContent = "Verifico…";
    error.textContent = "";
    try {
      if (!window.crypto || !window.crypto.subtle) throw new Error("Browser non supportato");
      const valid = await matchesExpected(input.value);
      if (!valid) {
        error.textContent = "Codice non corretto";
        input.select();
        return;
      }
      sessionStorage.setItem(STORAGE_KEY, ACCESS_VERSION);
      if (document.querySelector("#rememberAccess").checked) {
        localStorage.setItem(STORAGE_KEY, ACCESS_VERSION);
      }
      input.value = "";
      unlockApp();
    } catch (failure) {
      error.textContent = failure && failure.message ? failure.message : "Verifica non disponibile";
    } finally {
      button.disabled = false;
      button.textContent = "Entra";
    }
  }

  async function matchesExpected(value) {
    const encoder = new TextEncoder();
    const material = await crypto.subtle.importKey(
      "raw", encoder.encode(value), "PBKDF2", false, ["deriveBits"]
    );
    const bits = await crypto.subtle.deriveBits({
      name: "PBKDF2", hash: "SHA-256", salt: encoder.encode(SALT), iterations: ITERATIONS
    }, material, 256);
    const actual = new Uint8Array(bits);
    const expected = Uint8Array.from(atob(EXPECTED), character => character.charCodeAt(0));
    if (actual.length !== expected.length) return false;
    let difference = 0;
    for (let index = 0; index < actual.length; index += 1) difference |= actual[index] ^ expected[index];
    return difference === 0;
  }

  function unlockApp() {
    const gate = document.querySelector("#accessGate");
    if (gate.classList.contains("hidden")) return;
    gate.classList.add("hidden");
    document.body.classList.remove("access-locked");
    const application = document.createElement("script");
    application.src = "app_v2.js";
    document.body.appendChild(application);
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("sw.js", { scope: "./" }).catch(() => { /* online mode remains available */ });
    }
  }
}());
