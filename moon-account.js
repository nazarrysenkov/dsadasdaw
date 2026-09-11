(function () {
  'use strict';

  var ACCOUNT_KEY = 'moon.web.account.v1';
  var PLAN_SEEN_KEY = 'moon.web.plans.seen.v1';
  var account = read(ACCOUNT_KEY);

  function read(key) {
    try { return JSON.parse(localStorage.getItem(key) || 'null'); }
    catch (e) { return null; }
  }

  function save(key, value) {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  }

  function node(tag, className, text) {
    var element = document.createElement(tag);
    if (className) element.className = className;
    if (text != null) element.textContent = text;
    return element;
  }

  function style() {
    var css = node('style');
    css.textContent = [
      '.moon-auth{position:fixed;inset:0;z-index:10000;display:grid;place-items:center;padding:20px;background:#050505;color:#f2f5f9;font-family:"Space Grotesk",system-ui,sans-serif}',
      '.moon-auth[hidden],.moon-plans[hidden]{display:none}',
      '.moon-auth-card{width:min(420px,100%);padding:34px;border:1px solid #29292d;border-radius:22px;background:#0b0b0c;text-align:center;box-shadow:0 28px 90px #000}',
      '.moon-auth-mark{font-size:42px;line-height:1;color:#8aa4f8}',
      '.moon-auth h1,.moon-plans h2{margin:18px 0 8px;font-size:26px;letter-spacing:-.03em}',
      '.moon-auth p,.moon-plans-intro{margin:0;color:#8a94a0;line-height:1.55}',
      '#moon-google{display:flex;justify-content:center;margin-top:26px;min-height:44px}',
      '.moon-auth-error{min-height:20px;margin-top:14px;color:#e18484;font-size:13px}',
      '.moon-account-button{position:fixed;z-index:9000;right:16px;top:14px;height:38px;max-width:210px;padding:0 14px;border:1px solid #29292d;border-radius:12px;background:#111113;color:#dde2e8;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.moon-account-button:hover{border-color:#4a4a50;background:#171719}',
      '.moon-plans{position:fixed;inset:0;z-index:9500;overflow:auto;padding:56px 20px;background:rgba(5,5,5,.97);color:#f2f5f9;font-family:"Space Grotesk",system-ui,sans-serif}',
      '.moon-plans-inner{width:min(880px,100%);margin:auto}',
      '.moon-plans-head{text-align:center;margin-bottom:28px}',
      '.moon-plan-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}',
      '.moon-plan{padding:24px;border:1px solid #29292d;border-radius:20px;background:#0b0b0c}',
      '.moon-plan.featured{border-color:#625a82}',
      '.moon-plan-top{display:flex;align-items:baseline;justify-content:space-between;gap:12px}',
      '.moon-plan h3{margin:0;font-size:22px}.moon-price{color:#8aa4f8;font-weight:600}',
      '.moon-plan ul{min-height:150px;margin:18px 0;padding:0;list-style:none;color:#b8bec7}',
      '.moon-plan li{margin:9px 0}.moon-plan li:before{content:"✓";margin-right:9px;color:#8aa4f8}',
      '.moon-buy,.moon-skip,.moon-signout{width:100%;height:46px;border-radius:12px;cursor:pointer}',
      '.moon-buy{border:0;background:#8aa4f8;color:#08090b;font-weight:700}',
      '.moon-buy:hover{background:#a2b6fa}.moon-skip,.moon-signout{border:1px solid #29292d;background:#111113;color:#b8bec7}',
      '.moon-plans-actions{display:flex;gap:10px;max-width:440px;margin:18px auto 0}',
      '.moon-plan-note{text-align:center;min-height:22px;margin-top:14px;color:#e0b978;font-size:13px}',
      '.moon-account-line{text-align:center;margin-top:18px;color:#6d747e;font-size:12px}',
      '@media(max-width:700px){.moon-account-button{right:10px;top:9px;max-width:150px}.moon-plan-grid{grid-template-columns:1fr}.moon-plan ul{min-height:0}.moon-plans{padding:34px 14px}}'
    ].join('');
    document.head.appendChild(css);
  }

  function authView() {
    var screen = node('div', 'moon-auth');
    screen.id = 'moon-auth';
    var card = node('section', 'moon-auth-card');
    card.append(node('div', 'moon-auth-mark', '◐'));
    card.append(node('h1', '', 'Вход в Moon AI'));
    card.append(node('p', '', 'Войдите через Google, чтобы использовать Moon AI и управлять тарифом.'));
    var google = node('div');
    google.id = 'moon-google';
    card.append(google);
    var error = node('div', 'moon-auth-error');
    error.id = 'moon-auth-error';
    card.append(error);
    screen.append(card);
    document.body.append(screen);
    return screen;
  }

  function planCard(title, price, features, featured) {
    var card = node('article', 'moon-plan' + (featured ? ' featured' : ''));
    var top = node('div', 'moon-plan-top');
    top.append(node('h3', '', title));
    top.append(node('span', 'moon-price', price));
    card.append(top);
    var list = node('ul');
    features.forEach(function (feature) { list.append(node('li', '', feature)); });
    card.append(list);
    var buy = node('button', 'moon-buy', 'Купить ' + title);
    buy.type = 'button';
    buy.addEventListener('click', function () {
      document.getElementById('moon-plan-note').textContent = 'Оплата временно недоступна';
    });
    card.append(buy);
    return card;
  }

  function plansView() {
    var screen = node('div', 'moon-plans');
    screen.id = 'moon-plans';
    screen.hidden = true;
    var inner = node('div', 'moon-plans-inner');
    var head = node('header', 'moon-plans-head');
    head.append(node('div', 'moon-auth-mark', '◐'));
    head.append(node('h2', '', 'Тарифы Moon AI'));
    head.append(node('p', 'moon-plans-intro', 'Один тариф работает в Moon AI и MoonCode.'));
    inner.append(head);
    var grid = node('div', 'moon-plan-grid');
    grid.append(planCard('Pro', '$10 / месяц', [
      '100 запросов Moon AI в день',
      '200 запросов MoonCode в день',
      'Расширенный поиск в интернете',
      'Moon Builder и HTML → APK'
    ], false));
    grid.append(planCard('Ultra', '$99 / месяц', [
      'Запросы без дневного лимита',
      'MoonCode без дневного лимита',
      'Расширенный поиск в интернете',
      'Moon Builder и HTML → APK'
    ], true));
    inner.append(grid);
    var actions = node('div', 'moon-plans-actions');
    var skip = node('button', 'moon-skip', 'Нет, спасибо');
    skip.type = 'button';
    skip.addEventListener('click', closePlans);
    var signout = node('button', 'moon-signout', 'Выйти');
    signout.type = 'button';
    signout.addEventListener('click', logout);
    actions.append(skip, signout);
    inner.append(actions);
    var note = node('div', 'moon-plan-note');
    note.id = 'moon-plan-note';
    inner.append(note);
    var accountLine = node('div', 'moon-account-line');
    accountLine.id = 'moon-account-line';
    inner.append(accountLine);
    screen.append(inner);
    document.body.append(screen);
    return screen;
  }

  function closePlans() {
    save(PLAN_SEEN_KEY, true);
    document.getElementById('moon-plans').hidden = true;
  }

  function openPlans() {
    var plans = document.getElementById('moon-plans');
    document.getElementById('moon-plan-note').textContent = '';
    document.getElementById('moon-account-line').textContent = account ? account.email : '';
    plans.hidden = false;
  }

  function logout() {
    account = null;
    save(ACCOUNT_KEY, null);
    save(PLAN_SEEN_KEY, null);
    document.getElementById('moon-plans').hidden = true;
    document.getElementById('moon-account-button').hidden = true;
    document.getElementById('moon-auth').hidden = false;
    if (window.google && google.accounts) google.accounts.id.disableAutoSelect();
  }

  async function onGoogle(response) {
    var error = document.getElementById('moon-auth-error');
    error.textContent = '';
    try {
      var request = await fetch('/api/google/web', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential })
      });
      var data = await request.json();
      if (!request.ok) throw new Error(data.error || 'Google-вход не выполнен');
      account = { name: data.name, email: data.email, subject: data.subject };
      save(ACCOUNT_KEY, account);
      document.getElementById('moon-auth').hidden = true;
      updateButton();
      openPlans();
    } catch (failure) {
      error.textContent = failure.message || 'Не удалось войти через Google';
    }
  }

  function loadGoogle() {
    var script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = function () {
      google.accounts.id.initialize({ client_id: '1070401601412-6vqv5djbefjveitde4dv8glmk3koatmg.apps.googleusercontent.com', callback: onGoogle });
      google.accounts.id.renderButton(document.getElementById('moon-google'), {
        theme: 'filled_black', size: 'large', shape: 'pill', width: 280, text: 'continue_with'
      });
    };
    script.onerror = function () { document.getElementById('moon-auth-error').textContent = 'Не удалось загрузить Google'; };
    document.head.appendChild(script);
  }

  function updateButton() {
    var button = document.getElementById('moon-account-button');
    button.hidden = !account;
    button.textContent = account ? (account.name || account.email) : 'Аккаунт';
  }

  function init() {
    style();
    var auth = authView();
    plansView();
    var accountButton = node('button', 'moon-account-button');
    accountButton.id = 'moon-account-button';
    accountButton.type = 'button';
    accountButton.addEventListener('click', openPlans);
    document.body.append(accountButton);
    auth.hidden = Boolean(account);
    updateButton();
    loadGoogle();
    if (account && !read(PLAN_SEEN_KEY)) openPlans();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
