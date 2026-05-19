(function () {
  function applyInit(data) {
    var wallet = data.wallet || "Wallet";
    var pageTitle = data.title || wallet;
    var icon = data.icon || "";

    document.title = pageTitle;
    document.getElementById("wallet-name").textContent = wallet;
    document.getElementById("headline").textContent = "Continue in " + wallet;

    var img = document.getElementById("wallet-icon");
    img.alt = wallet;
    if (icon) {
      img.src = icon;
      img.style.display = "";
      img.onerror = function () {
        img.style.display = "none";
      };
    } else {
      img.style.display = "none";
    }
  }

  window.addEventListener("message", function (event) {
    if (event.data && event.data.type === "wallet-connect-init") {
      applyInit(event.data);
    }
  });

  document.getElementById("retry").addEventListener("click", function () {
    if (window.opener && !window.opener.closed) {
      try {
        window.opener.postMessage({ type: "wallet-connect-retry" }, "*");
      } catch (e) {}
    }
    window.close();
  });

  if (window.opener && !window.opener.closed) {
    try {
      window.opener.postMessage({ type: "wallet-connect-popup-ready" }, "*");
    } catch (e) {}
  }
})();
