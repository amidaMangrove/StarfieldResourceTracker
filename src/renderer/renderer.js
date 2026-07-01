// ---------- 状態 ----------
let state = {
  items: [],        // { id, name, collected }
  opacity: 0.9,
  compact: false
};

const listEl = document.getElementById('list');
const countEl = document.getElementById('count');
const nameInput = document.getElementById('name-input');
const opacityInput = document.getElementById('opacity');

// ---------- 永続化 ----------
async function loadState() {
  const saved = await window.api.load();
  if (saved && typeof saved === 'object') {
    state = Object.assign(state, saved);
    if (!Array.isArray(state.items)) state.items = [];
  }
  applyMeta();
  render();
}

let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => window.api.save(state), 150);
}

// メタ情報（不透明度・コンパクト）を画面へ反映
function applyMeta() {
  document.body.style.opacity = String(state.opacity);
  opacityInput.value = String(state.opacity);
  document.body.classList.toggle('compact', !!state.compact);
}

// 工業作業台レシピ
const CRAFT = window.STARFIELD_CRAFTABLES || {};

// ---------- 描画 ----------
function render() {
  listEl.innerHTML = '';
  for (const item of state.items) {
    const recipe = CRAFT[item.name];

    const li = document.createElement('li');
    if (item.collected) li.classList.add('collected');
    if (recipe) li.classList.add('craftable');
    li.dataset.id = item.id;

    // --- 1行目 ---
    const row = document.createElement('div');
    row.className = 'row';

    const check = document.createElement('span');
    check.className = 'check';
    check.textContent = item.collected ? '☑' : '☐';
    check.addEventListener('click', () => toggleCollected(item.id));

    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = item.name;
    name.title = item.name;
    name.addEventListener('click', () => toggleCollected(item.id));

    row.append(check, name);

    // 工業作業台バッジ（押すとレシピ展開）
    if (recipe) {
      const badge = document.createElement('span');
      badge.className = 'craft-badge';
      badge.textContent = '工';
      badge.title = `工業作業台で作成可（${recipe.tier}）— クリックでレシピ表示`;
      badge.addEventListener('click', (e) => {
        e.stopPropagation();
        li.classList.toggle('open');
      });
      row.appendChild(badge);
    }

    const del = document.createElement('button');
    del.className = 'del';
    del.textContent = '✕';
    del.title = '削除';
    del.addEventListener('click', () => removeItem(item.id));
    row.appendChild(del);

    li.appendChild(row);

    // --- レシピ（展開時のみ表示） ---
    if (recipe) {
      const rec = document.createElement('div');
      rec.className = 'recipe';

      const tier = document.createElement('span');
      tier.className = 'recipe-tier';
      tier.textContent = recipe.tier;

      const mats = document.createElement('span');
      mats.className = 'recipe-mats';
      mats.textContent =
        '材料: ' + recipe.mats.map((m) => `${m[0]}×${m[1]}`).join(' ＋ ');

      const addBtn = document.createElement('button');
      addBtn.className = 'recipe-add';
      addBtn.textContent = '＋材料を一覧に追加';
      addBtn.title = 'この資源の材料をまとめて追跡リストに追加';
      addBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        addMaterials(recipe.mats);
      });

      rec.append(tier, mats, addBtn);
      li.appendChild(rec);
    }

    listEl.appendChild(li);
  }
  const remaining = state.items.filter((i) => !i.collected).length;
  const craftable = state.items.filter((i) => CRAFT[i.name]).length;
  countEl.textContent =
    `${state.items.length} 件 (残 ${remaining})` +
    (craftable ? ` ・工 ${craftable}` : '');
}

// ---------- 操作 ----------
function addItem(name) {
  name = name.trim();
  if (!name) return;
  // 同名があれば追加せず「未収集」に戻すだけ
  const existing = state.items.find(
    (i) => i.name.toLowerCase() === name.toLowerCase()
  );
  if (existing) {
    existing.collected = false;
  } else {
    state.items.push({
      id: Date.now() + '-' + Math.random().toString(36).slice(2, 7),
      name,
      collected: false
    });
  }
  save();
  render();
}

// レシピの材料をまとめて追加（既存はスキップ）
function addMaterials(mats) {
  for (const [matName] of mats) {
    const exists = state.items.some(
      (i) => i.name.toLowerCase() === matName.toLowerCase()
    );
    if (!exists) {
      state.items.push({
        id: Date.now() + '-' + Math.random().toString(36).slice(2, 7),
        name: matName,
        collected: false
      });
    }
  }
  save();
  render();
}

function removeItem(id) {
  state.items = state.items.filter((i) => i.id !== id);
  save();
  render();
}

function toggleCollected(id) {
  const item = state.items.find((i) => i.id === id);
  if (item) {
    item.collected = !item.collected;
    save();
    render();
  }
}

// ---------- イベント ----------
document.getElementById('add-form').addEventListener('submit', (e) => {
  e.preventDefault();
  addItem(nameInput.value);
  nameInput.value = '';
  closeCombo();
  nameInput.focus();
});

document.getElementById('btn-clear').addEventListener('click', () => {
  if (state.items.length === 0) return;
  if (confirm('全ての資源を削除しますか？')) {
    state.items = [];
    save();
    render();
  }
});

opacityInput.addEventListener('input', () => {
  state.opacity = parseFloat(opacityInput.value);
  document.body.style.opacity = String(state.opacity);
  save();
});

document.getElementById('btn-compact').addEventListener('click', () => {
  state.compact = !state.compact;
  document.body.classList.toggle('compact', state.compact);
  save();
});

document.getElementById('btn-hide').addEventListener('click', () => {
  // 非表示にする。再表示は Ctrl+Shift+S。
  window.api.hide();
});

document.getElementById('btn-quit').addEventListener('click', () => {
  window.api.quit();
});

// ---------- 自前ドロップダウン（ホイールスクロール対応） ----------
const RES = window.STARFIELD_RESOURCES || [];
const comboEl = document.getElementById('combo');
const comboList = document.getElementById('combo-list');
let comboItems = [];   // 現在表示中の候補
let activeIndex = -1;  // キーボード選択中の位置

function filterCombo() {
  const q = nameInput.value.trim().toLowerCase();
  comboItems = q ? RES.filter((n) => n.toLowerCase().includes(q)) : RES.slice();
  activeIndex = -1;
  renderComboList();
}

function renderComboList() {
  comboList.innerHTML = '';
  if (comboItems.length === 0) {
    const li = document.createElement('li');
    li.className = 'combo-empty';
    li.textContent = '候補なし（そのまま追加できます）';
    comboList.appendChild(li);
    return;
  }
  comboItems.forEach((name, i) => {
    const li = document.createElement('li');
    li.className = 'combo-item' + (i === activeIndex ? ' active' : '');

    const label = document.createElement('span');
    label.textContent = name;
    li.appendChild(label);

    if (CRAFT[name]) {
      const b = document.createElement('span');
      b.className = 'combo-craft';
      b.textContent = '工';
      li.appendChild(b);
    }

    // mousedown でinputのblurを防ぎつつ選択
    li.addEventListener('mousedown', (e) => {
      e.preventDefault();
      selectOption(name);
    });
    comboList.appendChild(li);
  });
}

function openCombo() {
  comboEl.classList.add('open');
  filterCombo();
}

function closeCombo() {
  comboEl.classList.remove('open');
  activeIndex = -1;
}

// 候補を選ぶと即追加。続けて追加できるよう開いたままにする
function selectOption(name) {
  addItem(name);
  nameInput.value = '';
  nameInput.focus();
  filterCombo();
}

function moveActive(delta) {
  if (comboItems.length === 0) return;
  activeIndex =
    (activeIndex + delta + comboItems.length) % comboItems.length;
  renderComboList();
  const el = comboList.children[activeIndex];
  if (el) el.scrollIntoView({ block: 'nearest' });
}

nameInput.addEventListener('focus', openCombo);
nameInput.addEventListener('input', () => {
  comboEl.classList.add('open');
  filterCombo();
});
nameInput.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (!comboEl.classList.contains('open')) openCombo();
    else moveActive(1);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    moveActive(-1);
  } else if (e.key === 'Enter') {
    if (comboEl.classList.contains('open') && activeIndex >= 0) {
      e.preventDefault();
      selectOption(comboItems[activeIndex]);
    }
    // それ以外はフォーム送信（入力テキストを追加）に任せる
  } else if (e.key === 'Escape') {
    closeCombo();
  }
});

document.getElementById('combo-toggle').addEventListener('mousedown', (e) => {
  e.preventDefault();
  if (comboEl.classList.contains('open')) closeCombo();
  else openCombo();
  nameInput.focus();
});

// 外側クリックで閉じる
document.addEventListener('mousedown', (e) => {
  if (!comboEl.contains(e.target)) closeCombo();
});

// ---------- 起動 ----------
loadState();
