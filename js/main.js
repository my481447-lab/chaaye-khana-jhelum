/* ============================================================
   CHAAYE KHANA — FOUNDATION SCRIPT
   Sticky header · mobile nav · menu search · footer year.
   Smooth scrolling is handled in CSS (scroll-behavior + scroll-padding).
   ============================================================ */

(function () {
  "use strict";

  var header = document.querySelector(".site-header");
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.getElementById("primary-nav");

  var searchToggle = document.querySelector("[data-search-toggle]");
  var search = document.getElementById("site-search");
  var searchInput = search && search.querySelector(".site-search__input");
  var searchClose = search && search.querySelector(".site-search__close");
  var searchForm = search && search.querySelector("form");
  var searchList = search && search.querySelector(".site-search__list");
  var searchMsg = search && search.querySelector(".site-search__message");

  var navOpen = false;
  var searchOpen = false;

  var HINT = "Search by dish, category or ingredient — e.g. “chai”, “kabab”, “breakfast”.";

  function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  /* ----------  Header: transparent over hero, solid on scroll  ---------- */
  var syncHeader = function () {
    if (!header) return;
    header.classList.toggle("is-scrolled", navOpen || searchOpen || window.scrollY > 24);
  };

  if (header) {
    syncHeader();
    window.addEventListener("scroll", syncHeader, { passive: true });
  }

  /* ----------  Mobile navigation  ---------- */
  var setNav = function (open) {
    if (!toggle || !nav) return;
    navOpen = open;
    nav.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    if (open) setSearch(false);
    syncHeader();
  };

  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      setNav(!navOpen);
    });

    // Close after choosing a destination on mobile.
    nav.addEventListener("click", function (e) {
      if (e.target.closest(".nav__link")) setNav(false);
    });

    // Reset when returning to desktop layout.
    window.matchMedia("(min-width: 961px)").addEventListener("change", function (ev) {
      if (ev.matches) setNav(false);
    });
  }

  /* ----------  Menu search  ---------- */
  var menuIndex = null;

  function buildIndex() {
    if (menuIndex) return menuIndex;
    var cards = [].slice.call(document.querySelectorAll("#menu .menu-card"));
    menuIndex = cards.map(function (card) {
      var pick = function (sel) {
        var el = card.querySelector(sel);
        return el ? el.textContent.trim().replace(/\s+/g, " ") : "";
      };
      var name = pick(".menu-card__title");
      var category = pick(".menu-card__badge");
      var descEl = card.querySelector(".menu-card__text");
      var desc = descEl && !descEl.classList.contains("menu-card__text--todo")
        ? descEl.textContent.trim().replace(/\s+/g, " ")
        : "";
      return {
        el: card,
        name: name,
        category: category,
        desc: desc,
        price: pick(".menu-card__price"),
        haystack: (name + " " + category + " " + desc).toLowerCase()
      };
    });
    return menuIndex;
  }

  function escapeHTML(s) {
    return s.replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function highlight(text, terms) {
    var safe = escapeHTML(text);
    if (!terms.length) return safe;
    var pattern = terms
      .map(function (t) { return t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); })
      .join("|");
    return safe.replace(new RegExp("(" + pattern + ")", "ig"), "<mark>$1</mark>");
  }

  function currentResults() {
    var q = (searchInput ? searchInput.value : "").trim().toLowerCase();
    if (!q) return { q: q, terms: [], items: null };
    var terms = q.split(/\s+/);
    var items = buildIndex().filter(function (item) {
      return terms.every(function (t) { return item.haystack.indexOf(t) !== -1; });
    });
    return { q: q, terms: terms, items: items };
  }

  function renderSearch() {
    if (!searchList || !searchMsg) return;
    var res = currentResults();

    // idle / empty query
    if (res.items === null) {
      searchList.hidden = true;
      searchList.innerHTML = "";
      searchMsg.className = "site-search__message";
      searchMsg.textContent = HINT;
      return;
    }

    // no matches
    if (!res.items.length) {
      searchList.hidden = true;
      searchList.innerHTML = "";
      searchMsg.className = "site-search__message is-empty";
      searchMsg.textContent = "No results found for “" + res.q + "”.";
      return;
    }

    // matches
    var index = buildIndex();
    searchList.innerHTML = res.items.map(function (item) {
      return (
        '<li><a class="site-search__result" href="#menu" data-idx="' + index.indexOf(item) + '">' +
          '<span class="site-search__result-top">' +
            '<span class="site-search__result-name">' + highlight(item.name, res.terms) + "</span>" +
            '<span class="site-search__result-cat">' + highlight(item.category, res.terms) + "</span>" +
          "</span>" +
          '<span class="site-search__result-price">' + escapeHTML(item.price) + "</span>" +
          '<span class="site-search__result-desc">' + highlight(item.desc, res.terms) + "</span>" +
        "</a></li>"
      );
    }).join("");
    searchList.hidden = false;
    searchMsg.className = "site-search__message";
    searchMsg.textContent = res.items.length + (res.items.length === 1 ? " match" : " matches");
  }

  function gotoResult(card) {
    setSearch(false);
    if (!card) return;
    if (card.hidden) {
      var allBtn = document.querySelector('.menu-filter[data-filter="all"]');
      if (allBtn) allBtn.click();
    }
    card.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "center" });
    card.classList.add("is-search-target");
    window.setTimeout(function () { card.classList.remove("is-search-target"); }, 1600);
  }

  /* ----------  Search dropdown open/close  ---------- */
  function setSearch(open) {
    if (!search || !searchToggle) return;
    searchOpen = open;
    search.hidden = !open;
    searchToggle.setAttribute("aria-expanded", String(open));
    if (open) {
      setNav(false);
      buildIndex();
      renderSearch();
      if (searchInput) searchInput.focus();
    } else if (searchInput) {
      searchInput.value = "";
      renderSearch();
    }
    syncHeader();
  }

  if (searchToggle && search) {
    searchToggle.addEventListener("click", function () {
      setSearch(!searchOpen);
    });
    if (searchClose) searchClose.addEventListener("click", function () { setSearch(false); });

    if (searchInput) {
      var debounce;
      searchInput.addEventListener("input", function () {
        window.clearTimeout(debounce);
        debounce = window.setTimeout(renderSearch, 110);
      });
      // native "clear" (×) on type=search fires a `search` event
      searchInput.addEventListener("search", renderSearch);
    }

    if (searchForm) {
      searchForm.addEventListener("submit", function (e) {
        e.preventDefault();
        var res = currentResults();
        if (res.items && res.items.length) gotoResult(res.items[0].el);
        else if (res.items === null) setSearch(false);
        // no matches: keep the panel open showing the message
      });
    }

    if (searchList) {
      searchList.addEventListener("click", function (e) {
        var link = e.target.closest(".site-search__result");
        if (!link) return;
        e.preventDefault();
        var item = buildIndex()[Number(link.getAttribute("data-idx"))];
        gotoResult(item && item.el);
      });
    }

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && searchOpen) {
        setSearch(false);
        searchToggle.focus();
      }
    });
  }

  /* ----------  Menu filters + Shopping cart  ---------- */
  var menuSection = document.getElementById("menu");
  var cartEl = document.getElementById("cart");
  var cartToggle = document.querySelector("[data-cart-toggle]");
  var cartCount = document.querySelector(".icon-btn__count");

  var QTY_MAX = 99;
  var menuCards = menuSection
    ? [].slice.call(menuSection.querySelectorAll(".menu-card"))
    : [];

  /* ---- Menu category filters ---- */
  if (menuSection) {
    var filterBar = menuSection.querySelector(".menu-filters");
    var menuEmpty = menuSection.querySelector(".menu-empty");
    if (filterBar) {
      filterBar.addEventListener("click", function (e) {
        var btn = e.target.closest(".menu-filter");
        if (!btn) return;
        var filter = btn.getAttribute("data-filter");

        filterBar.querySelectorAll(".menu-filter").forEach(function (b) {
          var on = b === btn;
          b.classList.toggle("is-active", on);
          b.setAttribute("aria-pressed", String(on));
        });

        var shown = 0;
        menuCards.forEach(function (card) {
          var match = filter === "all" || card.getAttribute("data-category") === filter;
          card.hidden = !match;
          if (match) shown++;
        });
        if (menuEmpty) menuEmpty.hidden = shown > 0;

        // Take the visitor to the filtered results so they only see that category.
        var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        filterBar.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
      });
    }
  }

  /* ---- Cart store (prices come straight from the menu markup) ---- */
  var cartLines = []; // [{ name, price, qty }]

  function parsePrice(text) {
    var digits = (text || "").replace(/[^\d]/g, "");
    return digits ? parseInt(digits, 10) : 0;
  }
  function money(n) {
    return "Rs. " + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }
  function cardByName(name) {
    for (var i = 0; i < menuCards.length; i++) {
      var t = menuCards[i].querySelector(".menu-card__title");
      if (t && t.textContent.trim() === name) return menuCards[i];
    }
    return null;
  }
  function lineFor(name) {
    for (var i = 0; i < cartLines.length; i++) {
      if (cartLines[i].name === name) return cartLines[i];
    }
    return null;
  }

  function syncCard(name) {
    var card = cardByName(name);
    if (!card) return;
    var line = lineFor(name);
    var n = line ? line.qty : 0;
    var add = card.querySelector(".menu-card__add");
    var qty = card.querySelector(".menu-card__qty");
    var valueEl = qty && qty.querySelector(".menu-card__qty-value");
    if (!add || !qty || !valueEl) return;
    card.classList.toggle("is-in-cart", n > 0);
    if (n > 0) {
      add.hidden = true;
      qty.hidden = false;
      valueEl.textContent = String(n);
    } else {
      qty.hidden = true;
      add.hidden = false;
      valueEl.textContent = "1";
    }
  }

  function setItemQty(name, qty) {
    qty = Math.max(0, Math.min(QTY_MAX, qty));
    var line = lineFor(name);
    if (qty === 0) {
      if (line) cartLines.splice(cartLines.indexOf(line), 1);
    } else if (line) {
      line.qty = qty;
    } else {
      var card = cardByName(name);
      if (!card) return;
      cartLines.push({
        name: name,
        price: parsePrice(card.querySelector(".menu-card__price").textContent),
        qty: qty
      });
    }
    syncCard(name);
    renderCart();
  }

  /* ---- Cart drawer render ---- */
  var cartList = cartEl && cartEl.querySelector(".cart__list");
  var cartEmpty = cartEl && cartEl.querySelector(".cart__empty");
  var cartFoot = cartEl && cartEl.querySelector(".cart__foot");
  var cartSubtotalEl = cartEl && cartEl.querySelector(".cart__subtotal");
  var cartTotalEl = cartEl && cartEl.querySelector(".cart__total");

  function renderCart() {
    var totalQty = 0;
    var subtotal = 0;
    cartLines.forEach(function (l) {
      totalQty += l.qty;
      subtotal += l.qty * l.price;
    });

    if (cartCount) {
      cartCount.setAttribute("data-count", String(totalQty));
      cartCount.textContent = totalQty > 99 ? "99+" : String(totalQty);
    }
    if (cartToggle) {
      cartToggle.setAttribute(
        "aria-label",
        totalQty ? "Cart, " + totalQty + " item" + (totalQty === 1 ? "" : "s") : "Cart"
      );
    }

    if (!cartList) return;

    if (!cartLines.length) {
      cartList.innerHTML = "";
      cartList.hidden = true;
      if (cartEmpty) cartEmpty.hidden = false;
      if (cartFoot) cartFoot.hidden = true;
      if (cartSubtotalEl) cartSubtotalEl.textContent = money(0);
      if (cartTotalEl) cartTotalEl.textContent = money(0);
      return;
    }

    if (cartEmpty) cartEmpty.hidden = true;
    cartList.hidden = false;
    if (cartFoot) cartFoot.hidden = false;

    cartList.innerHTML = cartLines
      .map(function (l) {
        var nm = escapeHTML(l.name);
        return (
          '<li class="cart-item">' +
            '<div class="cart-item__info">' +
              '<span class="cart-item__name">' + nm + "</span>" +
              '<span class="cart-item__unit">' + money(l.price) + " each</span>" +
            "</div>" +
            '<button class="cart-item__remove" type="button" data-cart-remove ' +
              'data-name="' + nm + '" aria-label="Remove ' + nm + '">&times;</button>' +
            '<div class="cart-item__qty">' +
              '<button type="button" data-cart-step="-1" data-name="' + nm + '" aria-label="Decrease ' + nm + '">&minus;</button>' +
              "<span>" + l.qty + "</span>" +
              '<button type="button" data-cart-step="1" data-name="' + nm + '" aria-label="Increase ' + nm + '">+</button>' +
            "</div>" +
            '<span class="cart-item__line">' + money(l.qty * l.price) + "</span>" +
          "</li>"
        );
      })
      .join("");

    if (cartSubtotalEl) cartSubtotalEl.textContent = money(subtotal);
    if (cartTotalEl) cartTotalEl.textContent = money(subtotal);
  }

  /* ---- Cart open / close ---- */
  var cartOpen = false;
  function setCart(open) {
    if (!cartEl) return;
    cartOpen = open;
    cartEl.classList.toggle("is-open", open);
    cartEl.setAttribute("aria-hidden", String(!open));
    if (cartToggle) cartToggle.setAttribute("aria-expanded", String(open));
    if (open) {
      setNav(false);
      setSearch(false);
      var closeBtn = cartEl.querySelector(".cart__close");
      if (closeBtn) closeBtn.focus();
    } else if (cartToggle) {
      cartToggle.focus();
    }
  }

  if (cartToggle && cartEl) {
    cartToggle.addEventListener("click", function () {
      setCart(!cartOpen);
    });
    cartEl.addEventListener("click", function (e) {
      if (e.target.closest("[data-cart-close]")) {
        setCart(false);
        return;
      }
      var step = e.target.closest("[data-cart-step]");
      if (step) {
        var name = step.getAttribute("data-name");
        var line = lineFor(name);
        setItemQty(name, (line ? line.qty : 0) + parseInt(step.getAttribute("data-cart-step"), 10));
        return;
      }
      var rm = e.target.closest("[data-cart-remove]");
      if (rm) setItemQty(rm.getAttribute("data-name"), 0);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && cartOpen) setCart(false);
    });
  }

  /* ---- Add / step from the menu cards ---- */
  if (menuSection) {
    menuSection.addEventListener("click", function (e) {
      var card = e.target.closest(".menu-card");
      if (!card) return;
      var titleEl = card.querySelector(".menu-card__title");
      if (!titleEl) return;
      var name = titleEl.textContent.trim();

      if (e.target.closest(".menu-card__add")) {
        setItemQty(name, 1);
        return;
      }
      var step = e.target.closest(".menu-card__qty-btn");
      if (step) {
        var line = lineFor(name);
        setItemQty(name, (line ? line.qty : 0) + parseInt(step.getAttribute("data-step"), 10));
      }
    });
  }

  renderCart();

  /* ----------  Gallery + lightbox  ---------- */
  var gallery = document.getElementById("gallery");
  var lb = document.getElementById("lightbox");

  if (gallery && lb) {
    var tiles = [].slice.call(gallery.querySelectorAll(".gallery-grid__item"));
    var lbImg = lb.querySelector(".lightbox__img");
    var lbPh = lb.querySelector(".lightbox__ph");
    var lbCap = lb.querySelector(".lightbox__caption");
    var lbIndex = -1;
    var lbIsOpen = false;

    // A tile counts as "has photo" only once its image actually loads.
    // A missing/broken src stays a labelled "Add photo" slot (see onerror in the markup).
    tiles.forEach(function (t) {
      var img = t.querySelector("img");
      if (!img) return;
      var mark = function () { if (img.naturalWidth > 0) t.classList.add("has-photo"); };
      img.addEventListener("load", mark); // also fires again if onerror swaps in a fallback src
      if (img.complete) mark();
    });

    function lbShow(i) {
      if (!tiles.length) return;
      lbIndex = (i + tiles.length) % tiles.length;
      var tile = tiles[lbIndex];
      var img = tile.querySelector("img");
      var cat = tile.getAttribute("data-category") || "";

      if (img) {
        lbImg.src = img.getAttribute("data-full") || img.currentSrc || img.src;
        lbImg.alt = img.alt || cat;
        lbImg.hidden = false;
        lbPh.hidden = true;
      } else {
        lbImg.hidden = true;
        lbImg.removeAttribute("src");
        lbPh.hidden = false;
        lbPh.textContent =
          "Photo slot (" + cat + ") — add a verified image of Chaaye Khana, Jhelum.";
      }
      lbCap.textContent = cat;
    }

    function lbOpen(i) {
      lbIsOpen = true;
      lb.classList.add("is-open");
      lb.setAttribute("aria-hidden", "false");
      lbShow(i);
      var closeBtn = lb.querySelector("[data-lb-close]");
      if (closeBtn) closeBtn.focus();
    }

    function lbClose() {
      lbIsOpen = false;
      lb.classList.remove("is-open");
      lb.setAttribute("aria-hidden", "true");
      lbImg.removeAttribute("src");
      if (tiles[lbIndex]) tiles[lbIndex].focus();
    }

    gallery.addEventListener("click", function (e) {
      var tile = e.target.closest(".gallery-grid__item");
      if (tile) {
        var idx = tiles.indexOf(tile);
        if (idx > -1) lbOpen(idx);
        return;
      }
      if (e.target.closest("[data-lb-close]")) lbClose();
      else if (e.target.closest("[data-lb-prev]")) lbShow(lbIndex - 1);
      else if (e.target.closest("[data-lb-next]")) lbShow(lbIndex + 1);
    });

    lb.addEventListener("click", function (e) {
      if (e.target === lb) lbClose();
    });

    document.addEventListener("keydown", function (e) {
      if (!lbIsOpen) return;
      if (e.key === "Escape") lbClose();
      else if (e.key === "ArrowLeft") lbShow(lbIndex - 1);
      else if (e.key === "ArrowRight") lbShow(lbIndex + 1);
    });
  }

  /* ----------  Floating chat widget  ----------
     Talks to the backend restaurant agent at data-chat-endpoint
     (POST { message, history } -> { reply }). The Anthropic API key
     lives ONLY on that server — it is never present in this file or
     sent from the browser. If the backend can't be reached, the widget
     falls back to the verified offline answers below. */
  var chat = document.querySelector("[data-chat]");
  if (chat) {
    var chatLauncher = chat.querySelector("[data-chat-open]");
    var chatLog = chat.querySelector("[data-chat-log]");
    var chatSuggests = chat.querySelector("[data-chat-suggests]");
    var chatForm = chat.querySelector("[data-chat-form]");
    var chatInput = chat.querySelector(".chat__input");
    var chatSend = chat.querySelector(".chat__send");
    var chatOpen = false;
    var chatGreeted = false;
    var chatBusy = false;

    var CHAT_ENDPOINT =
      chat.getAttribute("data-chat-endpoint") || "/api/chat";

    // If the endpoint is a localhost dev server but this page isn't on
    // localhost (i.e. the site is deployed and the backend isn't), skip the
    // network call and use the verified offline answers directly.
    var pageIsLocal = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
    var endpointIsLocal = /\/\/(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(CHAT_ENDPOINT);
    var chatOfflineOnly = endpointIsLocal && !pageIsLocal;

    // Rolling conversation sent to the agent (it caps this server-side too).
    var chatHistory = []; // [{ role: "user"|"assistant", content }]
    var CHAT_HISTORY_MAX = 12;

    var CHAT_GREETING =
      "Hi! I can help with the Chaaye Khana, Jhelum menu, prices, offers, " +
      "opening hours, location and contact details — ask away, or pick a " +
      "question below.";

    // Offline fallback — only used if the backend can't be reached.
    var CHAT_OFFLINE = {
      menu:
        "Our full menu is on this page (tap Explore Menu). Dish names and " +
        "prices are from the Chaaye Khana menu — confirm current prices with " +
        "the branch on (0544) 610711.",
      prices:
        "Every item shows its exact price on the menu on this page. Confirm " +
        "current prices with the branch on (0544) 610711.",
      offers:
        "Regular programmes: Ladies’ Tuesday (complimentary tea for women, " +
        "every Tuesday) and in-house Chess Competitions. Ask the branch about " +
        "any current seasonal deals: (0544) 610711.",
      location:
        "Chaaye Khana, Jhelum is on GT Road, Jhelum Cantt — next to Adventura " +
        "Park, near the PSO Riverside filling station.",
      hours:
        "Listed hours: Sunday–Thursday 8:00 am – midnight, Friday–Saturday " +
        "8:00 am – 1:00 am. Worth confirming on our Google listing.",
      _default:
        "Sorry — I can’t reach our assistant right now. Please try again in a " +
        "moment, or call the branch on (0544) 610711 (or +92 329 1509505 for " +
        "reservations)."
    };

    function chatScroll() {
      chatLog.scrollTop = chatLog.scrollHeight;
    }

    function escapeHtml(s) {
      return String(s).replace(/[&<>"]/g, function (c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
      });
    }

    // Tiny, safe renderer: escape everything, then allow **bold** and links.
    function renderReply(text) {
      var html = escapeHtml(text);
      html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
      html = html.replace(/(https?:\/\/[^\s<]+)/g, function (url) {
        return (
          '<a href="' + url + '" target="_blank" rel="noopener">' + url + "</a>"
        );
      });
      return html;
    }

    function chatAddUser(text) {
      var msg = document.createElement("div");
      msg.className = "chat__msg chat__msg--user";
      var bubble = document.createElement("p");
      bubble.className = "chat__bubble";
      bubble.textContent = text;
      msg.appendChild(bubble);
      chatLog.appendChild(msg);
      chatScroll();
    }

    function chatAddBot(text, opts) {
      var msg = document.createElement("div");
      msg.className = "chat__msg chat__msg--bot";
      var bubble = document.createElement("p");
      bubble.className = "chat__bubble";
      if (opts && opts.html) bubble.innerHTML = renderReply(text);
      else bubble.textContent = text;
      msg.appendChild(bubble);
      chatLog.appendChild(msg);
      chatScroll();
      return msg;
    }

    function setChatBusy(busy) {
      chatBusy = busy;
      if (chatInput) chatInput.disabled = busy;
      if (chatSend) chatSend.disabled = busy;
    }

    function askAgent(message) {
      if (chatBusy) return;
      chatAddUser(message);
      setChatBusy(true);

      var typing = chatAddBot("…");
      typing.classList.add("chat__msg--typing");

      // Deployed site with no reachable backend -> answer offline, no request.
      if (chatOfflineOnly) {
        window.setTimeout(function () {
          typing.querySelector(".chat__bubble").textContent =
            offlineAnswerFor(message);
          typing.classList.remove("chat__msg--typing");
          setChatBusy(false);
          chatScroll();
          if (chatInput) chatInput.focus({ preventScroll: true });
        }, 260);
        return;
      }

      chatHistory.push({ role: "user", content: message });

      var controller =
        typeof AbortController !== "undefined" ? new AbortController() : null;
      var timeout = window.setTimeout(function () {
        if (controller) controller.abort();
      }, 20000);

      fetch(CHAT_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: message,
          history: chatHistory.slice(-CHAT_HISTORY_MAX)
        }),
        signal: controller ? controller.signal : undefined
      })
        .then(function (res) {
          return res.json().catch(function () {
            return {};
          });
        })
        .then(function (data) {
          var reply =
            data && typeof data.reply === "string" && data.reply.trim()
              ? data.reply.trim()
              : CHAT_OFFLINE._default;
          typing.querySelector(".chat__bubble").innerHTML = renderReply(reply);
          typing.classList.remove("chat__msg--typing");
          chatHistory.push({ role: "assistant", content: reply });
        })
        .catch(function () {
          typing.querySelector(".chat__bubble").textContent =
            offlineAnswerFor(message);
          typing.classList.remove("chat__msg--typing");
          // don't keep a failed turn in history
          chatHistory.pop();
        })
        .then(function () {
          window.clearTimeout(timeout);
          setChatBusy(false);
          chatScroll();
          if (chatInput) chatInput.focus({ preventScroll: true });
        });
    }

    function offlineAnswerFor(message) {
      var t = message.toLowerCase();
      if (/menu|dish|eat|food/.test(t)) return CHAT_OFFLINE.menu;
      if (/price|cost|how much|rupee|\brs\b/.test(t)) return CHAT_OFFLINE.prices;
      if (/offer|deal|discount|tuesday|chess/.test(t)) return CHAT_OFFLINE.offers;
      if (/where|located|location|address|map|direction/.test(t))
        return CHAT_OFFLINE.location;
      if (/hour|open|close|timing|what time|when/.test(t))
        return CHAT_OFFLINE.hours;
      return CHAT_OFFLINE._default;
    }

    function chatGreet() {
      if (chatGreeted) return;
      chatGreeted = true;
      chatAddBot(CHAT_GREETING);
    }

    function setChat(open) {
      chatOpen = open;
      chat.classList.toggle("is-open", open);
      chatLauncher.setAttribute("aria-expanded", String(open));
      chatLauncher.setAttribute("aria-label", open ? "Close chat" : "Open chat");
      if (open) {
        chatGreet();
        chatScroll();
        window.setTimeout(function () {
          var firstChip = chat.querySelector(".chat__chip");
          if (firstChip) firstChip.focus({ preventScroll: true });
        }, prefersReducedMotion() ? 0 : 130);
      } else {
        chatLauncher.focus({ preventScroll: true });
      }
    }

    chatLauncher.addEventListener("click", function () {
      setChat(!chatOpen);
    });

    chat.querySelectorAll("[data-chat-close]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        setChat(false);
      });
    });

    if (chatSuggests) {
      chatSuggests.addEventListener("click", function (e) {
        var chip = e.target.closest(".chat__chip");
        if (!chip) return;
        askAgent(chip.textContent.trim());
      });
    }

    if (chatForm) {
      chatForm.addEventListener("submit", function (e) {
        e.preventDefault();
        var text = (chatInput.value || "").trim();
        if (!text || chatBusy) return;
        chatInput.value = "";
        askAgent(text);
      });
    }

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && chatOpen) setChat(false);
    });
  }

  /* ----------  Footer year  ---------- */
  var year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();
})();
