const express = require('express');
const line = require('@line/bot-sdk');
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');

const app = express();

// ============ 基本設定 ============
const ORDERS_FILE = path.join(__dirname, 'data', 'orders.json');
const MENU_FILE = path.join(__dirname, 'data', 'menu.json');

// 確保 data 目錄存在
if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
}

// 初始化訂單資料（如果不存在）
if (!fs.existsSync(ORDERS_FILE)) {
  fs.writeFileSync(ORDERS_FILE, JSON.stringify([], null, 2));
}

// LINE Bot SDK config
let lineClient = null;
const lineConfig = {
  channelAccessToken: process.env.LINE_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

if (lineConfig.channelAccessToken && lineConfig.channelSecret) {
  try {
    lineClient = new line.Client(lineConfig);
    console.log('LINE Bot credentials loaded successfully');
  } catch (e) {
    console.error('LINE Client initialization error:', e);
  }
} else {
  console.log('WARNING: LINE Bot credentials not set - LINE features disabled');
}

// Express config - static files first
app.use(express.static(path.join(__dirname, 'public')));

// JSON parsing ONLY for /api routes (not /webhook which needs raw body for LINE signature)
app.use('/api', express.json());

// ============ 訂單儲存功能 ============
function loadOrders() {
  try {
    return JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8'));
  } catch (e) {
    return [];
  }
}

function saveOrders(orders) {
  fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2));
}

function addOrder(order) {
  const orders = loadOrders();
  orders.push(order);
  saveOrders(orders);
  return order;
}

function findOrderByCustomer(name, phone) {
  const orders = loadOrders();
  return orders.filter(o => 
    o.customer.name.includes(name) && o.customer.phone.includes(phone)
  );
}

function updateOrderStatus(orderId, newStatus, paymentInfo = {}) {
  const orders = loadOrders();
  const idx = orders.findIndex(o => o.id === orderId);
  if (idx >= 0) {
    orders[idx].status = newStatus;
    if (paymentInfo.last5Digits) orders[idx].paymentLast5 = paymentInfo.last5Digits;
    if (paymentInfo.paidDate) orders[idx].paidDate = paymentInfo.paidDate;
    if (paymentInfo.paidAmount) orders[idx].paidAmount = paymentInfo.paidAmount;
    saveOrders(orders);
    return orders[idx];
  }
  return null;
}

function getUnpaidOrders() {
  return loadOrders().filter(o => o.status === 'pending' || o.paymentStatus === 'unpaid');
}

// ============ 載入/儲存菜單 ============
function loadMenuData() {
  try {
    if (fs.existsSync(MENU_FILE)) {
      return JSON.parse(fs.readFileSync(MENU_FILE, 'utf8'));
    }
  } catch (e) {}
  return null;
}

function saveMenuData(data) {
  fs.writeFileSync(MENU_FILE, JSON.stringify(data, null, 2));
}

// ============ 年菜菜單資料 ============
const DEFAULT_MENU = {
  combos: [
    {
      id: 'combo-furui',
      name: '福瑞套餐',
      price: 3680,
      serving: '6人份',
      description: '經典大千留住你的胃',
      items: ['紅燒獅子頭', '干鍋花椰菜', '酸白菜火鍋', '豆酥排骨酥', '雪菜豆包'],
      image: 'https://images.unsplash.com/photo-1555244162-803834f70033?w=600&h=400&fit=crop'
    },
    {
      id: 'combo-jixiang',
      name: '吉祥套餐',
      price: 4680,
      serving: '8人份',
      description: '豐盛滿漢團圓桌',
      items: ['紅燒獅子頭', '干鍋花椰菜', '酸白菜火鍋', '豆酥排骨酥', '雪菜豆包', '雪菜豆'],
      image: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=600&h=400&fit=crop'
    }
  ],
  hotDishes: [
    { id: 'd1', name: '五福玉臨門', subtitle: '祥和拼盤', price: 800, type: '奶蛋素', image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop' },
    { id: 'd2', name: '御品佛跳牆', subtitle: '佛跳牆', price: 1380, type: '全素', image: 'https://images.unsplash.com/photo-1540189544446-9760fd1d4b44?w=400&h=300&fit=crop' },
    { id: 'd3', name: '鳳凰舞九天', subtitle: '蓉城口水雞', price: 760, type: '奶蛋素', image: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=400&h=300&fit=crop' },
    { id: 'd4', name: '金雞鳴呈祥', subtitle: '祥和素油雞', price: 640, type: '奶蛋素', image: 'https://images.unsplash.com/photo-1598103442097-8b74394b95c3?w=400&h=300&fit=crop' },
    { id: 'd5', name: '吉祥如意鍋', subtitle: '酸白菜鍋', price: 860, type: '奶蛋素', image: 'https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?w=400&h=300&fit=crop' },
    { id: 'd6', name: '富貴滿門鍋', subtitle: '麻油鍋', price: 860, type: '奶蛋素', image: 'https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?w=400&h=300&fit=crop' },
    { id: 'd7', name: '金玉滿堂鍋', subtitle: '南洋肉骨茶鍋', price: 1380, type: '全素', image: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=400&h=300&fit=crop' },
    { id: 'd8', name: '富貴耀滿門', subtitle: '麻油素腰花', price: 760, type: '全素', image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop' },
    { id: 'd9', name: '天香蒸白玉', subtitle: '清蒸臭豆腐', price: 640, type: '全素', image: 'https://images.unsplash.com/photo-1540189544446-9760fd1d4b44?w=400&h=300&fit=crop' },
    { id: 'd10', name: '麻辣燒白玉', subtitle: '麻辣臭豆腐', price: 600, type: '全素', image: 'https://images.unsplash.com/photo-1540189544446-9760fd1d4b44?w=400&h=300&fit=crop' },
    { id: 'd11', name: '金獅獻祥瑞', subtitle: '紅燒獅子頭', price: 640, type: '奶蛋素', image: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&h=300&fit=crop' },
    { id: 'd12', name: '水濂猴王菇', subtitle: '三杯猴頭菇', price: 760, type: '全素', image: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=400&h=300&fit=crop' },
    { id: 'd13', name: '蜜桃糖醋肉', subtitle: '糖醋素雞丁', price: 600, type: '奶蛋素', image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop' },
    { id: 'd14', name: '金牛運百寶', subtitle: '酸白菜素牛肉', price: 560, type: '奶蛋素', image: 'https://images.unsplash.com/photo-1540189544446-9760fd1d4b44?w=400&h=300&fit=crop' },
    { id: 'd15', name: '宮保鳳于飛', subtitle: '宮保素雞丁', price: 600, type: '奶蛋素', image: 'https://images.unsplash.com/photo-1555244162-803834f70033?w=400&h=300&fit=crop' },
    { id: 'd16', name: '乾坤好彩頭', subtitle: '素香鮑菇牛腩煲', price: 720, type: '全素', image: 'https://images.unsplash.com/photo-1540189544446-9760fd1d4b44?w=400&h=300&fit=crop' }
  ],
  frozenDishes: [
    { id: 'f1', name: '冷凍椒麻油飯', price: 300, type: '奶蛋素', image: 'https://images.unsplash.com/photo-1596088065578-4c5bd0cc7d95?w=400&h=300&fit=crop' },
    { id: 'f2', name: '冷凍松露油飯', price: 380, type: '全素', image: 'https://images.unsplash.com/photo-1596088065578-4c5bd0cc7d95?w=400&h=300&fit=crop' },
    { id: 'f3', name: '冷凍炒炊粉', price: 180, type: '全素', image: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=400&h=300&fit=crop' }
  ]
};

// 使用磁碟上的菜單，否則使用預設
const MENU_DATA = loadMenuData() || DEFAULT_MENU;

// ============ API: 取得菜單 ============
app.get('/api/menu', (req, res) => {
  res.json(MENU_DATA);
});

// ============ API: 建立訂單 ============
app.post('/api/orders', async (req, res) => {
  try {
    const { combo, sideDishes, customer, notes, totalAmount } = req.body;
    
    // 驗證必填欄位
    if (!customer || !customer.name || !customer.phone || !customer.store || !customer.pickupDate) {
      return res.status(400).json({ error: '請填寫完整顧客資料（姓名、電話、取貨分店、取貨日期）' });
    }

    const order = {
      id: 'ORD' + Date.now(),
      timestamp: new Date().toISOString(),
      combo,
      sideDishes: sideDishes || [],
      customer,
      notes: notes || '',
      totalAmount: totalAmount || 0,
      status: 'pending',         // pending -> confirmed -> completed
      paymentStatus: 'unpaid',    // unpaid -> paid
      lineUserId: customer.lineUserId || null  // 用於發送 LINE 通知
    };

    // 儲存訂單
    addOrder(order);

    console.log('===== 新訂單 =====');
    console.log('訂單編號:', order.id);
    console.log('顧客:', order.customer.name);
    console.log('電話:', order.customer.phone);
    console.log('分店:', order.customer.store);
    console.log('取貨日期:', order.customer.pickupDate);
    console.log('套餐:', combo ? combo.name : '未選');
    console.log('單點數量:', (sideDishes || []).length);
    console.log('總金額:', totalAmount);
    console.log('==================');

    // 發送 Email 通知（失敗不影響訂單成立）
    try {
      await sendOrderEmail(order);
    } catch (emailErr) {
      console.error('Email 發送失敗（訂單已成立）:', emailErr.message);
    }

    res.json({ 
      success: true, 
      orderId: order.id, 
      message: '訂單已送出！請儘快匯款並回報末五碼，店家會與您聯絡確認',
      order 
    });
  } catch (error) {
    console.error('訂單錯誤:', error);
    res.status(500).json({ error: '訂單處理失敗，請稍後再試，或直接致電店家：02-2357-0377' });
  }
});

// ============ API: 查詢訂單（管理後台用）============
app.get('/api/admin/orders', (req, res) => {
  const { status, paymentStatus, date } = req.query;
  let orders = loadOrders();
  
  if (status) orders = orders.filter(o => o.status === status);
  if (paymentStatus) orders = orders.filter(o => o.paymentStatus === paymentStatus);
  if (date) orders = orders.filter(o => o.customer.pickupDate === date);
  
  // 按時間倒序
  orders.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  
  res.json({ success: true, orders, count: orders.length });
});

// ============ API: 催繳通知（管理後台一鍵發送）============
app.post('/api/admin/remind-unpaid', async (req, res) => {
  if (!lineClient) {
    return res.status(500).json({ error: 'LINE Bot 未設定' });
  }
  
  const orders = getUnpaidOrders();
  const results = [];
  
  for (const order of orders) {
    if (order.lineUserId) {
      try {
        await lineClient.pushMessage(order.lineUserId, {
          type: 'text',
          text: `🧧 祥和蔬食提醒您

親愛的顧客 ${order.customer.name}，您好！

您有一筆年菜訂單尚未完成匯款：

📋 訂單編號：${order.id}
💰 金額：$${order.totalAmount}
📅 取貨日期：${order.customer.pickupDate}

【匯款資訊】
銀行：華南銀行（銀行代碼：008）
帳號：166-10-0******（洽店家索取完整帳號）
戶名：祥和蔬食料理

匯款完成後，請回傳末五碼，謝謝！
如有任何問題，請致電：02-2357-0377`
        });
        results.push({ orderId: order.id, sent: true });
      } catch (e) {
        results.push({ orderId: order.id, sent: false, error: e.message });
      }
    } else {
      // 沒有 LINE User ID，寄 Email
      try {
        await sendReminderEmail(order);
        results.push({ orderId: order.id, sent: 'email' });
      } catch (e) {
        results.push({ orderId: order.id, sent: false, error: e.message });
      }
    }
  }
  
  res.json({ success: true, results, total: orders.length });
});

// ============ API: 發送催繳給特定訂單 ============
app.post('/api/admin/remind/:orderId', async (req, res) => {
  if (!lineClient) {
    return res.status(500).json({ error: 'LINE Bot 未設定' });
  }
  
  const orders = loadOrders();
  const order = orders.find(o => o.id === req.params.orderId);
  
  if (!order) {
    return res.status(404).json({ error: '找不到訂單' });
  }
  
  try {
    if (order.lineUserId) {
      await lineClient.pushMessage(order.lineUserId, {
        type: 'text',
        text: `🧧 祥和蔬食提醒您

親愛的顧客 ${order.customer.name}，您好！

您有一筆年菜訂單尚未完成匯款：

📋 訂單編號：${order.id}
💰 金額：$${order.totalAmount}
📅 取貨日期：${order.customer.pickupDate}

【匯款資訊】
銀行：華南銀行（銀行代碼：008）
帳號：166-10-0******（洽店家索取完整帳號）
戶名：祥和蔬食料理

匯款完成後，請回傳末五碼，謝謝！`
      });
    } else {
      await sendReminderEmail(order);
    }
    res.json({ success: true, message: '催繳通知已發送' });
  } catch (e) {
    res.status(500).json({ error: '發送失敗: ' + e.message });
  }
});

// ============ API: 更新訂單匯款狀態 ============
app.post('/api/admin/update-payment', (req, res) => {
  const { orderId, last5Digits, paidAmount, paidDate, status } = req.body;
  
  const orders = loadOrders();
  const idx = orders.findIndex(o => o.id === orderId);
  
  if (idx < 0) {
    return res.status(404).json({ error: '找不到訂單' });
  }
  
  if (last5Digits) orders[idx].paymentLast5 = last5Digits;
  if (paidAmount) orders[idx].paidAmount = paidAmount;
  if (paidDate) orders[idx].paidDate = paidDate;
  if (status) orders[idx].status = status;
  if (status === 'confirmed' || status === 'paid') orders[idx].paymentStatus = 'paid';
  
  orders[idx].updatedAt = new Date().toISOString();
  
  saveOrders(orders);
  
  console.log('===== 匯款更新 =====');
  console.log('訂單:', orders[idx].id);
  console.log('末五碼:', last5Digits || orders[idx].paymentLast5);
  console.log('狀態:', orders[idx].status);
  console.log('====================');
  
  res.json({ success: true, order: orders[idx] });
});

// ============ LINE Webhook (GET for LINE verification) ============
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  
  if (mode === 'subscribe' && (token === '' || token === null)) {
    res.send(challenge);
  } else {
    res.send('ERROR');
  }
});

// ============ LINE Webhook (POST for LINE events) ============
app.post('/webhook', line.middleware(lineConfig), (req, res) => {
  if (!lineClient) {
    return res.status(500).send('LINE Bot not configured');
  }
  
  Promise
    .all(req.body.events.map(handleLineEvent))
    .then(() => res.end())
    .catch(err => {
      console.error('Event handling error:', err);
      res.status(500).end();
    });
});

async function handleLineEvent(event) {
  if (!lineClient) return;
  
  const userId = event.source && event.source.userId;
  
  // Handle postback (when user clicks a quick reply button)
  if (event.type === 'postback') {
    const postbackData = event.postback && event.postback.data ? event.postback.data : '';
    console.log('Postback from', userId, ':', postbackData);
    
    if (postbackData.startsWith('menu')) {
      return sendMenuLink(event.replyToken);
    } else if (postbackData.startsWith('order')) {
      return sendOrderLink(event.replyToken);
    } else if (postbackData.startsWith('contact')) {
      return sendContactInfo(event.replyToken);
    }
    return;
  }
  
  if (event.type !== 'message') return;
  
  const userMessage = event.message ? (event.message.text || '').trim() : '';
  const msg = userMessage.toLowerCase();

  console.log('LINE message from', userId, ':', userMessage);

  // ========== 員工指令 ==========
  
  // 收款更新：收款#姓名#電話#末五碼
  if (msg.startsWith('收款#')) {
    return handlePaymentUpdate(event.replyToken, userMessage, userId);
  }
  
  // 查詢訂單：查單#姓名#電話
  if (msg.startsWith('查單#')) {
    return handleOrderSearch(event.replyToken, userMessage);
  }
  
  // 如果只是說「訂單」或「查詢」或「我的訂單」- 顯示說明
  if (msg.includes('訂單') && (msg.includes('查') || msg.includes('找') || msg.includes('我的'))) {
    return sendOrderLookupGuide(event.replyToken);
  }
  
  // 更新菜單說明：更新#品名#價格#圖片URL
  if (msg.startsWith('更新#')) {
    return handleMenuUpdate(event.replyToken, userMessage);
  }
  
  // 如果只是說「更新菜單」或「我要更新菜單」之類的，显示说明
  if (msg.includes('更新') && (msg.includes('菜單') || msg.includes('menu'))) {
    return sendMenuUpdateGuide(event.replyToken);
  }
  
  // 如果只是說「訂單」或「查詢」或「我的訂單」- 顯示說明
  if (msg.includes('訂單') && (msg.includes('查') || msg.includes('找') || msg.includes('我的'))) {
    return sendOrderLookupGuide(event.replyToken);
  }
  
  // 今日訂單
  if (msg === '今日訂單') {
    return handleTodayOrders(event.replyToken);
  }
  
  // 未收款清單
  if (msg === '未收款') {
    return handleUnpaidList(event.replyToken);
  }
  
  // 催繳：催繳#訂單編號
  if (msg.startsWith('催繳#')) {
    return handleRemindOrder(event.replyToken, userMessage);
  }
  
  // 催繳所有未收款
  if (msg === '催繳全部') {
    return handleRemindAll(event.replyToken);
  }
  
  // ========== 顧客指令 ==========
  if (msg.includes('菜單') || msg === 'menu') {
    return sendMenuLink(event.replyToken);
  }
  if (msg.includes('預購') || msg === 'order' || msg.includes('訂購')) {
    return sendOrderLink(event.replyToken);
  }
  if (msg.includes('聯絡') || msg.includes('聯繫') || msg === 'contact') {
    return sendContactInfo(event.replyToken);
  }
  if (msg === '?' || msg === '？' || msg === 'help') {
    return sendMainMenu(event.replyToken);
  }

  // 預設：顯示主選單
  return sendMainMenu(event.replyToken);
}

// ============ 員工指令處理 ============

// 收款#姓名#電話#末五碼
async function handlePaymentUpdate(replyToken, message, userId) {
  const parts = message.split('#');
  if (parts.length < 4) {
    return lineClient.replyMessage(replyToken, {
      type: 'text',
      text: '❌ 格式錯誤！\n\n正確格式：\n收款#姓名#電話#末五碼\n\n例如：\n收款#王小明#0912345678#12345'
    });
  }
  
  const [, name, phone, last5] = parts;
  const orders = loadOrders();
  const order = orders.find(o => 
    o.customer.name.includes(name.trim()) && 
    o.customer.phone.includes(phone.trim()) &&
    (o.status === 'pending' || o.paymentStatus === 'unpaid')
  );
  
  if (!order) {
    return lineClient.replyMessage(replyToken, {
      type: 'text',
      text: '❌ 找不到符合條件的未付款訂單\n\n請確認姓名和電話是否正確，或聯絡系統管理員'
    });
  }
  
  // 更新訂單
  const idx = orders.findIndex(o => o.id === order.id);
  orders[idx].paymentLast5 = last5.trim();
  orders[idx].paidDate = new Date().toISOString().split('T')[0];
  orders[idx].paymentStatus = 'paid';
  orders[idx].status = 'confirmed';
  orders[idx].updatedAt = new Date().toISOString();
  orders[idx].updatedBy = userId;
  saveOrders(orders);
  
  return lineClient.replyMessage(replyToken, {
    type: 'text',
    text: `✅ 收款更新成功！

📋 訂單編號：${order.id}
👤 顧客：${order.customer.name}
📱 電話：${order.customer.phone}
💰 金額：$${order.totalAmount}
🔢 末五碼：${last5.trim()}
📅 匯款日期：${orders[idx].paidDate}
📊 狀態：已匯款（待確認）

已更新系統記錄！`
  });
}

// 查單#姓名#電話
async function handleOrderSearch(replyToken, message) {
  const parts = message.split('#');
  if (parts.length < 3) {
    return lineClient.replyMessage(replyToken, {
      type: 'text',
      text: '❌ 格式錯誤！\n\n正確格式：\n查單#姓名#電話\n\n例如：\n查單#王小明#0912345678'
    });
  }
  
  const [, name, phone] = parts;
  const orders = loadOrders();
  const customerOrders = orders.filter(o => 
    o.customer.name.includes(name.trim()) && 
    o.customer.phone.includes(phone.trim())
  ).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  
  if (customerOrders.length === 0) {
    return lineClient.replyMessage(replyToken, {
      type: 'text',
      text: '❌ 找不到符合條件的訂單\n\n請確認姓名和電話是否正確'
    });
  }
  
  let reply = `📋 找到 ${customerOrders.length} 筆訂單：\n\n`;
  
  for (const o of customerOrders.slice(0, 5)) {
    const statusText = o.paymentStatus === 'paid' ? '✅ 已匯款' : '⏳ 待匯款';
    reply += `━━━━━━━━━━━━━━\n`;
    reply += `📌 ${o.id}\n`;
    reply += `📅 取貨：${o.customer.pickupDate}\n`;
    reply += `🏪 分店：${o.customer.store}\n`;
    reply += `💰 金額：$${o.totalAmount}\n`;
    reply += `🔢 末五碼：${o.paymentLast5 || '未填'}\n`;
    reply += `📊 ${statusText}\n`;
  }
  
  reply += `\n━━━━━━━━━━━━━━`;
  
  return lineClient.replyMessage(replyToken, { type: 'text', text: reply });
}

// 更新#品名#價格#圖片URL
async function handleMenuUpdate(replyToken, message) {
  const parts = message.split('#');
  if (parts.length < 3) {
    return lineClient.replyMessage(replyToken, {
      type: 'text',
      text: '❌ 格式錯誤！\n\n正確格式：\n更新#品名#價格#[圖片URL]\n\n例如：\n更新#紅燒獅子頭#680#https://...jpg\n\n更新#佛跳牆#1380'
    });
  }
  
  const [, name, price, imageUrl] = parts;
  const newPrice = parseInt(price.trim());
  
  if (isNaN(newPrice)) {
    return lineClient.replyMessage(replyToken, {
      type: 'text',
      text: '❌ 價格必須是數字！\n\n例如：\n更新#紅燒獅子頭#680'
    });
  }
  
  // 更新價格
  let updated = false;
  const menu = loadMenuData() || MENU_DATA;
  
  for (const cat of ['hotDishes', 'frozenDishes', 'combos']) {
    if (menu[cat]) {
      const item = menu[cat].find(d => d.name.includes(name.trim()) || d.subtitle && d.subtitle.includes(name.trim()));
      if (item) {
        item.price = newPrice;
        if (imageUrl && imageUrl.trim()) {
          item.image = imageUrl.trim();
        }
        updated = true;
        break;
      }
    }
  }
  
  if (updated) {
    saveMenuData(menu);
    // 更新記憶體中的 MENU_DATA
    Object.assign(MENU_DATA, menu);
    
    return lineClient.replyMessage(replyToken, {
      type: 'text',
      text: `✅ 菜單更新成功！

📝 品名：${name.trim()}
💰 新價格：$${newPrice}
${imageUrl && imageUrl.trim() ? '🖼 圖片：已更新' : ''}

已同步更新至網站！`
    });
  } else {
    return lineClient.replyMessage(replyToken, {
      type: 'text',
      text: `❌ 找不到「${name.trim()}」這個品項\n\n請確認品名是否正確`
    });
  }
}

// 顯示更新菜單說明
async function sendMenuUpdateGuide(replyToken) {
  try {
    await lineClient.replyMessage(replyToken, {
      type: 'text',
      text: `📝 【員工專區：更新年菜菜單】

請使用以下格式更新菜單價格或圖片：

🔧 更新格式：
更新#品名#新價格#[圖片URL]

📌 範例：
更新#紅燒獅子頭#680
更新#佛跳牆#1380#https://example.com/fotiaoqiang.jpg

💡 小提示：
• 價格直接填數字，不用加$
• 圖片URL可省略（會保留原本圖片）
• 一次只能更新一個品項

❓ 需要更新多個品項請分次輸入`
    });
  } catch (err) {
    console.error('sendMenuUpdateGuide error:', err.message);
  }
}

// 顯示查詢訂單說明
async function sendOrderLookupGuide(replyToken) {
  try {
    await lineClient.replyMessage(replyToken, {
      type: 'text',
      text: `📋 【查詢訂單說明】

請使用以下格式查詢訂單：

🔍 查詢格式：
查單#姓名#電話

📌 範例：
查單#王小明#0912345678

💡 小提示：
• 姓名和電話都要填才能查詢
• 查詢的是該顧客的所有訂單記錄

❓ 如有問題請致電：02-2357-0377`
    });
  } catch (err) {
    console.error('sendOrderLookupGuide error:', err.message);
  }
}

// 今日訂單
async function handleTodayOrders(replyToken) {
  const today = new Date().toISOString().split('T')[0];
  const orders = loadOrders().filter(o => o.timestamp.startsWith(today));
  
  if (orders.length === 0) {
    return lineClient.replyMessage(replyToken, {
      type: 'text',
      text: `📋 今日訂單（${today}）\n\n目前沒有新訂單`
    });
  }
  
  let reply = `📋 今日訂單（${today}）\n共 ${orders.length} 筆\n\n`;
  
  const paid = orders.filter(o => o.paymentStatus === 'paid').length;
  const unpaid = orders.length - paid;
  
  reply += `✅ 已匯款：${paid} 筆\n`;
  reply += `⏳ 待匯款：${unpaid} 筆\n\n`;
  
  for (const o of orders.slice(0, 10)) {
    const statusText = o.paymentStatus === 'paid' ? '✅' : '⏳';
    reply += `${statusText} ${o.customer.name} - $${o.totalAmount}`;
    if (o.paymentLast5) reply += ` (末${o.paymentLast5})`;
    reply += `\n`;
  }
  
  return lineClient.replyMessage(replyToken, { type: 'text', text: reply });
}

// 未收款清單
async function handleUnpaidList(replyToken) {
  const orders = getUnpaidOrders();
  
  if (orders.length === 0) {
    return lineClient.replyMessage(replyToken, {
      type: 'text',
      text: '✅ 目前沒有未收款的訂單'
    });
  }
  
  let reply = `⏳ 未收款訂單（共 ${orders.length} 筆）\n\n`;
  
  for (const o of orders.slice(0, 10)) {
    reply += `━━━━━━━━━━━━━━\n`;
    reply += `📌 ${o.id}\n`;
    reply += `👤 ${o.customer.name} (${o.customer.phone})\n`;
    reply += `💰 $${o.totalAmount}\n`;
    reply += `📅 取貨：${o.customer.pickupDate}\n`;
  }
  
  reply += `\n━━━━━━━━━━━━━━\n`;
  reply += `輸入「催繳#訂單編號」發送提醒\n`;
  reply += `或輸入「催繳全部」一次催全部`;
  
  return lineClient.replyMessage(replyToken, { type: 'text', text: reply });
}

// 催繳#訂單編號
async function handleRemindOrder(replyToken, message) {
  const parts = message.split('#');
  const orderId = parts[1] ? parts[1].trim() : '';
  
  if (!orderId) {
    return lineClient.replyMessage(replyToken, {
      type: 'text',
      text: '❌ 請指定訂單編號\n\n格式：催繳#ORD1234567890'
    });
  }
  
  const orders = loadOrders();
  const order = orders.find(o => o.id === orderId);
  
  if (!order) {
    return lineClient.replyMessage(replyToken, {
      type: 'text',
      text: `❌ 找不到訂單 ${orderId}`
    });
  }
  
  try {
    if (order.lineUserId && lineClient) {
      await lineClient.pushMessage(order.lineUserId, {
        type: 'text',
        text: `🧧 祥和蔬食提醒您

親愛的 ${order.customer.name}，您好！

您有一筆年菜訂單尚未完成匯款：

📋 訂單：${order.id}
💰 金額：$${order.totalAmount}
📅 取貨：${order.customer.pickupDate}

【匯款資訊】
銀行：華南銀行（銀行代碼：008）
戶名：祥和蔬食料理
（請致電索取完整帳號）

匯款後請回傳末五碼，謝謝！`
      });
    } else {
      await sendReminderEmail(order);
    }
    
    return lineClient.replyMessage(replyToken, {
      type: 'text',
      text: `✅ 催繳通知已發送給 ${order.customer.name}\n📱 電話：${order.customer.phone}`
    });
  } catch (e) {
    return lineClient.replyMessage(replyToken, {
      type: 'text',
      text: `❌ 發送失敗：${e.message}`
    });
  }
}

// 催繳全部
async function handleRemindAll(replyToken) {
  const orders = getUnpaidOrders();
  
  if (orders.length === 0) {
    return lineClient.replyMessage(replyToken, {
      type: 'text',
      text: '✅ 目前沒有未收款的訂單'
    });
  }
  
  let sent = 0, failed = 0;
  
  for (const order of orders) {
    try {
      if (order.lineUserId && lineClient) {
        await lineClient.pushMessage(order.lineUserId, {
          type: 'text',
          text: `🧧 祥和蔬食提醒您

親愛的 ${order.customer.name}，您好！

您有 ${orders.length} 筆年菜訂單尚未完成匯款。

請儘快匯款並回傳末五碼，謝謝！`
        });
        sent++;
      } else {
        failed++;
      }
    } catch (e) {
      failed++;
    }
  }
  
  return lineClient.replyMessage(replyToken, {
    type: 'text',
    text: `📤 催繳發送完成\n\n✅ 成功：${sent} 筆\n❌ 失敗：${failed} 筆\n（失敗通常是因為顧客未加入LINE好友）`
  });
}

// ============ LINE 訊息發送函式 ============

async function sendMainMenu(replyToken) {
  try {
    await lineClient.replyMessage(replyToken, {
      type: 'text',
      text: '🧧 祥和蔬食 2027 年菜預購\n\n請選擇服務（直接點選按鈕）：',
      quickReply: {
        items: [
          { type: 'action', action: { type: 'message', label: '🍽 瀏覽年菜菜單', text: '菜單' } },
          { type: 'action', action: { type: 'message', label: '🛒 開始預購', text: '預購' } },
          { type: 'action', action: { type: 'message', label: '📞 聯絡我們', text: '聯絡' } },
          { type: 'action', action: { type: 'uri', label: '📱 加入LINE好友', uri: 'https://line.me/ti/p/@sxsd1688' } }
        ]
      }
    });
  } catch (err) {
    console.error('sendMainMenu error:', err.message);
  }
}

async function sendMenuLink(replyToken) {
  const menuUrl = 'https://serenity-2027-menu-production.up.railway.app';
  try {
    await lineClient.replyMessage(replyToken, {
      type: 'text',
      text: `🍽 【祥和蔬食 2027 年菜菜單】

點選下方連結瀏覽圖文並茂的年菜菜單：

${menuUrl}

所有套餐及單點商品都在這裡！👆`,
      quickReply: {
        items: [
          { type: 'action', action: { type: 'uri', label: '🍽 開啟年菜菜單', uri: menuUrl } },
          { type: 'action', action: { type: 'message', label: '🛒 我要預購', text: '預購' } },
          { type: 'action', action: { type: 'message', label: '🔙 回主選單', text: '?' } }
        ]
      }
    });
  } catch (err) {
    console.error('sendMenuLink error:', err.message);
  }
}

async function sendOrderLink(replyToken) {
  const orderUrl = 'https://serenity-2027-menu-production.up.railway.app';
  try {
    await lineClient.replyMessage(replyToken, {
      type: 'text',
      text: `🛒 【祥和蔬食 2027 年菜預購】

立即線上預購年菜，享用豐盛年味：

${orderUrl}

⚠️ 即日起開放預購，數量有限！

🏠 鎮江店：02-2357-0377
🏠 慶城店：02-2546-6768`,
      quickReply: {
        items: [
          { type: 'action', action: { type: 'uri', label: '🛒 開始預購', uri: orderUrl } },
          { type: 'action', action: { type: 'message', label: '🍽 先看菜單', text: '菜單' } },
          { type: 'action', action: { type: 'message', label: '🔙 回主選單', text: '?' } }
        ]
      }
    });
  } catch (err) {
    console.error('sendOrderLink error:', err.message);
  }
}

async function sendContactInfo(replyToken) {
  try {
    await lineClient.replyMessage(replyToken, {
      type: 'text',
      text: `📞 【祥和蔬食料理】

🏠 鎮江店
地址：台北市鎮江街1巷1號
電話：02-2357-0377 / 2391-7699
營業：AM 11:00-14:00 / PM 17:00-21:00

🏠 慶城店
地址：台北市南京東路三段303巷7弄7號
電話：02-2546-6768 / 2546-6188
營業：AM 11:30-14:00 / PM 17:30-21:00

📱 LINE：@sxsd1688`,
      quickReply: {
        items: [
          { type: 'action', action: { type: 'uri', label: '📱 加入LINE好友', uri: 'https://line.me/ti/p/@sxsd1688' } },
          { type: 'action', action: { type: 'message', label: '🛒 開始預購', text: '預購' } },
          { type: 'action', action: { type: 'message', label: '🔙 回主選單', text: '?' } }
        ]
      }
    });
  } catch (err) {
    console.error('sendContactInfo error:', err.message);
  }
}

// ============ Email 通知 ============
async function sendOrderEmail(order) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER || 'skywing4890@gmail.com',
      pass: process.env.EMAIL_PASS || 'YOUR_APP_PASSWORD'
    }
  });

  const comboInfo = order.combo 
    ? `${order.combo.name} ($${order.combo.price})`
    : '未選套餐';

  const sideDishesInfo = order.sideDishes && order.sideDishes.length > 0
    ? order.sideDishes.map(s => `${s.name} x${s.qty} ($${s.price * s.qty})`).join('\n    ')
    : '無';

  const mailOptions = {
    from: '"祥和蔬食年菜系統" <skywing4890@gmail.com>',
    to: 'yehlc@tonsin.com.tw',
    cc: 'skywing4890@gmail.com',
    subject: `🧧 新年菜訂單！${order.customer.name} - ${order.id}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
        <div style="background: linear-gradient(135deg, #c0392b, #e74c3c); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0;">🧧 祥和蔬食 - 新年菜訂單</h1>
          <p style="margin: 5px 0 0;">訂單編號: ${order.id}</p>
        </div>
        
        <div style="padding: 20px; background: #fff;">
          <h2 style="color: #c0392b; border-bottom: 2px solid #eee; padding-bottom: 10px;">📋 顧客資料</h2>
          <table style="width: 100%;">
            <tr><td style="padding: 8px; color: #888;">姓名</td><td style="padding: 8px; font-weight: bold;">${order.customer.name}</td></tr>
            <tr><td style="padding: 8px; color: #888;">電話</td><td style="padding: 8px;">${order.customer.phone}</td></tr>
            <tr><td style="padding: 8px; color: #888;">取貨分店</td><td style="padding: 8px;">${order.customer.store}</td></tr>
            <tr><td style="padding: 8px; color: #888;">取貨日期</td><td style="padding: 8px;">${order.customer.pickupDate}</td></tr>
          </table>

          <h2 style="color: #c0392b; border-bottom: 2px solid #eee; padding-bottom: 10px; margin-top: 20px;">🍽 套餐</h2>
          <p>${comboInfo}</p>

          <h2 style="color: #c0392b; border-bottom: 2px solid #eee; padding-bottom: 10px; margin-top: 20px;">🥢 單點</h2>
          <pre style="background: #f9f9f9; padding: 10px; border-radius: 5px;">${sideDishesInfo}</pre>

          <h2 style="color: #c0392b; border-bottom: 2px solid #eee; padding-bottom: 10px; margin-top: 20px;">💰 總金額</h2>
          <p style="font-size: 24px; color: #c0392b; font-weight: bold;">$${order.totalAmount}</p>

          <h2 style="color: #c0392b; border-bottom: 2px solid #eee; padding-bottom: 10px; margin-top: 20px;">🏧 匯款資訊</h2>
          <p>銀行：華南銀行（代碼：008）<br>帳號：請洽店家<br>戶名：祥和蔬食料理<br><br>匯款後請回傳末五碼確認！</p>

          ${order.notes ? `<h2 style="color: #c0392b; border-bottom: 2px solid #eee; padding-bottom: 10px; margin-top: 20px;">📝 備註</h2><p>${order.notes}</p>` : ''}
        </div>
        
        <div style="background: #2c3e50; color: white; padding: 15px; text-align: center; border-radius: 0 0 10px 10px; font-size: 12px;">
          祥和蔬食料理｜鎮江店：02-2357-0377｜慶城店：02-2546-6768
        </div>
      </div>
    `
  };

  await transporter.sendMail(mailOptions);
  console.log('Email 通知已發送');
}

async function sendReminderEmail(order) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER || 'skywing4890@gmail.com',
      pass: process.env.EMAIL_PASS || 'YOUR_APP_PASSWORD'
    }
  });

  const mailOptions = {
    from: '"祥和蔬食年菜系統" <skywing4890@gmail.com>',
    to: 'yehlc@tonsin.com.tw',
    subject: `⚠️ 催繳通知 - ${order.customer.name} 訂單 ${order.id}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
        <div style="background: #e74c3c; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0;">⚠️ 催繳通知</h1>
        </div>
        
        <div style="padding: 20px; background: #fff;">
          <p>顧客 <strong>${order.customer.name}</strong> 的年菜訂單尚未匯款：</p>
          
          <table style="width: 100%;">
            <tr><td style="padding: 8px;">訂單編號</td><td style="padding: 8px; font-weight: bold;">${order.id}</td></tr>
            <tr><td style="padding: 8px;">金額</td><td style="padding: 8px; font-weight: bold; color: #e74c3c;">$${order.totalAmount}</td></tr>
            <tr><td style="padding: 8px;">取貨日期</td><td style="padding: 8px;">${order.customer.pickupDate}</td></tr>
            <tr><td style="padding: 8px;">電話</td><td style="padding: 8px;">${order.customer.phone}</td></tr>
          </table>
          
          <p style="margin-top: 20px;">請確認顧客是否已匯款，或聯繫顧客確認匯款狀態。</p>
        </div>
      </div>
    `
  };

  await transporter.sendMail(mailOptions);
}

// ============ 健康檢查 ============
app.get('/health', (req, res) => {
  res.json({ status: 'ok', bot: 'serenity-2027', time: new Date().toISOString(), version: 'FULL-FEATURED' });
});

// ============ 啟動伺服器 ============
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`祥和蔬食 2027 年菜系統啟動！端口: ${PORT}`);
  console.log(`年菜 Menu: http://localhost:${PORT}/`);
  console.log(`管理後台: http://localhost:${PORT}/admin.html`);
});
